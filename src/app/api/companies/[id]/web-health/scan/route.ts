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
    { params }: { params: { id: string } }
) {
    try {
        const rawId = params.id;

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
            const discoveryDate = prospect.websiteDiscoveryDate;
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
                websiteDiscoveryDate: new Date(),
                websiteSignals: JSON.stringify(signalStrings),
                stalenessScore: report.score ?? 0,
                stalenessLabel: report.statusLabel,
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
 * GET /api/companies/[id]/web-health
 * 
 * Returns current web health status
 */
export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const companyId = parseInt(params.id);
        if (isNaN(companyId)) {
            return NextResponse.json({ error: 'Invalid company ID' }, { status: 400 });
        }

        const prospect = await prisma.companyProspect.findUnique({
            where: { id: companyId },
            select: {
                websiteDomain: true,
                websiteUrl: true,
                websiteDiscoveryDate: true,
                websiteSignals: true,
                stalenessScore: true,
                stalenessLabel: true
            }
        });

        if (!prospect) {
            return NextResponse.json({ error: 'Company not found' }, { status: 404 });
        }

        // Parse signals
        let signals: string[] = [];
        try {
            if (prospect.websiteSignals) {
                const parsed = JSON.parse(prospect.websiteSignals as string);
                signals = Array.isArray(parsed) ? parsed : [];
            }
        } catch (e) {
            // Ignore parse errors
        }

        return NextResponse.json({
            domain: prospect.websiteDomain,
            url: prospect.websiteUrl,
            score: prospect.stalenessScore,
            label: prospect.stalenessLabel,
            signals,
            lastScanned: prospect.websiteDiscoveryDate,
            status: prospect.stalenessScore ? 'scanned' : 'not_scanned'
        });

    } catch (error: any) {
        console.error('[WebHealth] GET error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to get web health'
        }, { status: 500 });
    }
}
