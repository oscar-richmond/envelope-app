export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { gmailService } from '@/lib/services/gmail';
import { addBusinessDays } from '@/lib/utils/business-days';
import { outreachGenerator } from '@/lib/services/outreach-generator';

interface RouteParams {
    params: { id: string };
}

/**
 * PATCH /api/follow-ups/[id]
 * 
 * Handle queue item actions: snooze, skip, close
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
    try {
        const id = parseInt(params.id);
        const body = await req.json();
        const { action, snoozeDays } = body;

        const queueItem = await prisma.followUpQueueItem.findUnique({
            where: { id },
            include: { sentEmail: true }
        });

        if (!queueItem) {
            return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });
        }

        const now = new Date();

        switch (action) {
            case 'SNOOZE': {
                const days = snoozeDays || 4; // Default to 4 business days
                const snoozedUntil = addBusinessDays(now, days);

                // Update queue item
                await prisma.followUpQueueItem.update({
                    where: { id },
                    data: {
                        status: 'SNOOZED',
                        snoozedUntil
                    }
                });

                // Update sent email
                await prisma.sentEmail.update({
                    where: { id: queueItem.sentEmailId },
                    data: {
                        followUpSnoozedUntil: snoozedUntil,
                        nextFollowUpAt: snoozedUntil
                    }
                });

                return NextResponse.json({
                    success: true,
                    action: 'SNOOZED',
                    snoozedUntil
                });
            }

            case 'SKIP': {
                // Mark queue item as skipped
                await prisma.followUpQueueItem.update({
                    where: { id },
                    data: { status: 'SKIPPED' }
                });

                // Mark sent email as skipped (no more follow-ups)
                await prisma.sentEmail.update({
                    where: { id: queueItem.sentEmailId },
                    data: {
                        followUpSkipped: true,
                        status: 'SENT' // Reset to SENT so it stays in inbox
                    }
                });

                return NextResponse.json({
                    success: true,
                    action: 'SKIPPED'
                });
            }

            case 'CLOSE': {
                // Mark queue item as skipped
                await prisma.followUpQueueItem.update({
                    where: { id },
                    data: { status: 'SKIPPED' }
                });

                // Close the thread entirely
                await prisma.sentEmail.update({
                    where: { id: queueItem.sentEmailId },
                    data: {
                        status: 'CLOSED',
                        followUpSkipped: true
                    }
                });

                return NextResponse.json({
                    success: true,
                    action: 'CLOSED'
                });
            }

            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

    } catch (e: any) {
        console.error('Follow-up action error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

/**
 * POST /api/follow-ups/[id]
 * 
 * Send the follow-up email and mark as completed
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
    try {
        const id = parseInt(params.id);
        const body = await req.json();
        const { subject, bodyText, bodyHtml } = body;

        const queueItem = await prisma.followUpQueueItem.findUnique({
            where: { id },
            include: {
                sentEmail: {
                    include: {
                        lead: {
                            include: { companyProspect: true }
                        }
                    }
                }
            }
        });

        if (!queueItem) {
            return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });
        }

        // Get Gmail account
        const account = await prisma.gmailAccount.findFirst();
        if (!account) {
            return NextResponse.json({ error: 'Gmail not connected' }, { status: 400 });
        }

        // Initialize Gmail service
        gmailService.setCredentials({
            access_token: account.accessToken,
            refresh_token: account.refreshToken,
            expiry_date: Number(account.expiryDate)
        });

        // Send in the existing thread
        const result = await gmailService.sendEmailInThread(
            account.email,
            queueItem.recipientEmail,
            subject || queueItem.draftSubject,
            bodyText || queueItem.draftBodyText,
            bodyHtml || queueItem.draftBodyHtml || undefined,
            queueItem.sentEmail.sentThreadId || undefined
        );

        // Mark queue item as completed
        await prisma.followUpQueueItem.update({
            where: { id },
            data: { status: 'COMPLETED' }
        });

        // Update sent email
        const settings = await prisma.settings.findFirst();
        const fu2Delay = settings?.followUp2DelayDays || 7;
        const fu2Enabled = settings?.followUp2Enabled || false;

        const now = new Date();
        const nextFollowUpNumber = queueItem.followUpNumber + 1;

        // Calculate next follow-up date if FU2 is enabled
        let nextFollowUpAt: Date | null = null;
        if (fu2Enabled && nextFollowUpNumber <= 2) {
            nextFollowUpAt = addBusinessDays(now, fu2Delay);
        }

        await prisma.sentEmail.update({
            where: { id: queueItem.sentEmailId },
            data: {
                status: 'FOLLOWED_UP',
                followUpCount: queueItem.followUpNumber,
                lastFollowUpSentAt: now,
                nextFollowUpAt,
                // Clear snoozed state
                followUpSnoozedUntil: null,
                followUpPriorityScore: null,
                followUpReasonSummary: null
            }
        });

        return NextResponse.json({
            success: true,
            messageId: result.id,
            threadId: result.threadId,
            followUpNumber: queueItem.followUpNumber
        });

    } catch (e: any) {
        console.error('Send follow-up error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

/**
 * GET /api/follow-ups/[id]
 * 
 * Get variant drafts for a queue item
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
    try {
        const id = parseInt(params.id);

        const queueItem = await prisma.followUpQueueItem.findUnique({
            where: { id },
            include: {
                sentEmail: {
                    include: {
                        lead: { include: { companyProspect: true } }
                    }
                }
            }
        });

        if (!queueItem) {
            return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });
        }

        // Generate both variants on demand
        const prospect = queueItem.sentEmail.lead.companyProspect;
        const companyName = prospect
            ? outreachGenerator.getCanonicalName(prospect)
            : queueItem.sentEmail.lead.companyName;

        // Extract first name from formatted recipient
        const nameMatch = queueItem.sentEmail.formattedTo.match(/^([^<]+)</);
        let firstName: string | null = null;
        if (nameMatch) {
            firstName = nameMatch[1].trim().split(' ')[0] || null;
        }

        const drafts = outreachGenerator.generateFollowUpDrafts(
            queueItem.sentEmail.subject,
            companyName,
            firstName,
            queueItem.followUpNumber
        );

        return NextResponse.json({
            success: true,
            variants: {
                callFirst: {
                    subject: `Re: ${queueItem.sentEmail.subject}`,
                    bodyText: drafts.callFirst
                },
                emailIdeasFirst: {
                    subject: `Re: ${queueItem.sentEmail.subject}`,
                    bodyText: drafts.emailIdeasFirst
                }
            }
        });

    } catch (e: any) {
        console.error('Get variants error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
