export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
    computeQueue,
    getQueueSortOrder,
    type UniboxQueue
} from '@/lib/services/unibox-queue';

type SortBy = 'priority' | 'recency';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const queue = (searchParams.get('queue') || 'ALL') as UniboxQueue | 'ALL';
        const sortBy = (searchParams.get('sort') || 'priority') as SortBy;
        const search = searchParams.get('search') || '';

        // Build base where clause
        let where: any = {};

        // Search filter
        if (search.trim()) {
            where.OR = [
                { subject: { contains: search, mode: 'insensitive' } },
                { lead: { companyName: { contains: search, mode: 'insensitive' } } },
                { formattedTo: { contains: search, mode: 'insensitive' } }
            ];
        }

        // Fetch all emails with lead data
        const sentEmails = await prisma.sentEmail.findMany({
            where,
            include: {
                lead: {
                    select: {
                        id: true,
                        companyName: true,
                        industry: true,
                        websiteUrl: true,
                        companyProspect: {
                            select: {
                                id: true,
                                displayBrandName: true,
                                websiteDomain: true,
                                contactPriorityBand: true,
                                financialActivityBand: true
                            }
                        }
                    }
                }
            },
            orderBy: getQueueSortOrder(queue, sortBy),
            take: 200
        });

        // Compute queue for each email and filter
        const emailsWithQueue = sentEmails.map(email => ({
            ...email,
            computedQueue: computeQueue(email)
        }));

        // Filter by queue if not ALL
        const filteredEmails = queue === 'ALL'
            ? emailsWithQueue
            : emailsWithQueue.filter(e => e.computedQueue === queue);

        // Compute counts for each queue
        const counts = {
            all: emailsWithQueue.length,
            needsReply: emailsWithQueue.filter(e => e.computedQueue === 'NEEDS_REPLY').length,
            followUpDue: emailsWithQueue.filter(e => e.computedQueue === 'FOLLOW_UP_DUE').length,
            waiting: emailsWithQueue.filter(e => e.computedQueue === 'WAITING').length,
            replied: emailsWithQueue.filter(e => e.computedQueue === 'REPLIED').length,
            bounced: emailsWithQueue.filter(e => e.computedQueue === 'BOUNCED').length
        };

        return NextResponse.json({
            sentEmails: filteredEmails,
            counts,
            meta: {
                queue,
                sortBy,
                search,
                total: filteredEmails.length
            }
        });

    } catch (e: any) {
        console.error('Unibox API error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
