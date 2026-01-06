
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { placesDetailsService } from '@/lib/services/places-details';
import { profileAIService } from '@/lib/services/profile-ai';

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const prospectId = parseInt(id, 10);

    if (isNaN(prospectId)) {
        return NextResponse.json({ error: 'Invalid prospect ID' }, { status: 400 });
    }

    try {
        let prospect = await prisma.companyProspect.findUnique({
            where: { id: prospectId }
        });

        if (!prospect) {
            return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });
        }

        const updates: string[] = [];

        // 1. Refresh Places details (force)
        if (prospect.placeId) {
            prospect = await placesDetailsService.fetchAndUpdate(prospectId, true) || prospect;
            updates.push('places');
        }

        // 2. Update display name
        await placesDetailsService.updateDisplayName(prospectId);
        updates.push('displayName');

        // 3. Regenerate AI summaries
        prospect = await prisma.companyProspect.findUnique({ where: { id: prospectId } }) || prospect;
        const aiResult = await profileAIService.generateSummaries(prospect);
        if (aiResult) {
            updates.push('ai');
        }

        // Fetch updated prospect
        const updated = await prisma.companyProspect.findUnique({
            where: { id: prospectId }
        });

        return NextResponse.json({
            success: true,
            updated: updates,
            profile: {
                displayName: updated?.displayBrandName,
                aiOneLiner: updated?.aiOneLiner,
                aiOverview: updated?.aiOverview,
                placesLastFetched: updated?.placesDetailsFetchedAt,
                aiGeneratedAt: updated?.aiGeneratedAt
            }
        });

    } catch (error) {
        console.error('Profile refresh error:', error);
        return NextResponse.json({ error: 'Failed to refresh profile' }, { status: 500 });
    }
}
