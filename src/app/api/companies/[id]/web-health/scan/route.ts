import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { resolveCompanyIdentityOrError } from '@/lib/resolveCompanyIdentity';
import { computeWebsiteReview, createFailedWebsiteReport, type WebsiteScanInput } from '@/lib/scoring';

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

        // Normalize domain
        let domain = prospect.websiteDomain || '';
        const websiteUrl = prospect.websiteUrl || '';

        if (!domain && websiteUrl) {
            domain = websiteUrl
                .replace(/^https?:\/\//, '')
                .replace(/^www\./, '')
                .split('/')[0];
        }

        if (!domain) {
            // Use scoring engine for failed state
            const failedReport = createFailedWebsiteReport('No website URL found');
            const webHealthData = {
                ...failedReport,
                status: 'failed',
                domain: null
            };

            await prisma.companyProspect.update({
                where: { id: companyId },
                data: { webHealthData: JSON.stringify(webHealthData) }
            });

            return NextResponse.json({
                success: false,
                status: 'failed',
                error: 'No website URL found',
                errorCode: 'NO_WEBSITE_URL'
            }, { status: 400 });
        }

        console.log(`[WebHealthScan] Scanning domain: ${domain}`)

        // Collect scan input data
        const scanInput: WebsiteScanInput = {
            isReachable: false,
            isHttps: false
        };

        try {
            // Fetch website to check if it's reachable
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);

            const url = `https://${domain}`;
            const response = await fetch(url, {
                method: 'HEAD',
                signal: controller.signal,
                headers: { 'User-Agent': 'EnvelopeBot/1.0' }
            }).catch(() => null);

            clearTimeout(timeout);

            if (response) {
                scanInput.isReachable = true;
                scanInput.isHttps = url.startsWith('https://');
                scanInput.httpStatus = response.status;
            } else {
                scanInput.isReachable = false;
                scanInput.error = 'Could not connect to website';
            }

            // Calculate days since verification
            const discoveryDate = prospect.lastAnalysedAt;
            if (discoveryDate) {
                scanInput.daysSinceVerified = Math.floor(
                    (Date.now() - new Date(discoveryDate).getTime()) / (1000 * 60 * 60 * 24)
                );
            }

        } catch (e: any) {
            console.error('[WebHealthScan] Scan error:', e);
            scanInput.error = e.message || 'Scan error';
        }

        // Use scoring engine to compute score from factors
        const report = computeWebsiteReview(scanInput);

        // Build complete webHealthData with report + metadata
        const webHealthData = {
            ...report,
            status: 'success',
            domain
        };

        // Extract signals as string array for legacy compatibility
        const signalStrings = report.factors.map(f => f.label);

        // Update database - persist scoring engine result
        await prisma.companyProspect.update({
            where: { id: companyId },
            data: {
                websiteDomain: domain,
                lastAnalysedAt: new Date(),
                signals: JSON.stringify(signalStrings),
                stalenessScore: report.score ?? 0,
                webHealthData: JSON.stringify(webHealthData)
            }
        });

        console.log(`[WebHealthScan] Completed for company ${companyId}: score=${report.score}`);

        return NextResponse.json({
            success: true,
            status: 'success',
            score: report.score,
            label: report.statusLabel,
            factors: report.factors,
            signals: signalStrings,
            domain,
            lastScanned: new Date().toISOString()
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
                stalenessScore: true,
                stalenessLabel: true
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
            statusLabel: report?.statusLabel ?? prospect.stalenessLabel ?? 'Not scanned',
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
