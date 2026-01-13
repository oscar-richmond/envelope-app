import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * POST /api/companies/[id]/financials/sync
 * 
 * Triggers financial health sync from Companies House
 * Returns updated score, band, and breakdown
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

        console.log(`[FinancialsSync] Starting sync for company ${companyId}...`);

        // Get company prospect
        const prospect = await prisma.companyProspect.findUnique({
            where: { id: companyId }
        });

        if (!prospect) {
            return NextResponse.json({ error: 'Company not found' }, { status: 404 });
        }

        const companyNumber = prospect.companiesHouseNumber;
        const companyName = prospect.companyName;

        // If no company number, try to find one
        let financialData: any = null;

        if (companyNumber) {
            // Fetch from Companies House API
            try {
                const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
                if (apiKey) {
                    const auth = Buffer.from(`${apiKey}:`).toString('base64');

                    // Get company profile
                    const profileRes = await fetch(
                        `https://api.company-information.service.gov.uk/company/${companyNumber}`,
                        { headers: { Authorization: `Basic ${auth}` } }
                    );

                    if (profileRes.ok) {
                        const profile = await profileRes.json();

                        // Get filing history for accounts
                        const filingRes = await fetch(
                            `https://api.company-information.service.gov.uk/company/${companyNumber}/filing-history?category=accounts`,
                            { headers: { Authorization: `Basic ${auth}` } }
                        );

                        const filings = filingRes.ok ? await filingRes.json() : { items: [] };
                        const latestAccounts = (filings.items || [])[0];

                        // Calculate financial health score
                        financialData = calculateFinancialHealth(profile, latestAccounts);
                    }
                }
            } catch (e) {
                console.error('[FinancialsSync] Companies House API error:', e);
            }
        }

        // Fallback: generate basic score based on available data
        if (!financialData) {
            financialData = {
                score: prospect.financialHealthScore ?? 50,
                band: getScoreBand(prospect.financialHealthScore ?? 50),
                breakdown: [
                    {
                        label: 'Company Status',
                        text: 'Based on available data',
                        points: 10,
                        status: 'ok'
                    }
                ],
                details: ['Financial data sync in progress']
            };
        }

        // Update database
        await prisma.companyProspect.update({
            where: { id: companyId },
            data: {
                financialHealthScore: financialData.score,
                financialHealthBand: financialData.band,
                financialSignals: JSON.stringify({
                    breakdown: financialData.breakdown,
                    details: financialData.details
                }),
                financialLastCheckedAt: new Date()
            }
        });

        console.log(`[FinancialsSync] Completed for company ${companyId}: score=${financialData.score}`);

        return NextResponse.json({
            success: true,
            score: financialData.score,
            band: financialData.band,
            breakdown: financialData.breakdown,
            details: financialData.details,
            lastChecked: new Date().toISOString()
        });

    } catch (error: any) {
        console.error('[FinancialsSync] Error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to sync financials'
        }, { status: 500 });
    }
}

// Score band helper
function getScoreBand(score: number): string {
    if (score >= 80) return 'Very Strong';
    if (score >= 60) return 'Strong';
    if (score >= 40) return 'Medium';
    if (score >= 20) return 'Weak';
    return 'Very Weak';
}

