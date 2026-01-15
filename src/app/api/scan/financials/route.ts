import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Financial Scan API
 * 
 * Triggers real financial analysis for a company/lead from Companies House
 */

const COMPANIES_HOUSE_API_KEY = process.env.COMPANIES_HOUSE_API_KEY;

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

        // Check if already scanned recently
        const now = new Date();
        const lastScanned = prospect.financialLastCheckedAt;
        const isStale = !lastScanned || (now.getTime() - lastScanned.getTime()) > 30 * 24 * 60 * 60 * 1000;

        if (!force && !isStale && prospect.financialActivityScore !== null) {
            return NextResponse.json({
                status: 'already_complete',
                message: 'Financials were recently scanned',
                data: {
                    score: prospect.financialActivityScore,
                    band: prospect.financialActivityBand,
                    lastScannedAt: lastScanned,
                    isStale: false
                }
            });
        }

        // Check if company number exists
        const companyNumber = prospect.companyNumber;
        if (!companyNumber) {
            return NextResponse.json({
                status: 'no_company_number',
                message: 'No Companies House number found',
                data: {
                    score: null,
                    error: 'No company number'
                }
            });
        }

        // Build factors array
        const factors: { id: string; label: string; points: number; polarity: string; description: string }[] = [];
        let score = 0;

        // Try to fetch from Companies House
        if (COMPANIES_HOUSE_API_KEY) {
            try {
                const auth = Buffer.from(`${COMPANIES_HOUSE_API_KEY}:`).toString('base64');
                const profileRes = await fetch(
                    `https://api.company-information.service.gov.uk/company/${companyNumber}`,
                    { headers: { Authorization: `Basic ${auth}` } }
                );

                if (profileRes.ok) {
                    const profile = await profileRes.json();

                    // Company status
                    if (profile.company_status === 'active') {
                        factors.push({ id: 'active', label: 'Company is active', points: 25, polarity: 'positive', description: 'Currently trading' });
                        score += 25;
                    } else {
                        factors.push({ id: 'inactive', label: `Company status: ${profile.company_status}`, points: -10, polarity: 'negative', description: 'Not currently active' });
                    }

                    // Accounts
                    if (profile.accounts?.next_due) {
                        const dueDate = new Date(profile.accounts.next_due);
                        const daysUntilDue = Math.floor((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                        if (daysUntilDue > 60) {
                            factors.push({ id: 'accounts_ok', label: 'Accounts up to date', points: 15, polarity: 'positive', description: `Next due in ${daysUntilDue} days` });
                            score += 15;
                        } else if (daysUntilDue > 0) {
                            factors.push({ id: 'accounts_due', label: 'Accounts due soon', points: 5, polarity: 'neutral', description: `Due in ${daysUntilDue} days` });
                            score += 5;
                        } else {
                            factors.push({ id: 'accounts_overdue', label: 'Accounts overdue', points: -10, polarity: 'negative', description: 'Filing overdue' });
                        }
                    }

                    // Company age
                    if (profile.date_of_creation) {
                        const created = new Date(profile.date_of_creation);
                        const yearsOld = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24 * 365));
                        if (yearsOld >= 5) {
                            factors.push({ id: 'established', label: 'Established company', points: 20, polarity: 'positive', description: `${yearsOld} years in business` });
                            score += 20;
                        } else if (yearsOld >= 2) {
                            factors.push({ id: 'growing', label: 'Growing company', points: 10, polarity: 'positive', description: `${yearsOld} years in business` });
                            score += 10;
                        } else {
                            factors.push({ id: 'new', label: 'New company', points: 5, polarity: 'neutral', description: `${yearsOld} years in business` });
                            score += 5;
                        }
                    }

                    // Officers
                    const officersRes = await fetch(
                        `https://api.company-information.service.gov.uk/company/${companyNumber}/officers`,
                        { headers: { Authorization: `Basic ${auth}` } }
                    ).catch(() => null);

                    if (officersRes?.ok) {
                        const officers = await officersRes.json();
                        const activeOfficers = officers.items?.filter((o: any) => !o.resigned_on)?.length || 0;
                        if (activeOfficers >= 2) {
                            factors.push({ id: 'officers', label: 'Multiple directors', points: 10, polarity: 'positive', description: `${activeOfficers} active officers` });
                            score += 10;
                        } else if (activeOfficers === 1) {
                            factors.push({ id: 'sole_director', label: 'Sole director', points: 5, polarity: 'neutral', description: '1 active officer' });
                            score += 5;
                        }
                    }
                }
            } catch (e: any) {
                console.error('[ScanFinancials] Companies House API error:', e);
                factors.push({ id: 'api_error', label: 'Could not fetch CH data', points: 0, polarity: 'neutral', description: e.message });
            }
        } else {
            // No API key - generate basic score based on available data
            factors.push({ id: 'no_api', label: 'Companies House API not configured', points: 0, polarity: 'neutral', description: 'Limited financial data' });
            score = 50; // Default middle score
        }

        // Ensure score is in range
        score = Math.max(0, Math.min(100, score));
        const band = score >= 75 ? 'Very Strong' : score >= 60 ? 'Strong' : score >= 40 ? 'Medium' : score >= 25 ? 'Weak' : 'Very Weak';

        // Persist
        await prisma.companyProspect.update({
            where: { id: prospect.id },
            data: {
                financialActivityScore: score,
                financialActivityBand: band,
                financialLastCheckedAt: now,
                finHealthData: JSON.stringify({
                    score,
                    band,
                    factors,
                    computedAt: now.toISOString(),
                    lastSyncedAt: now.toISOString()
                })
            }
        });

        console.log(`[ScanFinancials] Completed for prospect ${prospect.id}: score=${score}`);

        return NextResponse.json({
            status: 'complete',
            message: 'Financial scan completed',
            data: {
                score,
                band,
                factors,
                lastScannedAt: now
            }
        });

    } catch (error: any) {
        console.error('[ScanFinancials] Error:', error);
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
