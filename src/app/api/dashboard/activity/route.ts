import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        // Recent Outbound
        const recentOutbound = await prisma.sentEmail.findMany({
            where: { status: { not: 'DRAFT' } }, // Exclude drafts if mixed
            orderBy: { sentAt: 'desc' },
            take: 5,
            select: {
                id: true,
                formattedTo: true,
                subject: true,
                sentAt: true,
                status: true,
                lead: {
                    select: {
                        companyName: true
                    }
                }
            }
        });

        // Recent Replies (Assuming filtered by status REPLIED or checking threads)
        // For simplicity, we fetch SentEmails in REPLIED/ACTION_NEEDED status sorted by updated
        const recentReplies = await prisma.sentEmail.findMany({
            where: {
                status: { in: ['REPLIED', 'ACTION_NEEDED'] }
            },
            orderBy: { updatedAt: 'desc' },
            take: 5,
            select: {
                id: true,
                formattedTo: true,
                subject: true,
                updatedAt: true,
                status: true,
                lead: {
                    select: {
                        companyName: true
                    }
                }
            }
        });

        return NextResponse.json({
            recentOutbound,
            recentReplies
        });

    } catch (error) {
        console.error('Dashboard Activity Error:', error);
        return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 });
    }
}
