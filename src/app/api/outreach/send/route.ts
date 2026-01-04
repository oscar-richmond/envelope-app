export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { gmailService } from '@/lib/services/gmail';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { leadId, to, subject, message } = body;

        if (!leadId || !to || !subject || !message) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // 1. Send via Gmail
        const result = await gmailService.sendEmail(to, subject, message);

        // 2. Log Message
        const sentMsg = await prisma.outreachMessage.create({
            data: {
                leadId: leadId,
                subject: subject,
                body: message,
                status: "SENT",
                gmailMessageId: result.id,
                gmailThreadId: result.threadId,
                sentAt: new Date()
            }
        });

        // 3. Update Lead Status
        await prisma.lead.update({
            where: { id: leadId },
            data: {
                emailStatus: "SENT"
            }
        });

        return NextResponse.json({ success: true, messageId: sentMsg.id });

    } catch (error) {
        console.error("Send failed", error);
        return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }
}
