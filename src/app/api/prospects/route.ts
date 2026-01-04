export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { CompanySearchCriteria, CompanySearchResult, companySearchProvider } from '@/lib/providers';
import { priorityCalculator } from '@/lib/services/priority-calculator';
import prisma from '@/lib/prisma';

// Upsert prospect (for matching or tracking)
export async function PUT(request: Request) {
    try {
        const body = await request.json();

        // Ensure unique constraint on companyNumber
        const prospect = await prisma.companyProspect.upsert({
            where: { companyNumber: body.companyNumber },
            update: {}, // Don't overwrite if exists
            create: {
                companyName: body.companyName,
                companyNumber: body.companyNumber,
                industry: body.industry,
                registeredLocation: body.location,
                source: 'companies_house',
                status: 'NEW',
                sicCodes: Array.isArray(body.sicCodes) ? body.sicCodes.join(',') : body.sicCodes,
                websiteUrl: body.websiteUrl, // If exists from search
            }
        });

        return NextResponse.json(prospect);
    } catch (error) {
        console.error("Prospect upsert failed:", error);
        return NextResponse.json({ error: 'Upsert failed' }, { status: 500 });
    }
}
// Force recompile
export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Parse Age Range
        let minAge, maxAge;
        if (body.ageRange === '2-5') { minAge = 2; maxAge = 5; }
        else if (body.ageRange === '5-10') { minAge = 5; maxAge = 10; }
        else if (body.ageRange === '10+') { minAge = 10; }

        const criteria: CompanySearchCriteria = {
            industry: body.industry === 'All' ? undefined : body.industry,
            location: body.location,
            size: body.size,
            minAge,
            maxAge,
            query: body.query || undefined
        };

        // --- DEBUG INJECTION ---
        if (!process.env.COMPANIES_HOUSE_API_KEY) {
            return NextResponse.json([{
                companyName: "⚠️ DEBUG: API KEY MISSING",
                companyNumber: "000000",
                industry: "Check Vercel Settings",
                location: "Vercel Environment",
                status: "active"
            }]);
        }
        // -----------------------

        console.log(`[API] Searching with criteria: ${JSON.stringify(criteria)}`);
        let results: CompanySearchResult[] = [];
        try {
            results = await companySearchProvider.search(criteria);
            console.log(`[API] Search returned ${results.length} results`);

            // --- DEBUG ZERO RESULTS ---
            if (results.length === 0) {
                return NextResponse.json([{
                    companyName: "⚠️ DEBUG: API CONNECTED BUT 0 RESULTS",
                    companyNumber: "111111",
                    industry: "Try broader filters",
                    location: "Companies House",
                    status: "active"
                }]);
            }
            // --------------------------

        } catch (searchError) {
            console.error('[API] Provider search failed:', searchError);
            // Fallback to empty to avoid crashing entire route if just provider fails
            results = [];
        }

        // Merge with DB Data
        if (results.length > 0) {
            try {
                const numbers = results.map(r => r.companyNumber).filter(Boolean);
                console.log(`[API] Querying DB for ${numbers.length} companies`);

                const existing = await prisma.companyProspect.findMany({
                    where: { companyNumber: { in: numbers as string[] } }
                });
                console.log(`[API] Found ${existing.length} existing records`);

                const map = new Map(existing.map((e: any) => [e.companyNumber, e]));

                const merged = results.map(r => {
                    const db: any = map.get(r.companyNumber);
                    if (db) {
                        try {
                            const calcResults = db.contactPriorityBand
                                ? { score: db.contactPriorityScore, band: db.contactPriorityBand }
                                : priorityCalculator.calculate(
                                    db.stalenessScore || 0,
                                    db.financialActivityScore || 0,
                                    db.websiteConfidence || 'LOW' // Pass confidence!
                                );

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
                                contactPriorityLastCalculatedAt: db.contactPriorityLastCalculatedAt
                            };
                        } catch (mapError) {
                            console.error(`[API] Error mapping company ${r.companyNumber}:`, mapError);
                            return r; // Fallback to raw result
                        }
                    }
                    return r; // New/Unsaved
                });

                // Apply Financial Filter
                if (body.minFinancialScore) {
                    const minBand = body.minFinancialScore;
                    const scoreMap: Record<string, number> = { 'Low': 0, 'Medium': 1, 'Strong': 2, 'Very Strong': 3 };
                    const minVal = scoreMap[minBand] || 0;

                    return NextResponse.json(merged.filter((r: any) => {
                        const rBand = r.financialActivityBand || 'Unknown';
                        if (rBand === 'Unknown') return true;
                        return (scoreMap[rBand] || 0) >= minVal;
                    }));
                }

                return NextResponse.json(merged);
            } catch (dbError) {
                console.error('[API] DB Merge failed:', dbError);
                // Return raw results if DB fails, don't 500
                return NextResponse.json(results);
            }
        }

        return NextResponse.json(results);
    } catch (error: any) {
        console.error("Prospect search FATAL:", error);
        return NextResponse.json({ error: 'Search failed', details: error.toString() }, { status: 500 });
    }
}
