import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { resolveCompanyIdentityOrError } from '@/lib/resolveCompanyIdentity';

/**
 * POST /api/companies/[id]/web-health/scan
 * 
 * Triggers website health scan and staleness analysis
 * Returns updated score, status, and key findings
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
            // Persist failed status
            const failedData = {
                score: 0,
                label: 'No Website',
                signals: [],
                breakdown: [],
                status: 'failed',
                failureReason: 'No website URL found',
                lastScannedAt: new Date().toISOString()
            };

            await prisma.companyProspect.update({
                where: { id: companyId },
                data: { webHealthData: JSON.stringify(failedData) }
            });

            return NextResponse.json({
                success: false,
                status: 'failed',
                error: 'No website URL found',
                errorCode: 'NO_WEBSITE_URL'
            }, { status: 400 });
        }

        console.log(`[WebHealthScan] Scanning domain: ${domain}`)

        // Perform website scan
        let score = 50;
        const signals: string[] = [];
        const breakdown: { label: string; points: number; text?: string; status?: 'good' | 'ok' | 'risk' }[] = [];

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
                // Website is reachable
                score += 20;
                signals.push('Website is reachable');
                breakdown.push({ label: 'Website Reachable', points: 20, text: 'Site responds to requests', status: 'good' });

                // Check SSL
                if (url.startsWith('https://')) {
                    score += 10;
                    signals.push('SSL certificate is active');
                    breakdown.push({ label: 'SSL Certificate', points: 10, text: 'HTTPS enabled', status: 'good' });
                }

                // Check response time (via status)
                if (response.ok) {
                    score += 10;
                    signals.push('Website returns 200 OK');
                    breakdown.push({ label: 'HTTP Status', points: 10, text: 'Returns 200 OK', status: 'good' });
                } else {
                    breakdown.push({ label: 'HTTP Status', points: 0, text: `Returns ${response.status}`, status: 'ok' });
                }
            } else {
                score -= 20;
                signals.push('Website may be unreachable');
                breakdown.push({ label: 'Website Reachable', points: -20, text: 'Could not connect', status: 'risk' });
            }

            // Calculate staleness based on discovery date
            const discoveryDate = prospect.websiteDiscoveryDate;
            if (discoveryDate) {
                const daysSinceDiscovery = (Date.now() - new Date(discoveryDate).getTime()) / (1000 * 60 * 60 * 24);
                if (daysSinceDiscovery < 7) {
                    score += 10;
                    signals.push('Recently verified');
                    breakdown.push({ label: 'Verification Recency', points: 10, text: 'Verified in last week', status: 'good' });
                } else if (daysSinceDiscovery < 30) {
                    signals.push('Verified within last month');
                    breakdown.push({ label: 'Verification Recency', points: 0, text: 'Verified in last month', status: 'ok' });
                } else {
                    score -= 10;
                    signals.push('May need re-verification');
                    breakdown.push({ label: 'Verification Recency', points: -10, text: 'Over 30 days old', status: 'risk' });
                }
            }

        } catch (e: any) {
            console.error('[WebHealthScan] Scan error:', e);
            score = 30;
            signals.push('Could not verify website');
            breakdown.push({ label: 'Scan Error', points: 0, text: 'Could not complete scan', status: 'risk' });
        }

        // Score capped at 0-100
        score = Math.max(0, Math.min(100, score));

        // Determine status label
        let label = 'Fresh';
        if (score >= 70) label = 'Healthy';
        else if (score >= 40) label = 'Needs Work';
        else label = 'At Risk';

        // Build complete webHealthData JSON
        const webHealthData = {
            score,
            label,
            signals,
            breakdown,
            status: 'success',
            domain,
            lastScannedAt: new Date().toISOString()
        };

        // Update database - persist to BOTH legacy fields AND webHealthData JSON
        await prisma.companyProspect.update({
            where: { id: companyId },
            data: {
                websiteDomain: domain,
                websiteDiscoveryDate: new Date(),
                websiteSignals: JSON.stringify(signals),
                stalenessScore: score,
                stalenessLabel: label,
                webHealthData: JSON.stringify(webHealthData)
            }
        });

        console.log(`[WebHealthScan] Completed for company ${companyId}: score=${score}`);

        return NextResponse.json({
            success: true,
            status: 'success',
            score,
            label,
            signals,
            breakdown,
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
