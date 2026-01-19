import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { resolveCompanyIdentityOrError } from '@/lib/resolveCompanyIdentity';
import { computeWebsiteReview, createFailedWebsiteReport, type WebsiteScanInput } from '@/lib/scoring';
import { logScanWrite } from '@/app/api/debug/website-health/route';
import { verifyDualWriteConsistency } from '@/lib/dualWriteGuard';

/**
 * POST /api/companies/[id]/web-health/scan
 * 
 * Triggers website health scan and staleness analysis
 * Returns updated score, status, and key findings
 * 
 * SCORING: Uses single source of truth - score = BASE_SCORE + Σ(factor.points)
 */
export async function POST(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id: rawId } = await context.params;

        // Use resolver for flexible company identification
        const resolved = await resolveCompanyIdentityOrError({
            companyId: !isNaN(parseInt(rawId)) ? parseInt(rawId) : undefined,
            companyNumber: isNaN(parseInt(rawId)) ? rawId : undefined
        });

        if (!resolved.success) {
            console.warn(`[WebHealthScan] Company resolution failed for: ${rawId}`);
            return NextResponse.json({
                error: resolved.error,
                errorCode: resolved.errorCode,
                hint: resolved.hint
            }, { status: 400 });
        }

        const companyId = resolved.companyId;
        console.log(`[WebHealthScan] Starting scan for company ${companyId}...`);

        // Get company prospect
        const prospect = await prisma.companyProspect.findUnique({
            where: { id: companyId }
        });

        if (!prospect) {
            return NextResponse.json({
                error: 'Company not found',
                errorCode: 'COMPANY_NOT_FOUND',
                hint: 'The company may have been deleted'
            }, { status: 404 });
        }

        console.log(`[WebHealthScan] Delegating to Canonical V2 Scanner for company ${companyId}`);

        // DELEGATE TO CANONICAL V2 SCANNER
        // This ensures strict invariant enforcement (No Success Without Report)
        const { runWebsiteHealthScan } = await import('@/lib/websiteHealth/runScan');

        const result = await runWebsiteHealthScan({
            companyId,
            initiatedFrom: 'api',
            force: true,
            requestId: `api-scan-${companyId}-${Date.now()}`
        });

        if (result.status === 'error') {
            return NextResponse.json({
                success: false,
                status: 'failed',
                error: result.error || 'Scan failed',
                errorCode: result.error === 'NO_WEBSITE_URL' ? 'NO_WEBSITE_URL' : 'SCAN_FAILED',

                // Include DB readback for state sync
                updatedCompanyHealth: {
                    companyId,
                    websiteHealthStatus: 'error',
                    websiteHealthScore: null,
                    websiteHealthLabel: null,
                    websiteHealthError: result.error,
                    websiteHealthScannedAt: result.persistedAt,
                    websiteHealthVersion: 2
                }
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            status: 'success',
            score: result.finalScore,
            label: result.label,
            factors: result.receipt?.computed?.factors || [],
            signals: (result.receipt?.computed?.factors || []).map((f: any) => f.label || f.id),
            domain: result.receipt?.resolvedUrl,
            lastScanned: result.persistedAt,
            _dualWriteConsistent: true, // V2 handles this internally via readback

            // CRITICAL: Include full DB readback for state synchronization
            updatedCompanyHealth: {
                companyId,
                websiteHealthStatus: 'success',
                websiteHealthScore: result.dbReadback.websiteHealthScore,
                websiteHealthLabel: result.dbReadback.websiteHealthLabel,
                websiteHealthScannedAt: result.persistedAt,
                websiteHealthVersion: result.dbReadback.websiteHealthVersion,
                websiteHealthError: null
            }
        });

    } catch (error: any) {
        console.error('[WebHealthScan] Error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to scan website',
            errorCode: 'SCAN_FAILED'
        }, { status: 500 });
    }
}

/**
 * GET /api/companies/[id]/web-health/scan
 * 
 * Returns current web health status including full breakdown
 */
export async function GET(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const companyId = parseInt(id);
        if (isNaN(companyId)) {
            return NextResponse.json({ error: 'Invalid company ID' }, { status: 400 });
        }

        const prospect = await prisma.companyProspect.findUnique({
            where: { id: companyId },
            select: {
                websiteDomain: true,
                websiteUrl: true,
                lastAnalysedAt: true,
                webHealthData: true, // This contains the full report with factors
                stalenessScore: true
            }
        });

        if (!prospect) {
            return NextResponse.json({ error: 'Company not found' }, { status: 404 });
        }

        // Parse webHealthData to get full report including factors
        let report: any = null;
        if (prospect.webHealthData) {
            try {
                report = JSON.parse(prospect.webHealthData as string);
            } catch (e) {
                console.error('[WebHealth] Failed to parse webHealthData:', e);
            }
        }

        // Determine scan state
        let scanState = 'not_scanned';
        if (report?.status === 'failed') {
            scanState = 'failed';
        } else if (report?.score !== null && report?.score !== undefined) {
            scanState = 'scanned';
        } else if (prospect.stalenessScore !== null) {
            // Legacy: has score but may not have webHealthData
            scanState = 'scanned';
        }

        // Get factors - synthesize from legacy data if needed
        let factors = report?.factors ?? [];

        // If we have a score but no factors (legacy data), synthesize factors
        if (factors.length === 0 && (report?.score !== null || prospect.stalenessScore !== null)) {
            const score = report?.score ?? prospect.stalenessScore ?? 0;

            // Check if we have signals to convert to factors
            if (report?.signals && Array.isArray(report.signals) && report.signals.length > 0) {
                factors = report.signals.map((s: string, i: number) => ({
                    id: `legacy-${i}`,
                    label: s,
                    points: 0, // Unknown points from legacy
                    polarity: 'neutral' as const,
                    description: 'Legacy signal (rescan for accurate scoring)'
                }));
            } else {
                // Create a summary factor based on the score
                factors = [{
                    id: 'legacy-score',
                    label: score >= 70 ? 'Website appears healthy' : score >= 40 ? 'Website may need attention' : 'Website needs work',
                    points: score - 50, // Approximate points from score
                    polarity: (score >= 50 ? 'positive' : 'negative') as 'positive' | 'negative',
                    description: 'Rescan this company to see detailed breakdown'
                }];
            }
        }

        // Return full report data
        return NextResponse.json({
            domain: prospect.websiteDomain,
            url: prospect.websiteUrl,
            score: report?.score ?? prospect.stalenessScore ?? null,
            statusLabel: report?.statusLabel ?? 'Not scanned',
            factors,
            signals: factors.map((f: any) => f.label),
            confidence: report?.confidence ?? (factors.length > 2 ? 'medium' : 'low'),
            baseScore: report?.baseScore ?? 50,
            computedAt: report?.computedAt ?? null,
            lastScanned: prospect.lastAnalysedAt,
            scanState
        });

    } catch (error: any) {
        console.error('[WebHealth] GET error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to get web health'
        }, { status: 500 });
    }
}
