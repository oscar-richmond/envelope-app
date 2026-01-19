import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const leadId = parseInt(id);

    if (isNaN(leadId)) {
        return NextResponse.json({ error: 'Invalid lead ID' }, { status: 400 });
    }

    try {
        // Find the most recent sent email for this lead
        const sentEmail = await prisma.sentEmail.findFirst({
            where: { leadId },
            orderBy: { sentAt: 'desc' },
            select: { id: true, sentThreadId: true }  // Using sentThreadId instead of gmailThreadId
        });

        if (!sentEmail) {
            return NextResponse.json({
                emailId: null,
                threadId: null,
                hasThread: false
            });
        }

        return NextResponse.json({
            emailId: sentEmail.id,
            threadId: sentEmail.sentThreadId,
            hasThread: true
        });
    } catch (e) {
        console.error('[API] Error fetching lead thread:', e);
        return NextResponse.json({ error: 'Failed to fetch thread' }, { status: 500 });
    }
}
