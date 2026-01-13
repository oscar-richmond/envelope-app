import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

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
        const companyId = parseInt(params.id);
        if (isNaN(companyId)) {
            return NextResponse.json({ error: 'Invalid company ID' }, { status: 400 });
        }

        console.log(`[WebHealthScan] Starting scan for company ${companyId}...`);

        // Get company prospect
        const prospect = await prisma.companyProspect.findUnique({
            where: { id: companyId }
        });

        if (!prospect) {
            return NextResponse.json({ error: 'Company not found' }, { status: 404 });
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
            return NextResponse.json({
                error: 'No website URL found',
                status: 'no_domain'
            }, { status: 400 });
        }

        console.log(`[WebHealthScan] Scanning domain: ${domain}`);

        // Perform website scan
        let webHealthData: any = null;

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

            let score = 50;
            const signals: string[] = [];

            if (response) {
                // Website is reachable
                score += 20;
                signals.push('Website is reachable');

                // Check SSL
                if (url.startsWith('https://')) {
                    score += 10;
                    signals.push('SSL certificate is active');
                }

                // Check response time (via status)
                if (response.ok) {
                    score += 10;
                    signals.push('Website returns 200 OK');
                }
            } else {
                score -= 20;
                signals.push('Website may be unreachable');
            }

            // Calculate staleness based on discovery date
            const discoveryDate = prospect.websiteDiscoveryDate;
            if (discoveryDate) {
                const daysSinceDiscovery = (Date.now() - new Date(discoveryDate).getTime()) / (1000 * 60 * 60 * 24);
                if (daysSinceDiscovery < 7) {
                    score += 10;
                    signals.push('Recently verified');
                } else if (daysSinceDiscovery < 30) {
                    // Keep current score
                    signals.push('Verified within last month');
                } else {
                    score -= 10;
                    signals.push('May need re-verification');
                }
            }

            // Score capped at 0-100
            score = Math.max(0, Math.min(100, score));

            // Determine status label
            let label = 'Fresh';
            if (score >= 70) label = 'Fresh';
            else if (score >= 40) label = 'Stale';
            else label = 'Risk';

            webHealthData = {
                score,
                label,
                signals,
                isReachable: !!response?.ok
            };

        } catch (e: any) {
            console.error('[WebHealthScan] Scan error:', e);
            webHealthData = {
                score: 30,
                label: 'Unknown',
                signals: ['Could not verify website'],
                isReachable: false
            };
        }

        // Update database
        await prisma.companyProspect.update({
            where: { id: companyId },
            data: {
                websiteDomain: domain,
                websiteDiscoveryDate: new Date(),
                websiteSignals: JSON.stringify(webHealthData.signals),
                stalenessScore: webHealthData.score,
                stalenessLabel: webHealthData.label
            }
        });

        console.log(`[WebHealthScan] Completed for company ${companyId}: score=${webHealthData.score}`);

        return NextResponse.json({
            success: true,
            score: webHealthData.score,
            label: webHealthData.label,
            signals: webHealthData.signals,
            domain,
            lastScanned: new Date().toISOString()
        });

    } catch (error: any) {
        console.error('[WebHealthScan] Error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to scan website'
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
