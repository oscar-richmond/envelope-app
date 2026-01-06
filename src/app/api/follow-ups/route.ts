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

        // Format response
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
                leadId: item.sentEmail.leadId
            };
        });

        return NextResponse.json({
            success: true,
            count: items.length,
            items
        });

    } catch (e: any) {
        console.error('Get follow-ups error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
