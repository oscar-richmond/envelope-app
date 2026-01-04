export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { financialAnalysisService } from '@/lib/services/financial-analysis';
import { priorityCalculator } from '@/lib/services/priority-calculator';

export async function POST(request: Request) {
    try {
        const { prospectIds, force } = await request.json();
        const prisma = new (require('@prisma/client').PrismaClient)();

        if (!Array.isArray(prospectIds) || prospectIds.length === 0) {
            return NextResponse.json({ error: "Invalid prospect IDs" }, { status: 400 });
        }

        const results = [];

        for (const id of prospectIds) {
            const prospect = await prisma.companyProspect.findUnique({ where: { id } });

            if (!prospect || !prospect.companyNumber) {
                results.push({ id, status: 'SKIPPED', reason: 'No company number' });
                continue;
            }

            // Skip if recently analysed (unless forced)
            if (prospect.financialLastCheckedAt && !force) {
                const daysSince = (Date.now() - new Date(prospect.financialLastCheckedAt).getTime()) / (1000 * 3600 * 24);
                if (daysSince < 30) { // Monthly check is likely fine for financials
                    results.push({ id, status: 'SKIPPED', reason: 'Recently checked' });
                    continue;
                }
            }

            // Run Analysis
            const analysis = await financialAnalysisService.analyze(prospect.companyNumber);

            // Calculate Priority
            const designScore = prospect.stalenessScore || 0;
            const websiteConfidence = prospect.websiteConfidence || 'LOW';
            const { score: pScore, band: pBand } = priorityCalculator.calculate(designScore, analysis.score, websiteConfidence);

            // Update DB (Use raw query to avoid stale Prisma Client issues during dev)
            const signalsJson = JSON.stringify(analysis.signals);
            const now = new Date();

            try {
                // Try typed update first (including priority)
                await prisma.companyProspect.update({
                    where: { id },
                    data: {
                        financialActivityScore: analysis.score,
                        financialActivityBand: analysis.band,
                        financialSignals: signalsJson,
                        financialLastCheckedAt: now,
                        contactPriorityScore: pScore,
                        contactPriorityBand: pBand,
                        contactPriorityLastCalculatedAt: now
                    }
                });
            } catch (e) {
                console.warn("Typed update failed, falling back to raw SQL:", e);
                // Fallback for stale client
                await prisma.$executeRaw`
                    UPDATE "CompanyProspect" 
                    SET "financialActivityScore" = ${analysis.score}, 
                        "financialActivityBand" = ${analysis.band}, 
                        "financialSignals" = ${signalsJson}, 
                        "financialLastCheckedAt" = ${now},
                        "contactPriorityScore" = ${pScore},
                        "contactPriorityBand" = ${pBand},
                        "contactPriorityLastCalculatedAt" = ${now}
                    WHERE "id" = ${id}
                `;
            }

            results.push({
                id,
                status: 'ANALYSED',
                score: analysis.score,
                band: analysis.band,
                signals: analysis.signals, // Required for UI immediate update
                // Return priority in result for UI update
                contactPriorityScore: pScore,
                contactPriorityBand: pBand
            });
        }

        return NextResponse.json({ results });

    } catch (error: any) {
        console.error("Financial analysis failed:", error);
        return NextResponse.json({ error: 'Financial analysis failed', details: error.message }, { status: 500 });
    }
}
