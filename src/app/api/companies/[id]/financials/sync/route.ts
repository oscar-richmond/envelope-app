import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { resolveCompanyIdentityOrError } from '@/lib/resolveCompanyIdentity';
import { type Factor, type ReportResult, computeScoreFromFactors } from '@/lib/scoring';

const FINANCIAL_BASE_SCORE = 0; // Financial starts at 0, adds points for each positive indicator

/**
 * POST /api/companies/[id]/financials/sync
 * 
 * Triggers financial health sync from Companies House
 * Returns updated score, band, and breakdown
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
            console.warn(`[FinancialsSync] Company resolution failed for: ${rawId}`);
            return NextResponse.json({
                error: resolved.error,
                errorCode: resolved.errorCode,
                hint: resolved.hint
            }, { status: 400 });
        }

        const companyId = resolved.companyId;
        console.log(`[FinancialsSync] Starting sync for company ${companyId}...`);

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

        const companyNumber = prospect.companyNumber;

        // Collect factors from Companies House data
        const factors: Factor[] = [];

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

                        // Build factors from real Companies House data
                        buildFactorsFromCompaniesHouse(factors, profile, latestAccounts);
                    }
                }
            } catch (e) {
                console.error('[FinancialsSync] Companies House API error:', e);
            }
        }

        // If no factors collected, add a "no data" factor
        if (factors.length === 0) {
            factors.push({
                id: 'no_data',
                label: 'Limited data available',
                points: 0,
                polarity: 'negative',
                description: 'No Companies House data found'
            });
        }

        // Compute score from factors (single source of truth)
        const score = computeScoreFromFactors(FINANCIAL_BASE_SCORE, factors);

        // Determine band label
        let band = 'Medium';
        if (score >= 70) band = 'Strong';
        else if (score < 40) band = 'Weak';

        // Build ReportResult
        const report: ReportResult = {
            score,
            statusLabel: band,
            factors,
            computedAt: new Date().toISOString(),
            confidence: factors.length >= 3 ? 'high' : factors.length >= 2 ? 'medium' : 'low',
            baseScore: FINANCIAL_BASE_SCORE
        };

        // Convert factors to legacy breakdown format for compatibility
        const breakdown = factors.map(f => ({
            label: f.label,
            points: f.points,
            text: f.description || f.label,
            status: f.polarity === 'positive' ? 'good' : (f.points < 0 ? 'risk' : 'ok')
        }));

        // Build finHealthData with report
        const finHealthData = {
            ...report,
            breakdown, // Keep legacy format too
            details: factors.map(f => f.label)
        };

        // Update database - persist scoring engine result
        await prisma.companyProspect.update({
            where: { id: companyId },
            data: {
                financialActivityScore: score,
                financialActivityBand: band,
                financialSignals: JSON.stringify({ breakdown, details: finHealthData.details }),
                finHealthData: JSON.stringify(finHealthData),
                financialLastCheckedAt: new Date()
            }
        });

        console.log(`[FinancialsSync] Completed for company ${companyId}: score=${score}`);

        return NextResponse.json({
            success: true,
            score,
            band,
            factors,
            breakdown,
            status: 'COMPLETE',
            lastChecked: new Date().toISOString()
        });

    } catch (error: any) {
        console.error('[FinancialsSync] Error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to sync financials'
        }, { status: 500 });
    }
}

/**
 * Build factors from Companies House data - all factors are real, not fabricated
 */