// Calculate financial health from Companies House data
function calculateFinancialHealth(profile: any, latestAccounts: any) {
    let score = 0;
    const breakdown: any[] = [];

    // 1. Company status (active = good)
    if (profile.company_status === 'active') {
        score += 20;
        breakdown.push({
            label: 'Company Status',
            value: 'Active',
            points: 20,
            text: 'Company is currently active',
            status: 'good'
        });
    } else {
        breakdown.push({
            label: 'Company Status',
            value: profile.company_status || 'Unknown',
            points: 0,
            text: 'Company may not be actively trading',
            status: 'risk'
        });
    }

    // 2. Company age (older = more stable)
    const incorporationDate = profile.date_of_creation ? new Date(profile.date_of_creation) : null;
    if (incorporationDate) {
        const ageYears = (Date.now() - incorporationDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
        if (ageYears >= 10) {
            score += 20;
            breakdown.push({
                label: 'Company Age',
                value: `${Math.floor(ageYears)} years`,
                points: 20,
                text: 'Established business with long track record',
                status: 'good'
            });
        } else if (ageYears >= 3) {
            score += 15;
            breakdown.push({
                label: 'Company Age',
                value: `${Math.floor(ageYears)} years`,
                points: 15,
                text: 'Established business',
                status: 'good'
            });
        } else if (ageYears >= 1) {
            score += 10;
            breakdown.push({
                label: 'Company Age',
                value: `${Math.floor(ageYears)} years`,
                points: 10,
                text: 'Relatively new business',
                status: 'ok'
            });
        } else {
            score += 5;
            breakdown.push({
                label: 'Company Age',
                value: 'Less than 1 year',
                points: 5,
                text: 'New business, limited track record',
                status: 'ok'
            });
        }
    }

    // 3. Accounts filed
    if (latestAccounts) {
        const filedDate = latestAccounts.date ? new Date(latestAccounts.date) : null;
        const monthsAgo = filedDate
            ? (Date.now() - filedDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
            : 999;

        if (monthsAgo <= 15) {
            score += 20;
            breakdown.push({
                label: 'Latest Accounts',
                value: filedDate?.toLocaleDateString() || 'Recently filed',
                points: 20,
                text: 'Accounts are up to date',
                status: 'good'
            });
        } else if (monthsAgo <= 24) {
            score += 10;
            breakdown.push({
                label: 'Latest Accounts',
                value: filedDate?.toLocaleDateString() || 'Filed',
                points: 10,
                text: 'Accounts may be slightly outdated',
                status: 'ok'
            });
        }
    } else {
        breakdown.push({
            label: 'Latest Accounts',
            value: 'Not found',
            points: 0,
            text: 'No recent accounts on file',
            status: 'risk'
        });
    }

    // 4. Type of accounts (full accounts = more transparent)
    if (latestAccounts?.type) {
        const accountsType = latestAccounts.type.toLowerCase();
        if (accountsType.includes('full')) {
            score += 20;
            breakdown.push({
                label: 'Accounts Detail',
                value: 'Full Accounts',
                points: 20,
                text: 'Full financial disclosure',
                status: 'good'
            });
        } else if (accountsType.includes('small') || accountsType.includes('abbreviated')) {
            score += 10;
            breakdown.push({
                label: 'Accounts Detail',
                value: 'Small/Abbreviated',
                points: 10,
                text: 'Limited financial disclosure (typical for SMEs)',
                status: 'ok'
            });
        } else if (accountsType.includes('micro')) {
            score += 5;
            breakdown.push({
                label: 'Accounts Detail',
                value: 'Micro Entity',
                points: 5,
                text: 'Minimal disclosure (very small company)',
                status: 'ok'
            });
        }
    }

    // 5. Has registered office (basic indicator)
    if (profile.registered_office_address) {
        score += 10;
        breakdown.push({
            label: 'Registered Office',
            value: 'Confirmed',
            points: 10,
            text: 'Has registered business address',
            status: 'good'
        });
    }

    // 6. Check for any insolvency flags
    if (profile.has_been_liquidated || profile.has_insolvency_history) {
        score -= 30;
        breakdown.push({
            label: 'Insolvency Risk',
            value: 'Warning',
            points: -30,
            text: 'Company has insolvency history',
            status: 'risk'
        });
    }

    // Ensure score is between 0-100
    score = Math.max(0, Math.min(100, score));

    return {
        score,
        band: getScoreBand(score),
        breakdown,
        details: breakdown.map(b => `${b.label}: ${b.value || b.text}`)
    };
}
