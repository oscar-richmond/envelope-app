export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { gmailService } from '@/lib/services/gmail';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { leadId, to, subject, message, messageText, threadId } = body; // message is HTML, messageText is fallback

        if (!leadId || !to || !subject) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Fallback: If no plaintext provided (old client?), Use message as text (strip tags if possible or just raw)
        // But for new client, messageText is guaranteed.
        const plainBody = messageText || message;

        // 1. Send via Gmail
        const result = await gmailService.sendEmail(to, subject, plainBody, message, threadId);

        // 2. Log Message
        const sentMsg = await prisma.outreachMessage.create({
            data: {
                leadId: leadId,
                subject: subject,
                body: plainBody,
                bodyHtml: message,
                status: "SENT",
                gmailMessageId: result.id,
                gmailThreadId: result.threadId,
                sentAt: new Date()
            }
        });

        // 2b. Log SentEmail (New Workflow)
        // If threading, we might want to update the *existing* SentEmail or create a new one?
        // The plan says "Mark item as followed_up, increment followUpCount".
        // But we need to distinguish new threads from followups.

        let sentEmailStatus = "SENT";
        if (threadId) {
            sentEmailStatus = "FOLLOWED_UP";
            // Find parent and update it? 
            const parent = await prisma.sentEmail.findFirst({ where: { sentThreadId: threadId } });
            if (parent) {
                await prisma.sentEmail.update({
                    where: { id: parent.id },
                    data: {
                        status: 'FOLLOWED_UP',
                        followUpCount: { increment: 1 },
                        lastCheckedAt: new Date(),
                        nextFollowUpAt: null // Clear due date until cron picks it up again? Or set new one?
                        // Plan: "Also support: Snooze follow-up by X days".
                        // Logic: Cron will see LAST sentAt (which we just created) ?? 
                        // Wait, we are creating a NEW SentEmail record below.
                        // If we create a NEW SentEmail for the follow-up, the cron will track THIS one.
                        // And the OLD one (parent) should be marked closed or followed up?
                        // "Mark item as followed_up". 
                    }
                });
            }
        }

        await prisma.sentEmail.create({
            data: {
                leadId: leadId,
                formattedTo: to,
                sentMessageId: result.id || null,
                sentThreadId: result.threadId || null,
                subject: subject,
                bodyText: plainBody,
                bodyHtml: message,
                status: "SENT", // The new message starts as SENT (waiting for reply)
                sentAt: new Date(),
                lastOutboundAt: new Date() // Unibox: track outbound timestamp
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
