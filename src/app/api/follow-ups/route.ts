export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/follow-ups
 * 
 * Returns the prioritised follow-up queue, sorted by priority score descending.
 * Includes lead/prospect data, original email context, and draft content.
 */
export async function GET(req: NextRequest) {
    try {
        // First, get existing queue items
        const queueItems = await prisma.followUpQueueItem.findMany({
            where: {
                status: 'QUEUED'
            },
            include: {
                sentEmail: {
                    include: {
                        lead: {
                            include: {
                                companyProspect: true
                            }
                        }
                    }
                }
            },
            orderBy: [
                { priorityScore: 'desc' },
                { dueAt: 'asc' }
            ]
        });

        // Get IDs of SentEmails that already have queue items
        const queuedSentEmailIds = queueItems.map(item => item.sentEmailId);

        // Also get SentEmails with FOLLOW_UP_DUE status that don't have queue items yet
        // (This handles the case where dashboard shows follow-ups but queue wasn't populated)
        const additionalDueEmails = await prisma.sentEmail.findMany({
            where: {
                status: 'FOLLOW_UP_DUE',
                id: { notIn: queuedSentEmailIds.length > 0 ? queuedSentEmailIds : [-1] }
            },
            include: {
                lead: {
                    include: {
                        companyProspect: true
                    }
                }
            },
            orderBy: [
                { followUpPriorityScore: 'desc' },
                { nextFollowUpAt: 'asc' }
            ]
        });

        // Format queue items
        const items = queueItems.map(item => {
            const prospect = item.sentEmail.lead.companyProspect;

            return {
                id: item.id,
                followUpNumber: item.followUpNumber,
                dueAt: item.dueAt,
                priorityScore: item.priorityScore,
                draftVariant: item.draftVariant,

                // Draft content
                draft: {
                    subject: item.draftSubject,
                    bodyText: item.draftBodyText,
                    bodyHtml: item.draftBodyHtml
                },

                // Recipient
                recipient: {
                    email: item.recipientEmail,
                    formatted: item.sentEmail.formattedTo
                },

                // Company info
                company: {
                    name: prospect?.displayBrandName ||
                        prospect?.websiteBrandName ||
                        item.sentEmail.lead.companyName,
                    prospectId: prospect?.id,
                    websiteUrl: prospect?.websiteUrl,
                    financialBand: prospect?.financialActivityBand,
                    opportunityBand: prospect?.contactPriorityBand
                },

                // Original email context
                originalEmail: {
                    id: item.sentEmail.id,
                    subject: item.sentEmail.subject,
                    bodyText: item.sentEmail.bodyText,
                    sentAt: item.sentEmail.sentAt,
                    threadId: item.sentEmail.sentThreadId
                },

                // Priority context
                priority: {
                    score: item.priorityScore,
                    reasonSummary: item.sentEmail.followUpReasonSummary,
                    isOverdue: item.dueAt < new Date()
                },

                // Lead ID for navigation
                leadId: item.sentEmail.leadId,

                // Source indicator
                source: 'queue' as const
            };
        });

        // Format additional SentEmails that don't have queue items yet
        // (Generate synthetic queue items for these)
        const additionalItems = additionalDueEmails.map(email => {
            const prospect = email.lead.companyProspect;
            const recipientEmail = extractEmail(email.formattedTo);
            const followUpNumber = email.followUpCount + 1;
            const dueAt = email.nextFollowUpAt || new Date();

            return {
                id: `sent-${email.id}`, // Prefix to distinguish from queue items
                followUpNumber,
                dueAt,
                priorityScore: email.followUpPriorityScore || 50,
                draftVariant: 'call-first',

                // Generate a basic draft - user will need to regenerate in UI
                draft: {
                    subject: `Re: ${email.subject}`,
                    bodyText: `Hi,\n\nI wanted to follow up on my previous email regarding ${prospect?.displayBrandName || email.lead.companyName}.\n\nWould you have a few minutes this week to discuss?\n\nBest regards`,
                    bodyHtml: null
                },

                // Recipient
                recipient: {
                    email: recipientEmail,
                    formatted: email.formattedTo
                },

                // Company info
                company: {
                    name: prospect?.displayBrandName ||
                        prospect?.websiteBrandName ||
                        email.lead.companyName,
                    prospectId: prospect?.id,
                    websiteUrl: prospect?.websiteUrl,
                    financialBand: prospect?.financialActivityBand,
                    opportunityBand: prospect?.contactPriorityBand
                },

                // Original email context
                originalEmail: {
                    id: email.id,
                    subject: email.subject,
                    bodyText: email.bodyText,
                    sentAt: email.sentAt,
                    threadId: email.sentThreadId
                },

                // Priority context
                priority: {
                    score: email.followUpPriorityScore || 50,
                    reasonSummary: email.followUpReasonSummary,
                    isOverdue: dueAt < new Date()
                },

                // Lead ID for navigation
                leadId: email.leadId,

                // Source indicator - needs queue item creation
                source: 'pending' as const
            };
        });

        // Combine both lists, queue items first
        const allItems = [...items, ...additionalItems];

        return NextResponse.json({
            success: true,
            count: allItems.length,
            items: allItems
        });

    } catch (e: any) {
        console.error('Get follow-ups error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// Helper: Extract email from formatted "Name <email>" string
function extractEmail(formatted: string): string {
    const match = formatted.match(/<(.+)>/);
    return match ? match[1] : formatted;
}
