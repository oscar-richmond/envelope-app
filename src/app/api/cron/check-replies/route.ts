export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { gmailService } from '@/lib/services/gmail';

export async function GET(req: NextRequest) {
    try {
        // 1. Find emails awaiting reply
        const sentEmails = await prisma.sentEmail.findMany({
            where: {
                status: { in: ['SENT', 'FOLLOWED_UP'] },
                sentThreadId: { not: null }
            },
            orderBy: { lastCheckedAt: 'asc' }, // Check oldest first
            take: 20 // Limit batch
        });

        let checked = 0;
        let replied = 0;

        for (const email of sentEmails) {
            if (!email.sentThreadId) continue;
            checked++;

            try {
                const thread = await gmailService.getThread(email.sentThreadId);
                const messages = thread.messages || [];

                // Find if there is a reply
                // A reply is a message sent AFTER our last sentAt
                // And FROM someone else (simplistic check: from != me)
                // Better check: 'sentAt' of our email record.

                const ourSentTime = email.sentAt.getTime();

                // Get my email to exclude
                const me = await prisma.gmailAccount.findFirst();
                const myEmail = me?.email || "";

                const reply = messages.find(m => {
                    const msgTime = parseInt(m.internalDate || "0");
                    if (msgTime <= ourSentTime + 5000) return false; // Buffer 5s

                    // Check headers for sender
                    const headers = m.payload?.headers || [];
                    const from = headers.find(h => h.name === 'From')?.value || "";

                    // If generic "me", ignore. If strictly matches my email, ignore.
                    if (from.includes(myEmail)) return false;

                    return true;
                });

                if (reply) {
                    await prisma.sentEmail.update({
                        where: { id: email.id },
                        data: {
                            status: 'REPLIED',
                            replyDetectedAt: new Date(),
                            lastCheckedAt: new Date()
                        }
                    });
                    replied++;
                } else {
                    await prisma.sentEmail.update({
                        where: { id: email.id },
                        data: { lastCheckedAt: new Date() }
                    });
                }

            } catch (e) {
                console.error(`Failed to check thread ${email.sentThreadId}`, e);
            }
        }

        return NextResponse.json({ success: true, checked, replied });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
