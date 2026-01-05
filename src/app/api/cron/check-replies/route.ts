export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { gmailService } from '@/lib/services/gmail';
import { sentimentService } from '@/lib/services/sentiment';

export async function GET(req: NextRequest) {
    const debug: string[] = [];
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

        debug.push(`Found ${sentEmails.length} emails to check.`);

        let checked = 0;
        let replied = 0;

        // Get my email to exclude
        const me = await prisma.gmailAccount.findFirst();
        const myEmail = me?.email || "";
        debug.push(`My Email (to exclude): "${myEmail}"`);

        for (const email of sentEmails) {
            if (!email.sentThreadId) continue;
            checked++;

            try {
                debug.push(`Checking Thread ID: ${email.sentThreadId} (Subject: ${email.subject})`);
                const thread = await gmailService.getThread(email.sentThreadId);
                const messages = thread.messages || [];
                debug.push(`-- Found ${messages.length} messages in thread.`);

                const ourSentTime = email.sentAt.getTime();

                const reply = messages.find(m => {
                    const msgTime = parseInt(m.internalDate || "0");
                    // debug.push(`-- Msg ${m.id}: Time diff = ${(msgTime - ourSentTime)/1000}s`);

                    if (msgTime <= ourSentTime + 2000) return false; // Buffer 2s

                    // Check headers for sender
                    const headers = m.payload?.headers || [];
                    const from = headers.find(h => h.name === 'From')?.value || "";

                    debug.push(`-- Msg ${m.id} Candidate: From="${from}"`);

                    // If generic "me", ignore. If strictly matches my email, ignore.
                    if (myEmail && from.includes(myEmail)) {
                        debug.push(`---- Ignored: Matches my email.`);
                        return false;
                    }

                    return true;
                });

                if (reply) {
                    debug.push(`!! REPLY DETECTED from id ${reply.id}`);
                    // Extract body snippet for analysis (simplistic)
                    const snippet = reply.snippet || "";

                    // Task 11: Sentiment Analysis
                    let sentimentData = {};
                    try {
                        const analysis = await sentimentService.analyzeReply(snippet, email.subject);
                        sentimentData = {
                            replySentiment: analysis.sentiment,
                            replySummary: analysis.summary,
                            replyConfidence: analysis.confidence
                        };
                        debug.push(`!! Analysis: ${analysis.sentiment}`);
                    } catch (err) {
                        console.error("Sentiment analysis failed during cron", err);
                        debug.push(`!! Analysis Failed: ${err}`);
                    }

                    await prisma.sentEmail.update({
                        where: { id: email.id },
                        data: {
                            status: 'REPLIED',
                            replyDetectedAt: new Date(),
                            lastCheckedAt: new Date(),
                            ...sentimentData
                        }
                    });

                    // Auto-Actions (Optional: Could start simple, just tagging)
                    // If OOO -> Update nextFollowUpAt
                    if (sentimentData['replySentiment'] === 'OOO') {
                        await prisma.sentEmail.update({
                            where: { id: email.id },
                            data: {
                                nextFollowUpAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // +3 Days
                            }
                        });
                    }

                    replied++;
                } else {
                    debug.push(`-- No valid reply found in thread.`);

                    // DEBUG FALLBACK: Check if reply lost threading
                    try {
                        debug.push(`-- Debug: Searching by subject for lost reply...`);
                        const cleanSubject = email.subject.replace(/([\[\]\{\}\(\)\*])/g, ''); // crude clean
                        const searchRes = await gmailService.client.request({
                            url: 'https://gmail.googleapis.com/gmail/v1/users/me/messages',
                            params: {
                                q: `subject:("${cleanSubject}")`,
                                includeSpamTrash: 'true'
                            }
                        });
                        const data: any = searchRes.data;
                        if (data.messages && data.messages.length > 0) {
                            debug.push(`-- Debug: Found ${data.messages.length} msgs with subject.`);
                            data.messages.forEach((m: any) => {
                                debug.push(`---- Msg: ${m.id} | Thread: ${m.threadId}`);
                            });
                            if (data.messages.some((m: any) => m.threadId !== email.sentThreadId)) {
                                debug.push(`!! WARNING: Found messages in DIFFERENT threads. Threading is broken.`);
                            }
                        } else {
                            debug.push(`-- Debug: No other messages found by subject.`);
                        }
                    } catch (dE: any) {
                        debug.push(`-- Debug Search Failed: ${dE.message}`);
                    }

                    await prisma.sentEmail.update({
                        where: { id: email.id },
                        data: { lastCheckedAt: new Date() }
                    });
                }

            } catch (e: any) {
                console.error(`Failed to check thread ${email.sentThreadId}`, e);
                debug.push(`Error checking thread: ${e.message}`);
            }
        }

        return NextResponse.json({ success: true, checked, replied, debug });

    } catch (e: any) {
        return NextResponse.json({ error: e.message, debug }, { status: 500 });
    }
}
