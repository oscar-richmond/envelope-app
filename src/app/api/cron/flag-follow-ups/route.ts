export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { addBusinessDays, getBusinessDaysBetween } from '@/lib/utils/business-days';
import { followUpPriority } from '@/lib/services/followup-priority';
import { outreachGenerator } from '@/lib/services/outreach-generator';

/**
 * Flag Follow-Ups Cron Job
 * 
 * Implements deterministic, lead-aware follow-up timing:
 * - High Opportunity (70+): FU1 at 3-4 days, FU2 at 6-7 days after FU1
 * - Medium Opportunity (40-69): FU1 at 4-6 days, FU2 at 8-10 days after FU1
 * - Low Opportunity (<40): FU1 only at 6-7 days, no FU2
 * 
 * Eligibility gates:
 * - Status = SENT or FOLLOWED_UP
 * - No reply received
 * - Not CLOSED
 * - Not snoozed (or snooze expired)
 * - Not already in queue
 * - Max 2 follow-ups per contact
 * - Min 3 business days since last message
 */
export async function GET(req: NextRequest) {
    const debug: string[] = [];

    try {
        // Load settings
        const settings = await prisma.settings.findFirst();
        const fu2Enabled = settings?.followUp2Enabled || false;
        const maxAgeDays = settings?.maxFollowUpAgeDays || 45;

        const now = new Date();
        const maxAgeDate = new Date(now);
        maxAgeDate.setDate(maxAgeDate.getDate() - maxAgeDays);

        debug.push(`FU2 Enabled: ${fu2Enabled}, Max Age: ${maxAgeDays} days`);

        // Find eligible emails
        // Status: SENT (for FU1) or FOLLOWED_UP (for FU2 if enabled)
        const eligibleStatuses = ['SENT'];
        if (fu2Enabled) {
            eligibleStatuses.push('FOLLOWED_UP');
        }

        const candidates = await prisma.sentEmail.findMany({
            where: {
                status: { in: eligibleStatuses },
                // No reply received
                replyDetectedAt: null,
                // Not skipped
                followUpSkipped: false,
                // Not snoozed (or snooze expired)
                OR: [
                    { followUpSnoozedUntil: null },
                    { followUpSnoozedUntil: { lte: now } }
                ],
                // Not too old
                sentAt: { gte: maxAgeDate }
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
            // Skip if already has a queued item
            if (email.followUpQueueItems.length > 0) {
                debug.push(`[${email.id}] Already in queue, skipping`);
                continue;
            }

            // Get lead priority score for timing decisions
            const prospect = email.lead.companyProspect;
            const opportunityScore = prospect?.contactPriorityScore || 0;

            // Determine which follow-up number this is
            const followUpNumber = email.followUpCount + 1; // 0->1, 1->2

            // HARD GATE: Max 2 follow-ups
            if (followUpNumber > 2) {
                debug.push(`[${email.id}] Max follow-ups reached (${email.followUpCount})`);
                skipped++;
                continue;
            }

            // ELIGIBILITY: FU2 requires Medium+ opportunity and FU2 enabled
            if (followUpNumber === 2) {
                if (!fu2Enabled) {
                    debug.push(`[${email.id}] FU2 disabled globally`);
                    skipped++;
                    continue;
                }
                if (opportunityScore < 40) {
                    debug.push(`[${email.id}] Low opportunity (${opportunityScore}), no FU2`);
                    skipped++;
                    continue;
                }
            }

            // Calculate lead-aware delay
            const delay = getLeadAwareDelay(opportunityScore, followUpNumber);

            // Calculate due date
            const baseDate = email.lastFollowUpSentAt || email.sentAt;
            const dueAt = addBusinessDays(baseDate, delay);

            // Check if due
            if (dueAt > now) {
                // Not due yet, update nextFollowUpAt if not set
                if (!email.nextFollowUpAt || email.nextFollowUpAt.getTime() !== dueAt.getTime()) {
                    await prisma.sentEmail.update({
                        where: { id: email.id },
                        data: { nextFollowUpAt: dueAt }
                    });
                }
                debug.push(`[${email.id}] Not due yet (due: ${dueAt.toISOString().split('T')[0]})`);
                continue;
            }

            // SAFEGUARD: Min 3 business days since last message
            const lastMessageDate = email.lastFollowUpSentAt || email.sentAt;
            const daysSinceLastMessage = getBusinessDaysBetween(lastMessageDate, now);
            if (daysSinceLastMessage < 3) {
                debug.push(`[${email.id}] Too soon (${daysSinceLastMessage} days since last)`);
                continue;
            }

            debug.push(`[${email.id}] Creating FU${followUpNumber} queue item`);

            // Calculate priority score
            const priorityResult = followUpPriority.calculate({
                opportunityScore,
                financialActivityScore: prospect?.financialActivityScore || 0,
                stalenessScore: prospect?.stalenessScore || 0,
                dueAt,
                now
            });

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

            // Generate reason for transparency
            const reason = generateReason(followUpNumber, delay, opportunityScore);

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
                    draftBodyHtml: null,
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
                    followUpReasonSummary: reason
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

/**
 * Get lead-aware follow-up delay in business days
 * 
 * High (70+): FU1=4, FU2=7
 * Medium (40-69): FU1=5, FU2=9
 * Low (<40): FU1=6, no FU2
 */
function getLeadAwareDelay(opportunityScore: number, followUpNumber: number): number {
    if (opportunityScore >= 70) {
        // High opportunity - faster follow-up
        return followUpNumber === 1 ? 4 : 7;
    } else if (opportunityScore >= 40) {
        // Medium opportunity - standard timing
        return followUpNumber === 1 ? 5 : 9;
    } else {
        // Low opportunity - slower, FU1 only
        return 6;
    }
}

/**
 * Generate human-readable reason for queue entry
 */
function generateReason(followUpNumber: number, delay: number, opportunityScore: number): string {
    const priority = opportunityScore >= 70 ? 'High' : opportunityScore >= 40 ? 'Medium' : 'Low';

    if (followUpNumber === 1) {
        return `No reply after ${delay} days (${priority} priority)`;
    } else {
        return `Second follow-up scheduled (${priority} priority)`;
    }
}

// Helper functions
function extractEmail(formatted: string): string {
    const match = formatted.match(/<(.+)>/);
    return match ? match[1] : formatted;
}

function extractFirstName(formatted: string): string | null {
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
