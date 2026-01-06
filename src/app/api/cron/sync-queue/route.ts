export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Queue Integrity Sync Cron Job
 * 
 * Ensures Inbox ↔ Follow-Up Queue consistency:
 * 1. If state = ACTION_NEEDED and no queue item → create one
 * 2. If queue item exists but state ≠ ACTION_NEEDED → remove it
 * 3. If reply exists and queue item exists → remove queue item
 * 4. If CLOSED and queue item exists → remove queue item
 * 
 * This prevents "ghost" items caused by race conditions.
 */
export async function GET(req: NextRequest) {
    const debug: string[] = [];
    let fixed = 0;
    let removed = 0;

    try {
        debug.push(`Starting queue integrity sync at ${new Date().toISOString()}`);

        // 1. Find orphaned queue items (queue exists but shouldn't)
        // These are items where the parent email has a reply, is closed, or is not ACTION_NEEDED
        const orphanedItems = await prisma.followUpQueueItem.findMany({
            where: {
                status: 'QUEUED',
                sentEmail: {
                    OR: [
                        { replyDetectedAt: { not: null } }, // Has reply
                        { status: 'CLOSED' },                // Is closed
                        { status: 'REPLIED' },               // Is replied
                        { followUpSkipped: true }            // Manually skipped
                    ]
                }
            },
            include: {
                sentEmail: {
                    select: { id: true, status: true, replyDetectedAt: true }
                }
            }
        });

        debug.push(`Found ${orphanedItems.length} orphaned queue items`);

        for (const item of orphanedItems) {
            debug.push(`Removing orphaned item ${item.id} (email ${item.sentEmail.id}: status=${item.sentEmail.status})`);

            await prisma.followUpQueueItem.update({
                where: { id: item.id },
                data: { status: 'SKIPPED' }
            });
            removed++;
        }

        // 2. Find emails that should have queue items but don't
        // Status = FOLLOW_UP_DUE (ACTION_NEEDED) but no QUEUED item exists
        const missingQueueEmails = await prisma.sentEmail.findMany({
            where: {
                status: 'FOLLOW_UP_DUE',
                replyDetectedAt: null,
                followUpSkipped: false,
                OR: [
                    { followUpSnoozedUntil: null },
                    { followUpSnoozedUntil: { lte: new Date() } }
                ],
                followUpQueueItems: {
                    none: { status: 'QUEUED' }
                }
            },
            include: {
                lead: {
                    include: { companyProspect: true }
                }
            },
            take: 20 // Batch limit
        });

        debug.push(`Found ${missingQueueEmails.length} emails missing queue items`);

        for (const email of missingQueueEmails) {
            // Only create if truly missing - recheck
            const existingQueued = await prisma.followUpQueueItem.findFirst({
                where: { sentEmailId: email.id, status: 'QUEUED' }
            });

            if (!existingQueued) {
                debug.push(`Creating missing queue item for email ${email.id}`);

                // Calculate follow-up number
                const followUpNumber = email.followUpCount + 1;

                // Extract recipient email
                const recipientEmail = extractEmail(email.formattedTo);

                await prisma.followUpQueueItem.create({
                    data: {
                        sentEmailId: email.id,
                        recipientEmail,
                        followUpNumber,
                        dueAt: email.nextFollowUpAt || new Date(),
                        priorityScore: email.followUpPriorityScore || 0,
                        status: 'QUEUED',
                        draftSubject: `Re: ${email.subject}`,
                        draftBodyText: 'Draft pending regeneration',
                        draftVariant: 'polite'
                    }
                });
                fixed++;
            }
        }

        // 3. Fix emails stuck in FOLLOW_UP_DUE but have a reply
        const stuckWithReply = await prisma.sentEmail.findMany({
            where: {
                status: { in: ['FOLLOW_UP_DUE', 'ACTION_NEEDED'] },
                replyDetectedAt: { not: null }
            }
        });

        debug.push(`Found ${stuckWithReply.length} emails stuck with reply`);

        for (const email of stuckWithReply) {
            debug.push(`Fixing stuck email ${email.id} -> REPLIED`);

            await prisma.sentEmail.update({
                where: { id: email.id },
                data: { status: 'REPLIED' }
            });

            // Also remove any queue items
            await prisma.followUpQueueItem.updateMany({
                where: { sentEmailId: email.id, status: 'QUEUED' },
                data: { status: 'SKIPPED' }
            });
            fixed++;
        }

        // 4. Ensure snoozed items are not in queue
        const snoozedWithQueue = await prisma.followUpQueueItem.findMany({
            where: {
                status: 'QUEUED',
                sentEmail: {
                    followUpSnoozedUntil: { gt: new Date() }
                }
            }
        });

        debug.push(`Found ${snoozedWithQueue.length} snoozed items still in queue`);

        for (const item of snoozedWithQueue) {
            debug.push(`Removing snoozed item ${item.id}`);

            await prisma.followUpQueueItem.update({
                where: { id: item.id },
                data: { status: 'SKIPPED' }
            });
            removed++;
        }

        debug.push(`Integrity sync complete: ${fixed} fixed, ${removed} removed`);

        return NextResponse.json({
            success: true,
            fixed,
            removed,
            debug
        });

    } catch (e: any) {
        console.error('Queue integrity sync error:', e);
        return NextResponse.json({ error: e.message, debug }, { status: 500 });
    }
}

function extractEmail(formatted: string): string {
    const match = formatted.match(/<(.+)>/);
    return match ? match[1] : formatted;
}
