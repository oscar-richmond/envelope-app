export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { addBusinessDays, getBusinessDaysBetween } from '@/lib/utils/business-days';
import { followUpPriority } from '@/lib/services/followup-priority';
import { outreachGenerator } from '@/lib/services/outreach-generator';

// Default cadence - business days
const DEFAULT_CADENCE = {
    FU1: 3,  // 3 days after initial email
    FU2: 7,  // 7 days after FU1
    FU3: 14  // 14 days after FU2
};

// Intents that block follow-ups
const BLOCKED_INTENTS = ['NOT_INTERESTED', 'OBJECTION'];

/**
 * Flag Follow-Ups Cron Job
 * 
 * Implements deterministic, lead-aware follow-up timing:
 * - High Opportunity (70+): FU1 at 3 days, FU2 at 6 days, FU3 at 12 days
 * - Medium Opportunity (40-69): FU1 at 4 days, FU2 at 8 days, FU3 at 14 days
 * - Low Opportunity (<40): FU1 at 5 days only, no FU2/FU3
 * 
 * Eligibility gates:
 * - Status = SENT, FOLLOWED_UP, or FOLLOW_UP_DUE
 * - No reply received (or reply intent allows follow-up)
 * - Reply intent NOT in blocking list (NOT_INTERESTED, OBJECTION)
 * - Not under OOO hold
 * - Not CLOSED
 * - Not snoozed (or snooze expired)
 * - Not already in queue
 * - Max 3 follow-ups per contact
 * - Min 3 business days since last message
 */
