export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma'; // Prisma is usually robust on lazy connect

// Lazy types
import { CompanySearchCriteria, CompanySearchResult } from '@/lib/providers';

// Helper to compute stats from a result set
function computeStats(results: any[]) {
    let highOpportunity = 0;
    let likelyOutdated = 0;
    let strongFinancials = 0;
    let withContacts = 0;

    for (const r of results) {
        // High Opportunity: contactPriorityBand == "High" OR score >= 70
        if (r.contactPriorityBand === 'High' || (r.contactPriorityScore && r.contactPriorityScore >= 70)) {
            highOpportunity++;
        }

        // Likely Outdated: stalenessScore >= 60 OR label contains "Outdated"
        if ((r.stalenessScore && r.stalenessScore >= 60) || r.stalenessLabel === 'Outdated') {
            likelyOutdated++;
        }

        // Strong Financials: band is "Strong" or "Very Strong"
        if (r.financialActivityBand === 'Strong' || r.financialActivityBand === 'Very Strong') {
            strongFinancials++;
        }

        // With Contacts: has discovered emails or contacts
        if (r.contactCount > 0 || r.emailsFound > 0 || (r.discoveredEmails && r.discoveredEmails.length > 0)) {
            withContacts++;
        }
    }

    return {
        highOpportunity,
        likelyOutdated,
        strongFinancials,
        withContacts
    };
}

// --- GET Handler (Pure Debug) ---
export async function GET() {
    return NextResponse.json({
        status: 'API Online',
        timestamp: new Date().toISOString(),
        env: {
            NODE_ENV: process.env.NODE_ENV,
            HAS_KEY: !!process.env.COMPANIES_HOUSE_API_KEY
        }
    });
}

