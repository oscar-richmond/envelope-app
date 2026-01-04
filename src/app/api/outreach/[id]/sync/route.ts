export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { gmailService } from '@/lib/services/gmail';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const msgId = parseInt(id);

        const message = await prisma.outreachMessage.findUnique({
            where: { id: msgId },
            include: { contact: true }
        });

        if (!message || !message.contact?.email) {
            return NextResponse.json({ error: 'Invalid message or missing email' }, { status: 400 });
        }

        // 1. Check Limits (Throttling)
        const conn = await prisma.gmailAccount.findFirst();
        if (!conn) return NextResponse.json({ error: 'Gmail not connected' }, { status: 403 });
        if (conn.sentToday >= conn.dailyLimit) {
            return NextResponse.json({ error: 'Daily limit reached' }, { status: 429 });
        }

        // 2. Create Draft in Gmail
        const draft = await gmailService.createDraft(
            message.contact.email,
            message.subject,
            message.body
        );

        // 3. Update DB
        const updated = await prisma.outreachMessage.update({
            where: { id: msgId },
            data: {
                status: 'QUEUED', // or READY
                gmailDraftId: draft.id,
                gmailMessageId: draft.message?.id
            }
        });

        // Increment counters? Only if we actually SENT. For drafts, maybe not count against limit?
        // Requirements say "Log sentAt... status: DRAFTED | READY | SENT".
        // If we just made a draft, we are "READY" in our specific workflow (ready to be sent from Gmail).

        return NextResponse.json(updated);

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
    }
}
