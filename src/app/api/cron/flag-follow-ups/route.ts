export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { addBusinessDays } from '@/lib/utils/business-days';
import { followUpPriority } from '@/lib/services/followup-priority';
import { outreachGenerator } from '@/lib/services/outreach-generator';

/**
 * Flag Follow-Ups Cron Job
 * 
 * Runs to evaluate sent emails and create/update follow-up queue items:
 * 1. Find emails where nextFollowUpAt <= now and status is SENT
 * 2. Apply suppression rules (replied, closed, skipped, snoozed, too old)
 * 3. Calculate priority score
 * 4. Create FollowUpQueueItem with draft content
 * 5. Update SentEmail status to ACTION_NEEDED
 */
export async function GET(req: NextRequest) {
    const debug: string[] = [];

    try {
        // Load settings
        const settings = await prisma.settings.findFirst();
        const fu1Delay = settings?.followUpDelayDays || 4;
        const fu2Delay = settings?.followUp2DelayDays || 7;
        const fu2Enabled = settings?.followUp2Enabled || false;
        const maxAgeDays = settings?.maxFollowUpAgeDays || 45;

        const now = new Date();
        const maxAgeDate = new Date(now);
        maxAgeDate.setDate(maxAgeDate.getDate() - maxAgeDays);

        debug.push(`Settings: FU1=${fu1Delay} days, FU2=${fu2Delay} days (${fu2Enabled ? 'enabled' : 'disabled'}), maxAge=${maxAgeDays} days`);

        // Find eligible emails for follow-up
        // Status: SENT (for FU1) or FOLLOWED_UP (for FU2 if enabled)
        const eligibleStatuses = ['SENT'];
        if (fu2Enabled) {
            eligibleStatuses.push('FOLLOWED_UP');
        }

        const candidates = await prisma.sentEmail.findMany({
            where: {
                status: { in: eligibleStatuses },
                // Not replied
                replyDetectedAt: null,
                // Not skipped
                followUpSkipped: false,
                // Not snoozed (or snooze expired)
                OR: [
                    { followUpSnoozedUntil: null },
                    { followUpSnoozedUntil: { lte: now } }
                ],
                // Not too old
                sentAt: { gte: maxAgeDate },
                // Due for follow-up (or never had nextFollowUpAt set)
                OR: [
                    { nextFollowUpAt: null },
                    { nextFollowUpAt: { lte: now } }
                ]
            },
            include: {
                lead: {
                    include: {
                        companyProspect: true
                    }
                },
                followUpQueueItems: {
                    where: { status: 'QUEUED' }
                }
            },
            orderBy: { sentAt: 'asc' },
            take: 50 // Batch size
        });

        debug.push(`Found ${candidates.length} candidates`);

        let flagged = 0;
        let queued = 0;
        let skipped = 0;

        for (const email of candidates) {
            // Determine which follow-up number this is
            const followUpNumber = email.followUpCount + 1; // 0->1, 1->2

            // Skip if FU2 but not enabled
            if (followUpNumber > 1 && !fu2Enabled) {
                skipped++;
                continue;
            }

            // Skip if already have FU2 sent
            if (followUpNumber > 2) {
                skipped++;
                continue;
            }

            // Calculate due date based on follow-up number
            const baseDate = email.lastFollowUpSentAt || email.sentAt;
            const delayDays = followUpNumber === 1 ? fu1Delay : fu2Delay;
            const dueAt = addBusinessDays(baseDate, delayDays);

            // Check if actually due
            if (dueAt > now) {
                // Not due yet, update nextFollowUpAt if not set
                if (!email.nextFollowUpAt) {
                    await prisma.sentEmail.update({
                        where: { id: email.id },
                        data: { nextFollowUpAt: dueAt }
                    });
                }
                continue;
            }

            debug.push(`Processing: ${email.subject} (FU ${followUpNumber})`);

            // Skip if already has a queued item for this follow-up
            if (email.followUpQueueItems.length > 0) {
                debug.push(`-- Already has queued item, skipping`);
                continue;
            }

            // Calculate priority score
            const prospect = email.lead.companyProspect;
            const priorityResult = followUpPriority.calculate({
                opportunityScore: prospect?.contactPriorityScore || 0,
                financialActivityScore: prospect?.financialActivityScore || 0,
                stalenessScore: prospect?.stalenessScore || 0,
                dueAt,
                now
            });

            debug.push(`-- Priority: ${priorityResult.score} (${priorityResult.reasonSummary})`);

            // Extract recipient info
            const recipientEmail = extractEmail(email.formattedTo);
            const recipientFirstName = extractFirstName(email.formattedTo);

            // Get canonical company name
            const companyName = prospect
                ? outreachGenerator.getCanonicalName(prospect)
                : email.lead.companyName;

            // Generate draft content
            const drafts = outreachGenerator.generateFollowUpDrafts(
                email.subject,
                companyName,
                recipientFirstName,
                followUpNumber
            );

            // Create queue item
            await prisma.followUpQueueItem.create({
                data: {
                    sentEmailId: email.id,
                    recipientEmail,
                    followUpNumber,
                    dueAt,
                    priorityScore: priorityResult.score,
                    status: 'QUEUED',
                    draftSubject: `Re: ${email.subject}`,
                    draftBodyText: drafts.callFirst,
                    draftBodyHtml: null, // Plain text for now
                    draftVariant: 'call-first'
                }
            });

            queued++;

            // Update SentEmail
            await prisma.sentEmail.update({
                where: { id: email.id },
                data: {
                    status: 'FOLLOW_UP_DUE',
                    followUpPriorityScore: priorityResult.score,
                    followUpReasonSummary: priorityResult.reasonSummary
                }
            });

            flagged++;
        }

        debug.push(`Flagged: ${flagged}, Queued: ${queued}, Skipped: ${skipped}`);

        return NextResponse.json({
            success: true,
            flagged,
            queued,
            skipped,
            debug
        });

    } catch (e: any) {
        console.error('Flag follow-ups error:', e);
        return NextResponse.json({ error: e.message, debug }, { status: 500 });
    }
}

// Helper functions
function extractEmail(formatted: string): string {
    const match = formatted.match(/<(.+)>/);
    return match ? match[1] : formatted;
}

function extractFirstName(formatted: string): string | null {
    // "Oscar Richmond <oscar@example.com>" -> "Oscar"
    const nameMatch = formatted.match(/^([^<]+)</);
    if (nameMatch) {
        const fullName = nameMatch[1].trim();
        const firstName = fullName.split(' ')[0];
        if (firstName && firstName.length > 1) {
            return firstName;
        }
    }
    return null;
}