// --- POST Handler ---
export async function POST(request: Request) {
    try {
        // Dynamic import of providers to catch initialization errors
        const { companySearchProvider } = await import('@/lib/providers');
        const { priorityCalculator } = await import('@/lib/services/priority-calculator');

        const body = await request.json();

        // Parse Age Range - now supports arrays (OR logic)
        let minAge: number | undefined, maxAge: number | undefined;
        const ageRanges = Array.isArray(body.ageRange) ? body.ageRange : (body.ageRange ? [body.ageRange] : []);

        // For array of age ranges, use the broadest range (min of mins, max of maxes)
        if (ageRanges.length > 0) {
            const parsedAges: { min?: number; max?: number }[] = [];
            for (const range of ageRanges) {
                if (range === '2-5') parsedAges.push({ min: 2, max: 5 });
                else if (range === '5-10') parsedAges.push({ min: 5, max: 10 });
                else if (range === '10+') parsedAges.push({ min: 10 });
            }
            if (parsedAges.length > 0) {
                // Use broadest range for CH API (min of all mins, max of all maxes)
                minAge = Math.min(...parsedAges.map(p => p.min ?? 0));
                const maxAges = parsedAges.map(p => p.max).filter((m): m is number => m !== undefined);
                maxAge = maxAges.length > 0 ? Math.max(...maxAges) : undefined;
            }
        }

        // Size - now supports arrays (passed to provider as array)
        const sizes = Array.isArray(body.size) ? body.size : (body.size ? [body.size] : []);

        const criteria: CompanySearchCriteria = {
            industry: body.industry === 'All' ? undefined : body.industry,
            location: body.location,
            size: sizes.length > 0 ? sizes : undefined,
            minAge,
            maxAge,
            query: body.query || undefined
        };

        // --- DEBUG INJECTION ---
        if (!process.env.COMPANIES_HOUSE_API_KEY) {
            console.warn("[API] COMPANIES_HOUSE_API_KEY is missing");
        }
        // -----------------------

        console.log(`[API] Searching with criteria: ${JSON.stringify(criteria)}`);
        let results: CompanySearchResult[] = [];
        try {
            results = await companySearchProvider.search(criteria);
            console.log(`[API] Search returned ${results.length} results`);

        } catch (searchError) {
            console.error('[API] Provider search failed:', searchError);
            // Non-fatal, just return empty or error structure if critical
            return NextResponse.json({ error: 'Search provider failed' }, { status: 502 });
        }

        // Merge with DB Data
        if (results.length > 0) {
            try {
                const numbers = results.map(r => r.companyNumber).filter(Boolean);

                const existing = await prisma.companyProspect.findMany({
                    where: { companyNumber: { in: numbers as string[] } }
                });

                const map = new Map(existing.map((e: any) => [e.companyNumber, e]));

                const merged = results.map(r => {
                    const db: any = map.get(r.companyNumber);
                    if (db) {
                        try {
                            const calcResults = db.contactPriorityBand
                                ? { score: db.contactPriorityScore, band: db.contactPriorityBand, evidence: [] }
                                : priorityCalculator.calculate({
                                    stalenessScore: db.stalenessScore || 0,
                                    financialScore: db.financialActivityScore || 0,
                                    financialActivityBand: db.financialActivityBand,
                                    websiteConfidence: db.websiteConfidence || 'LOW',
                                    websiteUrl: db.websiteUrl || r.websiteUrl,
                                    incorporatedOn: db.incorporatedOn || r.incorporationDate
                                });

                            return {
                                ...r,
                                id: db.id,
                                // Financials
                                financialActivityScore: db.financialActivityScore,
                                financialActivityBand: db.financialActivityBand,
                                financialSignals: db.financialSignals,
                                financialLastCheckedAt: db.financialLastCheckedAt,

                                // Website & Matching
                                websiteUrl: db.websiteUrl || r.websiteUrl,
                                websiteMatchStatus: db.websiteMatchStatus,
                                websiteConfidence: db.websiteConfidence,
                                websiteMatchEvidence: db.websiteMatchEvidence,
                                websiteDiscoveryMethod: db.websiteDiscoveryMethod,
                                websiteMatchFailureReason: db.websiteMatchFailureReason,
                                websiteLastMatchedAt: db.websiteLastMatchedAt,

                                // Staleness
                                stalenessScore: db.stalenessScore,
                                stalenessConfidence: db.stalenessConfidence,
                                scoreReasons: db.scoreReasons,
                                signals: db.signals,
                                lastAnalysedAt: db.lastAnalysedAt || db.lastAnalyzedAt,

                                // Contact Priority
                                contactPriorityScore: calcResults.score,
                                contactPriorityBand: calcResults.band,
                                contactPriorityEvidence: calcResults.evidence || [],
                                contactPriorityLastCalculatedAt: db.contactPriorityLastCalculatedAt,

                                // Incorporation Date
                                incorporatedOn: db.incorporatedOn || r.incorporationDate
                            };
                        } catch (mapError) {
                            console.error(`[API] Error mapping company ${r.companyNumber}:`, mapError);
                            return r;
                        }
                    }
                    return r;
                });

                // Apply filters to merged results
                let filtered = merged;

                // 1. Financial Filter
                if (body.minFinancialScore) {
                    const minBand = body.minFinancialScore;
                    const scoreMap: Record<string, number> = { 'Low': 0, 'Medium': 1, 'Strong': 2, 'Very Strong': 3 };
                    const minVal = scoreMap[minBand] || 0;

                    filtered = filtered.filter((r: any) => {
                        const rBand = r.financialActivityBand || 'Unknown';
                        if (rBand === 'Unknown') return true;
                        return (scoreMap[rBand] || 0) >= minVal;
                    });
                }

                // 2. Registered Recently Filter
                if (body.registeredRecently) {
                    const now = new Date();
                    let cutoffDate: Date | null = null;

                    switch (body.registeredRecently) {
                        case '7d': cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
                        case '14d': cutoffDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000); break;
                        case '30d': cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
                        case '2m': cutoffDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000); break;
                        case '3m': cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); break;
                        case '4m': cutoffDate = new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000); break;
                        case '5m': cutoffDate = new Date(now.getTime() - 150 * 24 * 60 * 60 * 1000); break;
                        case '6m': cutoffDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000); break;
                    }

                    if (cutoffDate) {
                        filtered = filtered.filter((r: any) => {
                            // Must have incorporatedOn to be included when filter is active
                            if (!r.incorporatedOn) return false;
                            const incDate = new Date(r.incorporatedOn);
                            return incDate >= cutoffDate!;
                        });
                    }
                }

                // Compute stats from filtered results
                const stats = computeStats(filtered);

                return NextResponse.json({
                    results: filtered,
                    total: filtered.length,
                    stats
                });
            } catch (dbError) {
                console.error('[API] DB Merge failed:', dbError);
                const stats = computeStats(results);
                return NextResponse.json({
                    results,
                    total: results.length,
                    stats
                });
            }
        }

        const stats = computeStats(results);
        return NextResponse.json({
            results,
            total: results.length,
            stats
        });
    } catch (error: any) {
        console.error("Prospect search FATAL:", error);
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}


// --- PUT Handler (Save/Upsert Prospect) ---
export async function PUT(request: Request) {
    try {
        const body = await request.json();

        // Basic validation
        if (!body.companyNumber || !body.companyName) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Parse incorporation date if present
        const incorporatedOn = body.incorporationDate ? new Date(body.incorporationDate) : undefined;

        const prospect = await prisma.companyProspect.upsert({
            where: { companyNumber: body.companyNumber },
            update: {
                // Update fields if they exist in body and are newer? 
                // For now, just simplistic update of key info if provided
                companyName: body.companyName,
                websiteUrl: body.websiteUrl,
                industry: body.industry,
                registeredLocation: body.location,
                // Only update incorporatedOn if we have a new value
                ...(incorporatedOn && {
                    incorporatedOn,
                    incorporatedOnSource: 'companies_house',
                    incorporatedOnLastSyncedAt: new Date()
                })
            },
            create: {
                companyNumber: body.companyNumber,
                companyName: body.companyName,
                industry: body.industry,
                registeredLocation: body.location,
                websiteUrl: body.websiteUrl,
                ...(incorporatedOn && {
                    incorporatedOn,
                    incorporatedOnSource: 'companies_house',
                    incorporatedOnLastSyncedAt: new Date()
                }),
                // Init scores
                stalenessScore: 0,
                financialActivityScore: 0,
                contactPriorityScore: 0
            }
        });

        return NextResponse.json(prospect);
    } catch (error: any) {
        console.error("PUT /api/prospects error:", error);
        return NextResponse.json({ error: 'Failed to save prospect', details: error.message }, { status: 500 });
    }
}