export async function GET(req: NextRequest) {
    const debug: string[] = [];

    try {
        // Load settings
        const settings = await prisma.settings.findFirst();
        const fu2Enabled = settings?.followUp2Enabled ?? true;
        const fu3Enabled = true; // Always enable FU3 for "Jeeva" experience
        const maxAgeDays = settings?.maxFollowUpAgeDays || 45;
        const maxFollowUps = 3;

        const now = new Date();
        const maxAgeDate = new Date(now);
        maxAgeDate.setDate(maxAgeDate.getDate() - maxAgeDays);

        debug.push(`FU2: ${fu2Enabled}, FU3: ${fu3Enabled}, Max FUs: ${maxFollowUps}, Max Age: ${maxAgeDays}d`);

        // Find eligible emails
        const eligibleStatuses = ['SENT', 'FOLLOWED_UP'];

        const candidates = await prisma.sentEmail.findMany({
            where: {
                status: { in: eligibleStatuses },
                // Not skipped
                followUpSkipped: false,
                // Not exhausted
                followUpStatus: { notIn: ['EXHAUSTED', 'CLOSED', 'PAUSED'] },
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
            take: 50
        });

        debug.push(`Found ${candidates.length} candidates`);

        let flagged = 0;
        let queued = 0;
        let skipped = 0;
        let pausedOOO = 0;
        let blockedByIntent = 0;

        for (const email of candidates) {
            // Skip if already has a queued item
            if (email.followUpQueueItems.length > 0) {
                debug.push(`[${email.id}] Already in queue`);
                continue;
            }

            // ELIGIBILITY: Check reply intent
            if (email.replyIntent && BLOCKED_INTENTS.includes(email.replyIntent)) {
                debug.push(`[${email.id}] Blocked by intent: ${email.replyIntent}`);
                await prisma.sentEmail.update({
                    where: { id: email.id },
                    data: {
                        followUpStatus: 'CLOSED',
                        followUpSkipped: true
                    }
                });
                blockedByIntent++;
                continue;
            }

            // ELIGIBILITY: Check OOO with return date
            if (email.replyIntent === 'AUTO_REPLY' && email.replySummary) {
                // Try to extract return date from summary
                const dateMatch = email.replySummary.match(/\d{4}-\d{2}-\d{2}/);
                if (dateMatch) {
                    const returnDate = new Date(dateMatch[0]);
                    if (returnDate > now) {
                        debug.push(`[${email.id}] OOO until ${dateMatch[0]}, pausing`);
                        await prisma.sentEmail.update({
                            where: { id: email.id },
                            data: {
                                followUpStatus: 'PAUSED',
                                followUpSnoozedUntil: returnDate,
                                followUpReasonSummary: `Out of office until ${dateMatch[0]}`
                            }
                        });
                        pausedOOO++;
                        continue;
                    }
                }
            }

            // ELIGIBILITY: Had a reply that indicates interest - wait for manual reply
            if (email.replyDetectedAt &&
                email.replyIntent &&
                ['POSITIVE', 'NEUTRAL_QUESTION', 'WRONG_PERSON'].includes(email.replyIntent)) {
                debug.push(`[${email.id}] Has ${email.replyIntent} reply, needs manual response`);
                continue;
            }

            // Get lead priority score for timing decisions
            const prospect = email.lead.companyProspect;
            const opportunityScore = prospect?.contactPriorityScore || 0;

            // Determine which follow-up number this is
            const followUpNumber = email.followUpCount + 1;

            // HARD GATE: Max follow-ups
            if (followUpNumber > maxFollowUps) {
                debug.push(`[${email.id}] Max follow-ups reached (${email.followUpCount})`);
                await prisma.sentEmail.update({
                    where: { id: email.id },
                    data: { followUpStatus: 'EXHAUSTED' }
                });
                skipped++;
                continue;
            }

            // ELIGIBILITY: FU2/FU3 requires Medium+ opportunity
            if (followUpNumber >= 2) {
                if (!fu2Enabled && followUpNumber === 2) {
                    debug.push(`[${email.id}] FU2 disabled`);
                    skipped++;
                    continue;
                }
                if (opportunityScore < 40) {
                    debug.push(`[${email.id}] Low opportunity (${opportunityScore}), no FU${followUpNumber}`);
                    await prisma.sentEmail.update({
                        where: { id: email.id },
                        data: { followUpStatus: 'EXHAUSTED' }
                    });
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
                // Not due yet, update tracking
                if (!email.nextFollowUpAt || email.nextFollowUpAt.getTime() !== dueAt.getTime()) {
                    await prisma.sentEmail.update({
                        where: { id: email.id },
                        data: {
                            nextFollowUpAt: dueAt,
                            followUpStatus: 'ELIGIBLE'
                        }
                    });
                }
                debug.push(`[${email.id}] Not due (${dueAt.toISOString().split('T')[0]})`);
                continue;
            }

            // SAFEGUARD: Min 3 business days since last message
            const lastMessageDate = email.lastFollowUpSentAt || email.sentAt;
            const daysSinceLastMessage = getBusinessDaysBetween(lastMessageDate, now);
            if (daysSinceLastMessage < 3) {
                debug.push(`[${email.id}] Too soon (${daysSinceLastMessage}d)`);
                continue;
            }

            debug.push(`[${email.id}] Creating FU${followUpNumber} draft`);

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
                    followUpStatus: 'DRAFT_READY',
                    followUpPriorityScore: priorityResult.score,
                    followUpReasonSummary: reason
                }
            });

            flagged++;
        }

        debug.push(`Flagged: ${flagged}, Queued: ${queued}, Skipped: ${skipped}, Paused (OOO): ${pausedOOO}, Blocked: ${blockedByIntent}`);

        return NextResponse.json({
            success: true,
            flagged,
            queued,
            skipped,
            pausedOOO,
            blockedByIntent,
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
 * High (70+): FU1=3, FU2=6, FU3=12
 * Medium (40-69): FU1=4, FU2=8, FU3=14
 * Low (<40): FU1=5 only, no FU2/FU3
 */
function getLeadAwareDelay(opportunityScore: number, followUpNumber: number): number {
    if (opportunityScore >= 70) {
        // High opportunity - faster follow-up
        const delays = [3, 6, 12];
        return delays[followUpNumber - 1] || 12;
    } else if (opportunityScore >= 40) {
        // Medium opportunity - standard timing
        const delays = [4, 8, 14];
        return delays[followUpNumber - 1] || 14;
    } else {
        // Low opportunity - slower, FU1 only
        return 5;
    }
}

/**
 * Generate human-readable reason for queue entry
 */
function generateReason(followUpNumber: number, delay: number, opportunityScore: number): string {
    const priority = opportunityScore >= 70 ? 'High' : opportunityScore >= 40 ? 'Medium' : 'Low';
    const ordinal = followUpNumber === 1 ? 'First' : followUpNumber === 2 ? 'Second' : 'Third';
    return `${ordinal} follow-up after ${delay} days (${priority} priority)`;
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
