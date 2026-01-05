export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const filter = searchParams.get('filter') || 'ALL'; // ALL, WAITING, ACTION_NEEDED, REPLIED

        let where: any = {};

        if (filter === 'WAITING') {
            where.status = { in: ['SENT', 'FOLLOWED_UP'] };
        } else if (filter === 'ACTION_NEEDED') {
            where.status = 'FOLLOW_UP_DUE';
        } else if (filter === 'REPLIED') {
            where.status = 'REPLIED';
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

        return NextResponse.json({ sentEmails });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
