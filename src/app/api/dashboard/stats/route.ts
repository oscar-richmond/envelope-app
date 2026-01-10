import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        // 1. Prospect Stats
        const prospectsFound = await prisma.lead.count(); // Total leads
        const highOpportunity = await prisma.lead.count({
            where: { stalenessScore: { gt: 75 } } // Reuse stalenessScore as opportunity proxy for now
        });
        const draftsWaiting = await prisma.lead.count({
            where: { emailStatus: 'DRAFTED' }
        });

        // 2. Outreach Stats (Sent Emails)
        // We'll calculate specific statuses from SentEmail table
        const replies = await prisma.sentEmail.count({
            where: { status: 'REPLIED' }
        });
        const followUpsDue = await prisma.sentEmail.count({
            where: { status: 'FOLLOW_UP_DUE' }
        });
        const actionNeeded = await prisma.sentEmail.count({
            where: { status: 'ACTION_NEEDED' }
        });
        const queuedOutreach = await prisma.outreachMessage.count({
            where: { status: 'QUEUED' }
        }); // Fixed: Used OutreachMessage instead of non-existent GeneratedDraft

        return NextResponse.json({
            prospectsFound,
            highOpportunity,
            replies,
            followUpsDue,
            actionNeeded,
            draftsWaiting,
            queuedOutreach
        });

    } catch (error) {
        console.error('Dashboard Stats Error:', error);
        return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }
}
