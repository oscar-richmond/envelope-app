import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { computeWebsiteHealthV2, type WebsiteScanInputV2 } from '@/lib/scoring/computeWebsiteHealthV2';
import { validateReport } from '@/lib/scoring/types';

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

        // ===== CRITICAL: Set status to "scanning" BEFORE starting work =====
        // This clears any stale score so UI shows "Scanning..." not old score
        await prisma.companyProspect.update({
            where: { id: prospect.id },
            data: {
                websiteHealthStatus: 'scanning',
                websiteHealthScore: null,  // Clear stale score
                websiteHealthError: null
            }
        });

        // Build scan input - START WITH CONSERVATIVE DEFAULTS
        const scanInput: WebsiteScanInput = {
            isReachable: false,  // Assume unreachable until proven otherwise
            isHttps: false       // Assume HTTP until HTTPS fetch succeeds
        };

        // Perform actual scan
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);

            // Try HTTPS first (most modern sites)
            const response = await fetch(`https://${domain}`, {
                method: 'HEAD',
                signal: controller.signal,
                headers: { 'User-Agent': 'EnvelopeBot/1.0' }
            }).catch(() => null);

            clearTimeout(timeout);

            if (response) {
                scanInput.isReachable = true;
                scanInput.isHttps = true;  // HTTPS worked
                scanInput.httpStatus = response.status;
            } else {
                // HTTPS failed, maybe it's HTTP-only?
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

        // Compute score using V2 scoring engine (with built-in validation)
        let report;
        try {
            report = computeWebsiteHealthV2({
                domain,
                isReachable: scanInput.isReachable,
                isHttps: scanInput.isHttps,
                httpStatus: scanInput.httpStatus,
                daysSinceVerified: scanInput.daysSinceVerified,
                hasSitemap: false // TODO: Add sitemap detection
            });
        } catch (validationError: any) {
            // V2 scorer throws on validation failure
            const errorMsg = validationError.message || 'Scoring validation failed';
            console.error('[ScanWebsite] V2 VALIDATION FAILED', {
                companyId: prospect.id,
                companyName: prospect.companyName,
                error: errorMsg,
                scanInput
            });

            // Persist error state
            await prisma.companyProspect.update({
                where: { id: prospect.id },
                data: {
                    websiteHealthStatus: 'error',
                    websiteHealthScore: null,
                    websiteHealthLabel: null,
                    websiteHealthError: errorMsg,
                    websiteHealthVersion: 2
                }
            });

            return NextResponse.json({
                status: 'failed',
                error: errorMsg
            }, { status: 500 });
        }

        // Persist to BOTH legacy and new schema for rollback safety
        await prisma.companyProspect.update({
            where: { id: prospect.id },
            data: {
                websiteDomain: domain,

                // Legacy fields (for rollback)
                lastAnalysedAt: now,
                signals: JSON.stringify(report.factors.map(f => f.label)),
                stalenessScore: report.score,

                // New canonical fields (V2)
                websiteHealthStatus: 'success',
                websiteHealthScore: report.score,
                websiteHealthLabel: report.label,
                websiteHealthScannedAt: now,
                websiteHealthError: null,
                websiteHealthVersion: 2, // V2 marker

                // Structured report (contains full V2 report with tr aceId)
                webHealthData: JSON.stringify(report)
            }
        });

        // Also update the lead if applicable
        if (leadId) {
            await prisma.lead.update({
                where: { id: leadId },
                data: {
                    stalenessScore: report.score ?? null,  // FIXED: null for incomplete scans
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
        console.error('[ScanWebsite] Fatal error:', error);

        // Try to mark as failed in DB if we have a prospect
        if (prospect?.id) {
            try {
                await prisma.companyProspect.update({
                    where: { id: prospect.id },
                    data: {
                        websiteHealthStatus: 'error',
                        websiteHealthScore: null,
                        websiteHealthError: error.message || 'Unknown error during scan'
                    }
                });
            } catch (dbError) {
                console.error('[ScanWebsite] Failed to update error status:', dbError);
            }
        }

        return NextResponse.json({
            status: 'failed',
            error: error.message || 'Unknown error',
            message: 'Website scan failed'
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
