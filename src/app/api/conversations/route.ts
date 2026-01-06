export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Canonical Kanban Columns
 */
export const KANBAN_COLUMNS = [
    'INTERESTED',      // Positive reply, needs engagement
    'CALL_PROPOSED',   // Call suggested, awaiting scheduling
    'CALL_COMPLETED',  // Call happened, next steps pending
    'PAUSED',          // Not now, waiting for later
    'CLOSED'           // Conversation ended
] as const;

type KanbanColumn = typeof KANBAN_COLUMNS[number];

/**
 * GET /api/conversations
 * Get all conversations for the Kanban board
 * Only returns conversations with qualifying outcomes
 */
export async function GET(req: NextRequest) {
    try {
        // Get conversations with qualifying outcomes
        // Entry criteria: reply received + outcome in {INTERESTED, NOT_NOW, REFERRED}
        const conversations = await prisma.sentEmail.findMany({
            where: {
                replyDetectedAt: { not: null },
                conversationOutcome: { in: ['INTERESTED', 'NOT_NOW', 'REFERRED', 'NOT_INTERESTED', 'CLOSED'] }
            },
            include: {
                lead: {
                    include: {
                        companyProspect: {
                            select: {
                                name: true,
                                domain: true,
                                leadOpportunity: true,
                                financialHealth: true
                            }
                        }
                    }
                }
            },
            orderBy: [
                { lastActivityAt: 'asc' },
                { updatedAt: 'asc' }
            ]
        });

        // Map to Kanban columns
        const columns: Record<KanbanColumn, any[]> = {
            INTERESTED: [],
            CALL_PROPOSED: [],
            CALL_COMPLETED: [],
            PAUSED: [],
            CLOSED: []
        };

        for (const conv of conversations) {
            // Determine column from kanbanColumn or outcome
            let column: KanbanColumn = conv.kanbanColumn as KanbanColumn;

            if (!column) {
                // Auto-map from outcome
                switch (conv.conversationOutcome) {
                    case 'INTERESTED':
                    case 'REFERRED':
                        column = 'INTERESTED';
                        break;
                    case 'NOT_NOW':
                        column = 'PAUSED';
                        break;
                    case 'NOT_INTERESTED':
                    case 'CLOSED':
                        column = 'CLOSED';
                        break;
                    default:
                        column = 'INTERESTED';
                }
            }

            const prospect = conv.lead.companyProspect;
            const lastActivity = conv.lastActivityAt || conv.replyDetectedAt || conv.updatedAt;
            const daysSince = Math.floor((Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24));

            columns[column].push({
                id: conv.id,
                leadId: conv.leadId,
                company: {
                    name: prospect?.name || conv.lead.companyName,
                    domain: prospect?.domain
                },
                contact: {
                    name: extractContactName(conv.formattedTo),
                    email: extractEmail(conv.formattedTo)
                },
                lastActivity: formatTimeAgo(daysSince),
                daysSinceActivity: daysSince,
                badges: {
                    opportunity: prospect?.leadOpportunity || null,
                    financialHealth: prospect?.financialHealth || null
                },
                outcome: conv.conversationOutcome,
                column
            });
        }

        // Count active conversations (exclude Closed)
        const activeCount = conversations.filter(c =>
            c.conversationOutcome !== 'NOT_INTERESTED' &&
            c.conversationOutcome !== 'CLOSED'
        ).length;

        return NextResponse.json({
            success: true,
            columns,
            activeCount,
            total: conversations.length
        });

    } catch (e: any) {
        console.error('Conversations fetch error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

/**
 * PATCH /api/conversations
 * Update conversation column (drag & drop)
 */
export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();
        const { emailId, column } = body;

        if (!KANBAN_COLUMNS.includes(column)) {
            return NextResponse.json({ error: 'Invalid column' }, { status: 400 });
        }

        // Determine new outcome based on column
        let newOutcome: string | undefined;
        let shouldSuppressFollowUps = false;

        switch (column) {
            case 'INTERESTED':
            case 'CALL_PROPOSED':
            case 'CALL_COMPLETED':
                newOutcome = 'INTERESTED';
                shouldSuppressFollowUps = true; // Active conversations don't need automation
                break;
            case 'PAUSED':
                newOutcome = 'NOT_NOW';
                shouldSuppressFollowUps = true;
                break;
            case 'CLOSED':
                // Keep existing outcome if already NOT_INTERESTED
                shouldSuppressFollowUps = true;
                break;
        }

        const updateData: any = {
            kanbanColumn: column,
            lastActivityAt: new Date()
        };

        if (newOutcome) {
            updateData.conversationOutcome = newOutcome;
        }

        if (shouldSuppressFollowUps) {
            updateData.followUpSkipped = true;
            updateData.nextFollowUpAt = null;
        }

        await prisma.sentEmail.update({
            where: { id: emailId },
            data: updateData
        });

        // Remove from queue if present
        if (shouldSuppressFollowUps) {
            await prisma.followUpQueueItem.updateMany({
                where: { sentEmailId: emailId, status: 'QUEUED' },
                data: { status: 'SKIPPED' }
            });
        }

        console.log(`[KANBAN] Email ${emailId} moved to ${column}`);

        return NextResponse.json({
            success: true,
            column,
            outcome: newOutcome
        });

    } catch (e: any) {
        console.error('Conversation update error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

function extractContactName(formatted: string): string {
    const match = formatted.match(/^([^<]+)</);
    return match ? match[1].trim() : formatted.split('@')[0];
}

function extractEmail(formatted: string): string {
    const match = formatted.match(/<(.+)>/);
    return match ? match[1] : formatted;
}

function formatTimeAgo(days: number): string {
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 14) return '1 week ago';
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} month${days >= 60 ? 's' : ''} ago`;
}
