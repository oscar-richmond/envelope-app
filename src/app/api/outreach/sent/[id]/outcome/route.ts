export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Canonical Conversation Outcomes
 */
export const CONVERSATION_OUTCOMES = [
    'INTERESTED',     // Positive intent, wants to engage
    'NOT_NOW',        // Timing issue, not rejection
    'NOT_INTERESTED', // Clear rejection, hard suppression
    'REFERRED',       // Passed to another contact
    'NO_RESPONSE',    // Sequence ended with no reply
    'CLOSED'          // Manually closed
] as const;

type ConversationOutcome = typeof CONVERSATION_OUTCOMES[number];

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/outreach/sent/[id]/outcome
 * Get current outcome for an email thread
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const emailId = parseInt(id);

        const email = await prisma.sentEmail.findUnique({
            where: { id: emailId },
            select: {
                id: true,
                conversationOutcome: true,
                outcomeSetAt: true,
                outcomeSetBy: true,
                suggestedOutcome: true,
                suggestedOutcomeConfidence: true,
                manualOutcomeOverride: true,
                replyIntent: true,
                status: true
            }
        });

        if (!email) {
            return NextResponse.json({ error: 'Email not found' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            outcome: email.conversationOutcome,
            outcomeSetAt: email.outcomeSetAt,
            outcomeSetBy: email.outcomeSetBy,
            suggestedOutcome: email.suggestedOutcome,
            suggestedOutcomeConfidence: email.suggestedOutcomeConfidence,
            manualOverride: email.manualOutcomeOverride,
            status: email.status
        });

    } catch (e: any) {
        console.error('Get outcome error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

/**
 * PATCH /api/outreach/sent/[id]/outcome
 * Set or update conversation outcome
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const emailId = parseInt(id);
        const body = await req.json();
        const { outcome } = body;

        // Validate outcome
        if (!CONVERSATION_OUTCOMES.includes(outcome)) {
            return NextResponse.json({ error: 'Invalid outcome' }, { status: 400 });
        }

        const now = new Date();

        // Determine new status based on outcome
        let newStatus: string | undefined;
        let shouldSuppressFollowUps = false;

        switch (outcome) {
            case 'INTERESTED':
                newStatus = 'REPLIED';
                shouldSuppressFollowUps = true;
                break;
            case 'NOT_NOW':
                newStatus = 'REPLIED';
                // Don't suppress - user may schedule reminder
                break;
            case 'NOT_INTERESTED':
                newStatus = 'CLOSED';
                shouldSuppressFollowUps = true;
                break;
            case 'REFERRED':
                newStatus = 'REPLIED';
                shouldSuppressFollowUps = true;
                break;
            case 'NO_RESPONSE':
                newStatus = 'CLOSED';
                shouldSuppressFollowUps = true;
                break;
            case 'CLOSED':
                newStatus = 'CLOSED';
                shouldSuppressFollowUps = true;
                break;
        }

        // Update email with outcome
        const updateData: any = {
            conversationOutcome: outcome,
            outcomeSetAt: now,
            outcomeSetBy: 'user',
            manualOutcomeOverride: true
        };

        if (newStatus) {
            updateData.status = newStatus;
        }

        if (shouldSuppressFollowUps) {
            updateData.followUpSkipped = true;
            updateData.nextFollowUpAt = null;
        }

        await prisma.sentEmail.update({
            where: { id: emailId },
            data: updateData
        });

        // Remove from queue if suppressing
        if (shouldSuppressFollowUps) {
            await prisma.followUpQueueItem.updateMany({
                where: { sentEmailId: emailId, status: 'QUEUED' },
                data: { status: 'SKIPPED' }
            });
        }

        console.log(`[OUTCOME] Email ${emailId} set to ${outcome} by user`);

        return NextResponse.json({
            success: true,
            outcome,
            status: newStatus
        });

    } catch (e: any) {
        console.error('Set outcome error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
