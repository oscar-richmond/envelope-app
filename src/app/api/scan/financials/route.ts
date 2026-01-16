import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Financial Scan API
 * 
 * Triggers real financial analysis for a company/lead from Companies House
 */

const COMPANIES_HOUSE_API_KEY = process.env.COMPANIES_HOUSE_API_KEY;

// NEW CANONICAL API: /api/scan/financials
export async function POST(request: Request) {
    const traceId = crypto.randomUUID();

    try {
        const body = await request.json();
        const { companyProspectId, leadId, force = false, surface = 'api' } = body;

        if (!companyProspectId && !leadId) {
            return NextResponse.json({ error: 'companyProspectId or leadId required', traceId }, { status: 400 });
        }

        // 1. Resolve Company
        let prospect;
        if (companyProspectId) {
            prospect = await prisma.companyProspect.findUnique({ where: { id: companyProspectId } });
        } else if (leadId) {
            const lead = await prisma.lead.findUnique({
                where: { id: leadId },
                include: { companyProspect: true }
            });
            prospect = lead?.companyProspect;
        }

        if (!prospect) {
            return NextResponse.json({ error: 'Company not found', traceId }, { status: 404 });
        }

        // 2. IMMEDIATE STATE WRITE: Scanning
        await prisma.companyProspect.update({
            where: { id: prospect.id },
            data: {
                financialHealthStatus: 'scanning',
                financialHealthTraceId: traceId,
                financialHealthLastWriter: 'api/scan/financials',
                financialHealthLastSurface: surface
            }
        });

        // 3. Validation: Company Number
        const companyNumber = prospect.companyNumber;
        if (!companyNumber) {
            await prisma.companyProspect.update({
                where: { id: prospect.id },
                data: {
                    financialHealthStatus: 'error',
                    financialHealthError: 'NO_COMPANY_NUMBER',
                    financialHealthScore: null,
                    financialHealthLabel: null
                }
            });
            return NextResponse.json({
                status: 'failed',
                code: 'NO_COMPANY_NUMBER',
                detail: 'No Companies House number found',
                traceId,
                financialHealthStatus: 'error',
                updatedCompanyHealth: {
                    companyId: prospect.id,
                    financialHealthStatus: 'error',
                    financialHealthError: 'NO_COMPANY_NUMBER'
                }
            }, { status: 422 });
        }

        const now = new Date();
        const factors: { id: string; label: string; points: number; description: string }[] = [];
        let score = 50; // Base score
        let incorporationDate: Date | null = null;
        let band = 'Medium';
        let errorMsg: string | null = null;

        // 4. Run Logic (Companies House)
        if (COMPANIES_HOUSE_API_KEY) {
            try {
                const auth = Buffer.from(`${COMPANIES_HOUSE_API_KEY}:`).toString('base64');
                const profileRes = await fetch(
                    `https://api.company-information.service.gov.uk/company/${companyNumber}`,
                    { headers: { Authorization: `Basic ${auth}` } }
                );

                if (profileRes.ok) {
                    const profile = await profileRes.json();

                    // Active Status
                    if (profile.company_status === 'active') {
                        factors.push({ id: 'active', label: 'Company is active', points: 25, description: 'Currently trading' });
                        score += 25; // += points logic
                    } else {
                        factors.push({ id: 'inactive', label: `Company status: ${profile.company_status}`, points: -25, description: 'Not currently active' });
                        score -= 25;
                    }

                    // Accounts
                    if (profile.accounts?.next_due) {
                        const dueDate = new Date(profile.accounts.next_due);
                        const daysUntilDue = Math.floor((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                        if (daysUntilDue > 60) {
                            factors.push({ id: 'accounts_ok', label: 'Accounts up to date', points: 15, description: `Next due in ${daysUntilDue} days` });
                            score += 15;
                        } else if (daysUntilDue < 0) {
                            factors.push({ id: 'accounts_overdue', label: 'Accounts overdue', points: -15, description: 'Filing overdue' });
                            score -= 15;
                        }
                    }

                    // Age
                    if (profile.date_of_creation) {
                        const created = new Date(profile.date_of_creation);
                        incorporationDate = created;
                        const yearsOld = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24 * 365));
                        if (yearsOld >= 5) {
                            factors.push({ id: 'established', label: 'Established', points: 10, description: '>5 years' });
                            score += 10;
                        } else if (yearsOld < 1) {
                            factors.push({ id: 'new', label: 'New company', points: -5, description: '<1 year old' });
                            score -= 5;
                        }
                    }
                } else {
                    errorMsg = `CH API Error: ${profileRes.status}`;
                }

            } catch (e: any) {
                errorMsg = e.message;
            }
        } else {
            factors.push({ id: 'no_api', label: 'API Key Missing', points: 0, description: 'Dev mode' });
        }

        if (errorMsg) {
            console.error('[ScanFinancials] Error:', errorMsg);
        }

        // Clamp
        score = Math.max(0, Math.min(100, score));
        band = score >= 75 ? 'Very Strong' : score >= 60 ? 'Strong' : score >= 40 ? 'Medium' : score >= 25 ? 'Weak' : 'Very Weak';

        // 5. Persist Canonical
        await prisma.companyProspect.update({
            where: { id: prospect.id },
            data: {
                // Canonical New Fields
                financialHealthStatus: 'success',
                financialHealthScore: score,
                financialHealthLabel: band,
                financialHealthVersion: 1,
                financialHealthTraceId: traceId,
                financialHealthLastSurface: surface,
                financialHealthLastWriter: 'api/scan/financials',
                financialLastCheckedAt: now,
                financialHealthError: null,

                // Legacy Field Backfill (for rollback)
                financialActivityScore: score,
                financialActivityBand: band,

                // Stored Report
                finHealthData: JSON.stringify({
                    version: 1,
                    score,
                    label: band,
                    factors,
                    traceId,
                    computedAt: now.toISOString()
                }),

                // Side Effect: Incorp Date
                ...(incorporationDate && {
                    incorporatedOn: incorporationDate,
                    incorporatedOnSource: 'companies_house',
                    incorporatedOnLastSyncedAt: now
                })
            }
        });

        // 6. Return Canonical State
        return NextResponse.json({
            status: 'complete',
            message: 'Financial scan completed',
            traceId,

            // Canonical Readback Structure
            updatedCompanyHealth: {
                companyId: prospect.id,
                financialHealthStatus: 'success',
                financialHealthScore: score,
                financialHealthLabel: band,
                financialHealthVersion: 1,
                financialLastCheckedAt: now.toISOString()
            },

            _trace: {
                traceId,
                factorsCount: factors.length,
                score,
                label: band
            }
        });

    } catch (error: any) {
        console.error('[ScanFinancials] Fatal:', error);

        return NextResponse.json({
            status: 'failed',
            error: error.message,
            traceId
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
            financialActivityScore: true,
            financialActivityBand: true,
            financialLastCheckedAt: true,
            finHealthData: true
        }
    });

    if (!prospect) {
        return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    let finHealth: any = null;
    if (prospect.finHealthData) {
        try {
            finHealth = JSON.parse(prospect.finHealthData);
        } catch (e) { }
    }

    return NextResponse.json({
        score: finHealth?.score ?? prospect.financialActivityScore,
        band: finHealth?.band ?? prospect.financialActivityBand,
        factors: finHealth?.factors ?? [],
        lastScannedAt: prospect.financialLastCheckedAt
    });
}
