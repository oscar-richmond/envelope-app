export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { websiteAnalysisService } from '@/lib/services/website-analysis';
import { priorityCalculator } from '@/lib/services/priority-calculator';

const prisma = new PrismaClient();

export async function POST(request: Request) {
    try {
        const { prospectIds, force } = await request.json();

        if (!Array.isArray(prospectIds) || prospectIds.length === 0) {
            return NextResponse.json({ error: "Invalid prospect IDs" }, { status: 400 });
        }

        const results = [];

        for (const id of prospectIds) {
            const prospect = await prisma.companyProspect.findUnique({ where: { id } });

            if (!prospect || !prospect.websiteUrl) {
                results.push({ id, status: 'SKIPPED', reason: 'No website' });
                continue;
            }

            // Skip if recently analysed (unless forced)
            if (prospect.lastAnalysedAt && !force) {
                // simple 7 day freshness check
                const daysSince = (Date.now() - new Date(prospect.lastAnalysedAt).getTime()) / (1000 * 3600 * 24);
                if (daysSince < 7) {
                    results.push({ id, status: 'SKIPPED', reason: 'Recently analysed' });
                    continue;
                }
            }

            // Run Analysis
            // Note: In production, consider queuing this job. For now, sequential await is fine for small batches.
            const analysis = await websiteAnalysisService.analyze(prospect.websiteUrl);

            // Calculate Priority based on new staleness score
            const financialScore = prospect.financialActivityScore || 0;
            const websiteConfidence = prospect.websiteConfidence || 'LOW';

            const { score: pScore, band: pBand } = priorityCalculator.calculate(
                analysis.stalenessScore,
                financialScore,
                websiteConfidence
            );

            // Update DB
            await prisma.companyProspect.update({
                where: { id },
                data: {
                    stalenessScore: analysis.stalenessScore,
                    stalenessConfidence: analysis.confidence,
                    scoreReasons: JSON.stringify(analysis.reasons),
                    signals: JSON.stringify(analysis.signals),
                    lastAnalysedAt: new Date(),
                    contactPriorityScore: pScore,
                    contactPriorityBand: pBand,
                    contactPriorityLastCalculatedAt: new Date()
                }
            });

            results.push({ id, status: 'ANALYSED', score: analysis.stalenessScore });
        }

        return NextResponse.json({ results });

    } catch (error: any) {
        console.error("Analysis failed:", error);
        return NextResponse.json({ error: 'Analysis failed', details: error.message }, { status: 500 });
    }
}
