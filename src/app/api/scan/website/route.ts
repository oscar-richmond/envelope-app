import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { computeWebsiteReview, type WebsiteScanInput } from '@/lib/scoring';

/**
 * Website Scan API
 * 
 * Triggers real website analysis for a company/lead
 */

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { companyProspectId, leadId, force = false } = body;

        if (!companyProspectId && !leadId) {
            return NextResponse.json({ error: 'companyProspectId or leadId required' }, { status: 400 });
        }

        // Find the company prospect
        let prospect;
        if (companyProspectId) {
            prospect = await prisma.companyProspect.findUnique({
                where: { id: companyProspectId }
            });
        } else if (leadId) {
            const lead = await prisma.lead.findUnique({
                where: { id: leadId },
                include: { companyProspect: true }
            });
            prospect = lead?.companyProspect;
        }

        if (!prospect) {
            return NextResponse.json({ error: 'Company not found' }, { status: 404 });
        }

        // Check if already scanning or recently scanned
        const now = new Date();
        const lastScanned = prospect.lastAnalysedAt;
        const isStale = !lastScanned || (now.getTime() - lastScanned.getTime()) > 14 * 24 * 60 * 60 * 1000;

        if (!force && !isStale && prospect.stalenessScore !== null) {
            return NextResponse.json({
                status: 'already_complete',
                message: 'Website was recently scanned',
                data: {
                    score: prospect.stalenessScore,
                    lastScannedAt: lastScanned,
                    isStale: false
                }
            });
        }

        // Check if website URL exists
        const websiteUrl = prospect.websiteUrl || prospect.websiteDomain;
        if (!websiteUrl) {
            return NextResponse.json({
                status: 'no_website',
                message: 'No website URL found for this company',
                data: {
                    score: null,
                    error: 'No website URL'
                }
            });
        }

        // Extract domain
        let domain = prospect.websiteDomain || '';
        if (!domain && websiteUrl) {
            domain = websiteUrl
                .replace(/^https?:\/\//, '')
                .replace(/^www\./, '')
                .split('/')[0];
        }

        // Build scan input
        const scanInput: WebsiteScanInput = {
            domain,
            isReachable: false,
            hasHttps: domain.length > 0
        };

        // Perform actual scan
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);

            const response = await fetch(`https://${domain}`, {
                method: 'HEAD',
                signal: controller.signal,
                headers: { 'User-Agent': 'EnvelopeBot/1.0' }
            }).catch(() => null);

            clearTimeout(timeout);

            if (response) {
                scanInput.isReachable = true;
                scanInput.hasHttps = true;
                scanInput.httpStatus = response.status;
            } else {
                scanInput.isReachable = false;
                scanInput.error = 'Could not connect to website';
            }

            // Calculate days since last verification
            if (lastScanned) {
                scanInput.daysSinceVerified = Math.floor(
                    (Date.now() - new Date(lastScanned).getTime()) / (1000 * 60 * 60 * 24)
                );
            }

        } catch (e: any) {
            console.error('[ScanWebsite] Scan error:', e);
            scanInput.error = e.message || 'Scan error';
        }

        // Compute score
        const report = computeWebsiteReview(scanInput);

        // Build webHealthData
        const webHealthData = {
            ...report,
            status: 'success',
            domain
        };

        const signalStrings = report.factors.map(f => f.label);

        // Persist
        await prisma.companyProspect.update({
            where: { id: prospect.id },
            data: {
                websiteDomain: domain,
                lastAnalysedAt: now,
                signals: JSON.stringify(signalStrings),
                stalenessScore: report.score ?? 0,
                webHealthData: JSON.stringify(webHealthData)
            }
        });

        // Also update the lead if applicable
        if (leadId) {
            await prisma.lead.update({
                where: { id: leadId },
                data: {
                    stalenessScore: report.score ?? 0,
                    lastAnalyzedAt: now
                }
            });
        }

        console.log(`[ScanWebsite] Completed for prospect ${prospect.id}: score=${report.score}`);

        return NextResponse.json({
            status: 'complete',
            message: 'Website scan completed',
            data: {
                score: report.score,
                label: report.statusLabel,
                factors: report.factors,
                lastScannedAt: now
            }
        });

    } catch (error: any) {
        console.error('[ScanWebsite] Error:', error);
        return NextResponse.json({
            status: 'failed',
            error: error.message
        }, { status: 500 });
    }
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const companyProspectId = searchParams.get('companyProspectId');

    if (!companyProspectId) {
        return NextResponse.json({ error: 'companyProspectId required' }, { status: 400 });
    }

    const prospect = await prisma.companyProspect.findUnique({
        where: { id: parseInt(companyProspectId) },
        select: {
            stalenessScore: true,
            lastAnalysedAt: true,
            webHealthData: true,
            signals: true
        }
    });

    if (!prospect) {
        return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    let webHealth: any = null;
    if (prospect.webHealthData) {
        try {
            webHealth = JSON.parse(prospect.webHealthData);
        } catch (e) { }
    }

    return NextResponse.json({
        score: webHealth?.score ?? prospect.stalenessScore,
        label: webHealth?.label ?? webHealth?.statusLabel,
        factors: webHealth?.factors ?? [],
        lastScannedAt: prospect.lastAnalysedAt
    });
}
