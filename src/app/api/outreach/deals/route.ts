export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Outcome stages for Kanban
export const OUTCOME_STAGES = [
    { key: 'NEW', label: 'New', color: 'gray' },
    { key: 'INTERESTED', label: 'Interested', color: 'blue' },
    { key: 'CALL_BOOKED', label: 'Call Booked', color: 'purple' },
    { key: 'PROPOSAL_SENT', label: 'Proposal', color: 'amber' },
    { key: 'WON', label: 'Won', color: 'green' },
    { key: 'LOST', label: 'Lost', color: 'gray' },
    { key: 'NOT_INTERESTED', label: 'Not Interested', color: 'red' }
];

/**
 * GET /api/outreach/deals
 * Get all deals grouped by outcome stage for Kanban view
 */
export async function GET(req: NextRequest) {
    try {
        const deals = await prisma.sentEmail.findMany({
            where: {
                // Only show threads with some activity
                OR: [
                    { replyDetectedAt: { not: null } },
                    { conversationOutcome: { not: null } },
                    { status: { in: ['REPLIED', 'FOLLOW_UP_DUE', 'FOLLOWED_UP'] } }
                ]
            },
            select: {
                id: true,
                subject: true,
                formattedTo: true,
                sentAt: true,
                status: true,
                conversationOutcome: true,
                replyIntent: true,
                replySummary: true,
                replyConfidence: true,
                nextActionDate: true,
                dealNotes: true,
                lastInboundAt: true,
                lastOutboundAt: true,
                outcomeSetAt: true,
                lead: {
                    select: {
                        id: true,
                        companyName: true,
                        industry: true,
                        companyProspect: {
                            select: {
                                displayBrandName: true,
                                contactPriorityBand: true,
                                financialActivityBand: true
                            }
                        }
                    }
                }
            },
            orderBy: [
                { lastInboundAt: 'desc' },
                { updatedAt: 'desc' }
            ],
            take: 200
        });

        // Group by outcome stage
        const grouped: Record<string, typeof deals> = {};

        for (const stage of OUTCOME_STAGES) {
            grouped[stage.key] = [];
        }

        for (const deal of deals) {
            const outcome = deal.conversationOutcome || 'NEW';
            if (grouped[outcome]) {
                grouped[outcome].push(deal);
            } else {
                grouped['NEW'].push(deal);
            }
        }

        // Counts per stage
        const counts: Record<string, number> = {};
        for (const stage of OUTCOME_STAGES) {
            counts[stage.key] = grouped[stage.key].length;
        }

        return NextResponse.json({
            deals: grouped,
            counts,
            total: deals.length,
            stages: OUTCOME_STAGES
        });

    } catch (e: any) {
        console.error('[Deals API] Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

/**
 * PATCH /api/outreach/deals
 * Update deal outcome (for drag-drop)
 */
export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();
        const { emailId, outcome, nextActionDate, dealNotes } = body;

        if (!emailId) {
            return NextResponse.json({ error: 'emailId required' }, { status: 400 });
        }

        const updateData: any = {
            outcomeSetAt: new Date(),
            outcomeSetBy: 'user',
            manualOutcomeOverride: true,
            lastActivityAt: new Date()
        };

        if (outcome !== undefined) {
            updateData.conversationOutcome = outcome;
            updateData.kanbanColumn = outcome;
        }

        if (nextActionDate !== undefined) {
            updateData.nextActionDate = nextActionDate ? new Date(nextActionDate) : null;
        }

        if (dealNotes !== undefined) {
            updateData.dealNotes = dealNotes;
        }

        const updated = await prisma.sentEmail.update({
            where: { id: Number(emailId) },
            data: updateData
        });

        return NextResponse.json({
            success: true,
            deal: {
                id: updated.id,
                conversationOutcome: updated.conversationOutcome,
                nextActionDate: updated.nextActionDate,
                dealNotes: updated.dealNotes
            }
        });

    } catch (e: any) {
        console.error('[Deals API] PATCH Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
