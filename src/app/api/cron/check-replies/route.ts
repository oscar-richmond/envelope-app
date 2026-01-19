export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { gmailService } from '@/lib/services/gmail';
import { sentimentService } from '@/lib/services/sentiment';

/**
 * Map reply intent to suggested conversation outcome
 */
function mapIntentToOutcome(intent: string | null): string | null {
    if (!intent) return null;

    switch (intent) {
        case 'INTERESTED':
            return 'INTERESTED';
        case 'NOT_NOW':
            return 'NOT_NOW';
        case 'NOT_INTERESTED':
            return 'NOT_INTERESTED';
        case 'REFERRAL':
            return 'REFERRED';
        case 'AUTO_REPLY':
            return null; // No outcome for auto-replies
        case 'UNCLEAR':
            return null; // User must decide
        default:
            return null;
    }
}

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
                    // Extract body snippet for analysis
                    const snippet = reply.snippet || "";

                    // Intent-based classification with action mapping
                    let sentimentData: any = {};
                    try {
                        const analysis = await sentimentService.classifyReplyIntent(snippet, email.subject);
                        sentimentData = {
                            replyIntent: analysis.intent,
                            replySentiment: analysis.intent, // Legacy compat
                            suggestedAction: analysis.suggestedAction,
                            replySummary: analysis.summary,
                            replyConfidence: analysis.confidence,
                            objectionType: analysis.objectionType,
                            returnDate: analysis.returnDate
                        };
                        debug.push(`!! Intent: ${analysis.intent} -> Action: ${analysis.suggestedAction} (${analysis.confidence}% confidence)`);
                    } catch (err) {
                        console.error("Intent classification failed during cron", err);
                        debug.push(`!! Analysis Failed: ${err}`);
                    }

                    // Determine status based on intent
                    let newStatus = 'REPLIED';
                    let intentData: any = {};

                    if (sentimentData['replyIntent']) {
                        intentData = {
                            replyIntent: sentimentData['replyIntent'],
                            replyConfidenceScore: sentimentData['replyConfidence'] || 0
                        };

                        // Intent-specific status mapping
                        switch (sentimentData['replyIntent']) {
                            case 'NOT_INTERESTED':
                                // Clear rejection - close and suppress future follow-ups
                                newStatus = 'CLOSED';
                                intentData.followUpSkipped = true;
                                debug.push(`-- Intent: NOT_INTERESTED -> Closing and suppressing`);
                                break;

                            case 'AUTO_REPLY':
                                // OOO - keep in waiting, auto-schedule
                                newStatus = 'WAITING';
                                // Schedule follow-up for return date or +5 business days
                                const returnDate = sentimentData['returnDate'];
                                const nextFollowUp = returnDate
                                    ? new Date(returnDate)
                                    : new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
                                intentData.nextFollowUpAt = nextFollowUp;
                                debug.push(`-- Intent: AUTO_REPLY -> Rescheduling to ${nextFollowUp.toISOString().split('T')[0]}`);
                                break;

                            case 'UNCLEAR':
                                // Needs manual review
                                newStatus = 'ACTION_NEEDED';
                                debug.push(`-- Intent: UNCLEAR -> Flagging for review`);
                                break;

                            case 'INTERESTED':
                            case 'NOT_NOW':
                            case 'REFERRAL':
                            default:
                                // Standard reply handling
                                newStatus = 'REPLIED';
                                debug.push(`-- Intent: ${sentimentData['replyIntent']} -> Standard reply`);
                                break;
                        }

                        // Map intent to suggested outcome
                        const suggestedOutcome = mapIntentToOutcome(sentimentData['replyIntent']);
                        if (suggestedOutcome) {
                            intentData.suggestedOutcome = suggestedOutcome;
                            intentData.suggestedOutcomeConfidence = sentimentData['replyConfidence'] || 70;
                            debug.push(`-- Suggested outcome: ${suggestedOutcome}`);
                        }
                    }

                    await prisma.sentEmail.update({
                        where: { id: email.id },
                        data: {
                            status: newStatus,
                            replyDetectedAt: new Date(),
                            lastCheckedAt: new Date(),
                            lastInboundAt: new Date(), // Unibox: track inbound timestamp
                            replySentiment: sentimentData['replySentiment'],
                            suggestedAction: sentimentData['suggestedAction'],
                            objectionType: sentimentData['objectionType'],
                            replySummary: sentimentData['replySummary'],
                            replyConfidence: sentimentData['replyConfidence'],
                            ...intentData
                        }
                    });

                    // AUTO-EXIT: Remove any queued follow-up items for this email
                    // Replies always stop automation immediately (except AUTO_REPLY which reschedules)
                    if (sentimentData['replyIntent'] !== 'AUTO_REPLY') {
                        const removedItems = await prisma.followUpQueueItem.updateMany({
                            where: {
                                sentEmailId: email.id,
                                status: 'QUEUED'
                            },
                            data: {
                                status: 'SKIPPED' // Mark as skipped (auto-cancelled due to reply)
                            }
                        });

                        if (removedItems.count > 0) {
                            debug.push(`-- Auto-removed ${removedItems.count} queued follow-up(s)`);
                        }
                    }

                    replied++;
                } else {
                    debug.push(`-- No valid reply found in thread. Attempting Fuzzy Search...`);

                    // 2. Fuzzy Search Strategy: Match by Subject Prefix (Broad)

                    // let fuzzyReply = null;
                    // DISABLED: requires public client property
                    /* try {
                        // "Quick question, {{FirstName}}" -> "Quick question"
                        const cleanSubject = email.subject.split(',')[0].trim();
                        const searchQ = `subject:("${cleanSubject}")`;

                        debug.push(`-- Search Q: ${searchQ}`);

                        const searchRes = await gmailService.client.request({
                            url: 'https://gmail.googleapis.com/gmail/v1/users/me/messages',
                            params: {
                                q: searchQ,
                                includeSpamTrash: 'true',
                                maxResults: 5
                            }
                        });

                        const data: any = searchRes.data;
                        const potentialMsgs = data.messages || [];

                        // Check each potential message
                        for (const pm of potentialMsgs) {
                            if (pm.threadId === email.sentThreadId) continue; // Skip known thread

                            // Fetch details
                            const details = await gmailService.getThread(pm.threadId);
                            const msgs = details.messages || [];

                            // Find matching message
                            const match = msgs.find(m => {
                                const headers = m.payload?.headers || [];
                                const from = headers.find(h => h.name === 'From')?.value || "";
                                if (myEmail && from.includes(myEmail)) return false;

                                // Timestamp check: Must be AFTER sent time
                                const msgTime = parseInt(m.internalDate || "0");
                                if (msgTime <= ourSentTime) return false;

                                return true;
                            });

                            if (match) {
                                debug.push(`!! FUZZY MATCH FOUND: Thread ${pm.threadId} (Msg ${match.id})`);
                                fuzzyReply = match;
                                break;
                            }
                        }

                    } catch (dE: any) {
                        debug.push(`-- Fuzzy Search Error: ${dE.message}`);
                    } */
                    const fuzzyReply = null;

                    // DISABLED: fuzzyReply is always null since search is disabled
                    /* if (fuzzyReply) {
                        const snippet = fuzzyReply.snippet || "";
                        debug.push(`!! Processing Fuzzy Reply...`);

                        let sentimentData = {};
                        try {
                            const analysis = await sentimentService.analyzeReply(snippet, email.subject);
                            sentimentData = {
                                replySentiment: analysis.sentiment,
                                replySummary: analysis.summary,
                                replyConfidence: analysis.confidence
                            };
                            debug.push(`!! Analysis: ${analysis.sentiment}`);
                        } catch (err) { console.error(err); }

                        await prisma.sentEmail.update({
                            where: { id: email.id },
                            data: {
                                status: 'REPLIED',
                                replyDetectedAt: new Date(),
                                lastCheckedAt: new Date(),
                                lastInboundAt: new Date(), // Unibox: track inbound timestamp
                                ...sentimentData
                            }
                        });

                        if (sentimentData['replySentiment'] === 'OOO') {
                            await prisma.sentEmail.update({
                                where: { id: email.id },
                                data: { nextFollowUpAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) }
                            });
                        }
                        replied++;

                    } else */ {
                        debug.push(`-- No fuzzy match found.`);
                        await prisma.sentEmail.update({
                            where: { id: email.id },
                            data: { lastCheckedAt: new Date() }
                        });
                    }
                }

            } catch (e: any) {
                console.error(`Failed to check thread ${email.sentThreadId}`, e);
                debug.push(`Error checking thread: ${e.message}`);
            }
        }

        // DEBUG: List latest 5 messages in inbox
        // DISABLED: requires public client property
        /* try {
            debug.push(`=== INBOX CHECK (All Incoming, inc Spam) ===`);
            const list =  await gmailService.client.request({
                url: 'https://gmail.googleapis.com/gmail/v1/users/me/messages',
                params: {
                    maxResults: 5,
                    q: '-from:me',
                    includeSpamTrash: 'true'
                }
            });
            const msgs = (list.data as any).messages || [];

            for (const m of msgs) {
                const details = await gmailService.getThread(m.threadId);
                const firstMsg = details.messages?.[0];
                const subject = firstMsg?.payload?.headers?.find((h: any) => h.name === 'Subject')?.value;
                const snippet = firstMsg?.snippet;
                debug.push(`Msg: ${m.id} | Thd: ${m.threadId} | Sub: "${subject}" | Snip: "${snippet?.substring(0, 30)}..."`);
            }
            debug.push(`============================`);
        } catch (e: any) {
            debug.push(`Inbox Check Failed: ${e.message}`);
        } */

        return NextResponse.json({ success: true, checked, replied, debug });

    } catch (e: any) {
        return NextResponse.json({ error: e.message, debug }, { status: 500 });
    }
}
