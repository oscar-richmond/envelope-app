export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const filter = searchParams.get('filter') || 'ALL';

        let where: any = {};

        if (filter === 'WAITING') {
            where.status = { in: ['SENT', 'FOLLOWED_UP'] };
        } else if (filter === 'ACTION_NEEDED') {
            where.status = 'FOLLOW_UP_DUE';
        } else if (filter === 'REPLIED') {
            where.status = 'REPLIED';
        } else if (filter === 'CLOSED') {
            where.status = 'CLOSED';
        }

        const sentEmails = await prisma.sentEmail.findMany({
            where,
            include: {
                lead: {
                    select: {
                        companyName: true,
                        industry: true
                    }
                }
            },
            orderBy: { sentAt: 'desc' },
            take: 100
        });

        // Get counts for badges
        const [actionNeeded, waiting, replied, closed, all] = await Promise.all([
            prisma.sentEmail.count({ where: { status: 'FOLLOW_UP_DUE' } }),
            prisma.sentEmail.count({ where: { status: { in: ['SENT', 'FOLLOWED_UP'] } } }),
            prisma.sentEmail.count({ where: { status: 'REPLIED' } }),
            prisma.sentEmail.count({ where: { status: 'CLOSED' } }),
            prisma.sentEmail.count()
        ]);

        return NextResponse.json({
            sentEmails,
            counts: {
                actionNeeded,
                waiting,
                replied,
                closed,
                all
            }
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
