/**
 * Unibox Queue Determination Service
 * 
 * Computes the action-based queue for each email thread
 * based on deterministic logic rather than fragile status inference.
 */

import { SentEmail } from '@prisma/client';

// Queue types for the Unibox
export type UniboxQueue =
    | 'NEEDS_REPLY'
    | 'FOLLOW_UP_DUE'
    | 'WAITING'
    | 'REPLIED'
    | 'BOUNCED';

export interface QueuedEmail extends SentEmail {
    computedQueue: UniboxQueue;
}

/**
 * Compute which queue an email belongs to based on its current state.
 * Priority order:
 * 1. BOUNCED - Delivery failed
 * 2. NEEDS_REPLY - Inbound received, we haven't replied
 * 3. FOLLOW_UP_DUE - Follow-up is due, no recent inbound
 * 4. REPLIED - Has reply but conversation handled
 * 5. WAITING - Default: sent, awaiting response
 */
export function computeQueue(email: SentEmail): UniboxQueue {
    // 1. Bounced/Failed takes highest priority
    if (email.status === 'BOUNCED' || email.deliveryError) {
        return 'BOUNCED';
    }

    // 2. Needs Reply: inbound message after our last outbound, not closed
    if (
        email.lastInboundAt &&
        email.lastOutboundAt &&
        email.lastInboundAt > email.lastOutboundAt &&
        !email.closedAt
    ) {
        return 'NEEDS_REPLY';
    }

    // 3. Follow-Up Due: scheduled and now due, no recent inbound
    const now = new Date();
    if (
        email.nextFollowUpAt &&
        new Date(email.nextFollowUpAt) <= now &&
        !email.followUpSkipped &&
        !email.closedAt &&
        (!email.lastInboundAt || (email.lastOutboundAt && email.lastOutboundAt > email.lastInboundAt))
    ) {
        return 'FOLLOW_UP_DUE';
    }

    // 4. Replied: has reply detected (includes closed conversations)
    if (email.replyDetectedAt || email.closedAt) {
        return 'REPLIED';
    }

    // 5. Default: Waiting for response
    return 'WAITING';
}

/**
 * Get Prisma where clause for a specific queue filter
 */
export function getQueueWhereClause(queue: UniboxQueue | 'ALL'): any {
    const now = new Date();

    switch (queue) {
        case 'BOUNCED':
            return {
                OR: [
                    { status: 'BOUNCED' },
                    { deliveryError: { not: null } }
                ]
            };

        case 'NEEDS_REPLY':
            // Has inbound after outbound, not closed, not bounced
            return {
                lastInboundAt: { not: null },
                closedAt: null,
                status: { not: 'BOUNCED' },
                deliveryError: null,
                // We use raw SQL or compute in app layer for comparison
            };

        case 'FOLLOW_UP_DUE':
            return {
                nextFollowUpAt: { lte: now },
                followUpSkipped: false,
                closedAt: null,
                status: { notIn: ['BOUNCED', 'CLOSED'] },
                deliveryError: null,
                // Either no inbound, or we've replied to inbound
                OR: [
                    { lastInboundAt: null },
                    // lastOutboundAt > lastInboundAt check done in app layer
                ]
            };

        case 'REPLIED':
            return {
                OR: [
                    { replyDetectedAt: { not: null } },
                    { closedAt: { not: null } }
                ],
                status: { not: 'BOUNCED' },
                deliveryError: null
            };

        case 'WAITING':
            return {
                closedAt: null,
                replyDetectedAt: null,
                status: { notIn: ['BOUNCED', 'CLOSED'] },
                deliveryError: null,
                OR: [
                    { nextFollowUpAt: null },
                    { nextFollowUpAt: { gt: now } }
                ],
                // No pending inbound (lastInboundAt check done in app layer)
            };

        case 'ALL':
        default:
            return {};
    }
}

/**
 * Get sort order for a queue
 */
export function getQueueSortOrder(
    queue: UniboxQueue | 'ALL',
    sortBy: 'priority' | 'recency' = 'priority'
): any[] {
    // Recency sort for all queues when explicitly requested
    if (sortBy === 'recency') {
        return [{ updatedAt: 'desc' }, { sentAt: 'desc' }];
    }

    // Priority-based sorting per queue
    switch (queue) {
        case 'NEEDS_REPLY':
            // High intent score first, then recency
            return [
                { replyConfidence: 'desc' }, // Intent score proxy
                { lastInboundAt: 'desc' }
            ];

        case 'FOLLOW_UP_DUE':
            // High opportunity first, then most overdue
            return [
                { followUpPriorityScore: 'desc' },
                { nextFollowUpAt: 'asc' } // Most overdue first
            ];

        case 'WAITING':
            // Longest waiting first
            return [{ sentAt: 'asc' }];

        case 'REPLIED':
        case 'BOUNCED':
        case 'ALL':
        default:
            // Most recent activity first
            return [{ updatedAt: 'desc' }];
    }
}

/**
 * Next action label for UI display
 */
export function getNextActionLabel(queue: UniboxQueue): string {
    switch (queue) {
        case 'NEEDS_REPLY':
            return 'Reply needed';
        case 'FOLLOW_UP_DUE':
            return 'Approve follow-up';
        case 'WAITING':
            return 'Waiting for reply';
        case 'REPLIED':
            return 'Conversation active';
        case 'BOUNCED':
            return 'Delivery failed';
        default:
            return '';
    }
}

/**
 * Status badge variant for UI
 */
export function getQueueBadgeVariant(queue: UniboxQueue): 'warning' | 'info' | 'success' | 'error' | 'neutral' {
    switch (queue) {
        case 'NEEDS_REPLY':
            return 'warning'; // Orange
        case 'FOLLOW_UP_DUE':
            return 'info'; // Yellow/Amber
        case 'WAITING':
            return 'neutral'; // Gray
        case 'REPLIED':
            return 'success'; // Green
        case 'BOUNCED':
            return 'error'; // Red
        default:
            return 'neutral';
    }
}
