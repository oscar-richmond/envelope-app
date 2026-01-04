export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma'; // Prisma is usually robust on lazy connect

// Lazy types
import { CompanySearchCriteria, CompanySearchResult } from '@/lib/providers';

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
                                ? { score: db.contactPriorityScore, band: db.contactPriorityBand }
                                : priorityCalculator.calculate(
                                    db.stalenessScore || 0,
                                    db.financialActivityScore || 0,
                                    db.websiteConfidence || 'LOW'
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
                            return r;
                        }
                    }
                    return r;
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
                return NextResponse.json(results);
            }
        }

        return NextResponse.json(results);
    } catch (error: any) {
        console.error("Prospect search FATAL:", error);
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
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

        const prospect = await prisma.companyProspect.upsert({
            where: { companyNumber: body.companyNumber },
            update: {
                // Update fields if they exist in body and are newer? 
                // For now, just simplistic update of key info if provided
                companyName: body.companyName,
                websiteUrl: body.websiteUrl,
                industry: body.industry,
                location: body.location,
                // Do not overwrite analysis data blindly
            },
            create: {
                companyNumber: body.companyNumber,
                companyName: body.companyName,
                companyStatus: body.companyStatus || 'active',
                companyType: body.companyType,
                incorporationDate: body.incorporationDate, // Ensure format?
                industry: body.industry,
                location: body.location,
                websiteUrl: body.websiteUrl,
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
