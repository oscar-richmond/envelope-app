
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { GooglePlacesWebsiteMatcher } from '@/lib/services/google-places';
import { priorityCalculator } from '@/lib/services/priority-calculator';

const prisma = new PrismaClient();
const matcher = new GooglePlacesWebsiteMatcher();

export async function POST(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id: idStr } = await context.params;
        const id = parseInt(idStr);
        if (isNaN(id)) {
            return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
        }

        const body = await request.json().catch(() => ({}));
        const { force } = body;

        const prospect = await prisma.companyProspect.findUnique({
            where: { id }
        });

        if (!prospect) {
            return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });
        }

        // Check if already matched (and not forced)
        if (prospect.websiteMatchStatus === 'MATCHED' && prospect.websiteUrl && !force) {
            return NextResponse.json({
                message: 'Already matched',
                prospect
            });
        }

        // Determine Search Params
        // Prefer Registered Location, fallback to nothing?
        const location = prospect.registeredLocation || undefined;
        // Industry might help if we added it to the query, but service takes (name, loc, ind)

        // Execute Match
        const matchResult = await matcher.match(
            prospect.companyName,
            location || '',
            prospect.industry || ''
        );

        let updateData: any = {
            websiteLastMatchedAt: new Date(),
            websiteMatchEvidence: JSON.stringify(matchResult.evidence)
        };

        if (matchResult.url) {
            updateData.websiteUrl = matchResult.url;
            updateData.websiteConfidence = matchResult.confidence;
            updateData.websiteDiscoveryMethod = 'google_places_v1';
            updateData.websiteMatchStatus = 'MATCHED';
            updateData.websiteMatchFailureReason = null;

            // Recalculate Priority immediately
            // Note: design score/financial might be 0/null still, but confidence changes effective score logic
            const designScore = prospect.stalenessScore || 0;
            const financialScore = prospect.financialActivityScore || 0;
            const websiteConfidence = matchResult.confidence || 'LOW';

            const { score: pScore, band: pBand } = priorityCalculator.calculate(designScore, financialScore, websiteConfidence);

            updateData.contactPriorityScore = pScore;
            updateData.contactPriorityBand = pBand;
            updateData.contactPriorityLastCalculatedAt = new Date();
        } else {
            // Only set status to FAILED/NOT_FOUND if we didn't have one before? 
            // Or if we are forcing, we overwrite.
            updateData.websiteMatchStatus = 'NOT_FOUND';
            updateData.websiteMatchFailureReason = matchResult.evidence?.reason || 'No result found';
        }

        const updated = await prisma.companyProspect.update({
            where: { id },
            data: updateData
        });

        return NextResponse.json({
            prospect: updated,
            matchResult
        });

    } catch (error: any) {
        console.error("Match API Error:", error);
        return NextResponse.json(
            { error: 'Internal Server Error', details: error.message },
            { status: 500 }
        );
    }
}