function buildFactorsFromCompaniesHouse(factors: Factor[], profile: any, latestAccounts: any) {
    // 1. Company status
    if (profile.company_status === 'active') {
        factors.push({
            id: 'status_active',
            label: 'Company is active',
            points: 20,
            polarity: 'positive',
            description: 'Listed as active on Companies House'
        });
    } else if (profile.company_status) {
        factors.push({
            id: 'status_inactive',
            label: `Status: ${profile.company_status}`,
            points: -10,
            polarity: 'negative',
            description: 'Company may not be actively trading'
        });
    }

    // 2. Company age
    const incorporationDate = profile.date_of_creation ? new Date(profile.date_of_creation) : null;
    if (incorporationDate) {
        const ageYears = (Date.now() - incorporationDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
        if (ageYears >= 10) {
            factors.push({
                id: 'age_established',
                label: 'Established company (10+ years)',
                points: 20,
                polarity: 'positive',
                description: `Operating since ${incorporationDate.getFullYear()}`
            });
        } else if (ageYears >= 3) {
            factors.push({
                id: 'age_mature',
                label: `Company age: ${Math.floor(ageYears)} years`,
                points: 15,
                polarity: 'positive',
                description: 'Established business'
            });
        } else if (ageYears >= 1) {
            factors.push({
                id: 'age_young',
                label: `Company age: ${Math.floor(ageYears)} years`,
                points: 10,
                polarity: 'positive',
                description: 'Relatively new business'
            });
        } else {
            factors.push({
                id: 'age_new',
                label: 'Company less than 1 year old',
                points: 5,
                polarity: 'negative',
                description: 'Limited track record'
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
            factors.push({
                id: 'accounts_current',
                label: 'Accounts are up to date',
                points: 20,
                polarity: 'positive',
                description: `Filed ${filedDate?.toLocaleDateString()}`
            });
        } else if (monthsAgo <= 24) {
            factors.push({
                id: 'accounts_aging',
                label: 'Accounts may be slightly outdated',
                points: 10,
                polarity: 'positive',
                description: `Filed ${filedDate?.toLocaleDateString()}`
            });
        }
    }

    // 4. Type of accounts
    if (latestAccounts?.type) {
        const accountsType = latestAccounts.type.toLowerCase();
        if (accountsType.includes('full')) {
            factors.push({
                id: 'accounts_full',
                label: 'Full accounts filed',
                points: 20,
                polarity: 'positive',
                description: 'Full financial disclosure'
            });
        } else if (accountsType.includes('small') || accountsType.includes('abbreviated')) {
            factors.push({
                id: 'accounts_small',
                label: 'Small/Abbreviated accounts',
                points: 10,
                polarity: 'positive',
                description: 'Limited disclosure (typical for SMEs)'
            });
        } else if (accountsType.includes('micro')) {
            factors.push({
                id: 'accounts_micro',
                label: 'Micro entity accounts',
                points: 5,
                polarity: 'positive',
                description: 'Minimal disclosure'
            });
        }
    }

    // 5. Registered office
    if (profile.registered_office_address) {
        factors.push({
            id: 'office_confirmed',
            label: 'Registered office confirmed',
            points: 10,
            polarity: 'positive',
            description: 'Has registered business address'
        });
    }

    // 6. Insolvency flags
    if (profile.has_been_liquidated || profile.has_insolvency_history) {
        factors.push({
            id: 'insolvency_risk',
            label: 'Insolvency history found',
            points: -30,
            polarity: 'negative',
            description: 'Company has insolvency history'
        });
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

/**
 * GET /api/companies/[id]/financials/sync
 * 
 * Returns current financial health status including full breakdown
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
                finHealthData: true, // This contains the full report with factors
                financialActivityScore: true,
                financialActivityBand: true,
                financialLastCheckedAt: true,
                companiesHouseNumber: true
            }
        });

        if (!prospect) {
            return NextResponse.json({ error: 'Company not found' }, { status: 404 });
        }

        // Parse finHealthData to get full report including factors
        let report: any = null;
        if (prospect.finHealthData) {
            try {
                report = JSON.parse(prospect.finHealthData as string);
            } catch (e) {
                console.error('[FinancialHealth] Failed to parse finHealthData:', e);
            }
        }

        // Determine scan state
        let scanState = 'not_scanned';
        if (report?.status === 'failed') {
            scanState = 'failed';
        } else if (report?.score !== null && report?.score !== undefined) {
            scanState = 'scanned';
        } else if (prospect.financialActivityScore) {
            scanState = 'scanned';
        }

        // Get factors - synthesize from legacy data if needed
        let factors = report?.factors ?? [];

        // If we have a score but no factors (legacy data), synthesize factors
        if (factors.length === 0 && (report?.score !== null || prospect.financialActivityScore !== null)) {
            const score = report?.score ?? prospect.financialActivityScore ?? 0;

            // Check if we have breakdown to convert to factors
            if (report?.breakdown && Array.isArray(report.breakdown) && report.breakdown.length > 0) {
                factors = report.breakdown.map((b: any, i: number) => ({
                    id: `breakdown-${i}`,
                    label: b.label || b.text || `Factor ${i + 1}`,
                    points: b.points || (b.value === 'Positive' ? 10 : b.value === 'Negative' ? -10 : 0),
                    polarity: (b.value === 'Positive' || b.points > 0 ? 'positive' : 'negative') as 'positive' | 'negative',
                    description: b.text || b.description || ''
                }));
            } else {
                // Create a summary factor based on the score
                const band = prospect.financialActivityBand || 'Unknown';
                factors = [{
                    id: 'legacy-score',
                    label: band === 'Strong' || band === 'Very Strong' ? 'Financial health is strong' :
                        band === 'Medium' ? 'Financial health is moderate' : 'Financial health needs attention',
                    points: score - 50, // Approximate points from score
                    polarity: (score >= 50 ? 'positive' : 'negative') as 'positive' | 'negative',
                    description: 'Rescan this company to see detailed breakdown'
                }];
            }
        }

        // Return full report data
        return NextResponse.json({
            score: report?.score ?? prospect.financialActivityScore ?? null,
            statusLabel: report?.statusLabel ?? prospect.financialActivityBand ?? 'Not scanned',
            factors,
            breakdown: report?.breakdown ?? [],
            confidence: report?.confidence ?? (factors.length > 2 ? 'medium' : 'low'),
            baseScore: report?.baseScore ?? 0,
            computedAt: report?.computedAt ?? null,
            lastScanned: prospect.financialLastCheckedAt,
            companiesHouseNumber: prospect.companiesHouseNumber,
            scanState
        });

    } catch (error: any) {
        console.error('[FinancialHealth] GET error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to get financial health'
        }, { status: 500 });
    }
}
