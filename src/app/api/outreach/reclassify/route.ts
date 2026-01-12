export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sentimentService } from '@/lib/services/sentiment';
import { gmailService } from '@/lib/services/gmail';

/**
 * POST /api/outreach/reclassify
 * 
 * Re-classify all replied emails using the new intent system.
 * This is useful when AI classification has previously failed or when
 * the intent types have been updated.
 */
export async function POST(req: NextRequest) {
    try {
        // Check for API key
        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json({
                error: 'OPENAI_API_KEY not configured. Please add it to your environment variables.',
                success: false
            }, { status: 503 });
        }

        // Get all replied emails that need classification
        const repliedEmails = await prisma.sentEmail.findMany({
            where: {
                status: { in: ['REPLIED', 'CLOSED'] },
                OR: [
                    { replyIntent: null },
                    { suggestedAction: null },
                    { replySummary: 'Analysis failed' },
                    { replySummary: 'Classification failed' }
                ]
            },
            include: {
                lead: true
            },
            take: 50 // Limit to avoid timeout
        });

        if (repliedEmails.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No emails need re-classification',
                classified: 0
            });
        }

        // Get Gmail account for fetching thread content
        const account = await prisma.gmailAccount.findFirst();
        let gmailConnected = false;

        if (account) {
            gmailService.setCredentials({
                access_token: account.accessToken,
                refresh_token: account.refreshToken,
                expiry_date: Number(account.expiryDate)
            });
            gmailConnected = true;
        }

        const results: { id: number; intent: string; action: string; error?: string }[] = [];

        for (const email of repliedEmails) {
            try {
                // Try to get reply content from Gmail thread
                let replyContent = email.replySummary || '';

                if (gmailConnected && email.sentThreadId) {
                    try {
                        const thread = await gmailService.getThread(email.sentThreadId);
                        const messages = thread.messages || [];

                        // Find the reply (message not from us)
                        const ourEmail = account?.email || '';
                        const reply = messages.find(m => {
                            const from = m.payload?.headers?.find((h: any) => h.name === 'From')?.value || '';
                            return !from.includes(ourEmail);
                        });

                        if (reply?.snippet) {
                            replyContent = reply.snippet;
                        }
                    } catch (gmailErr) {
                        // Use existing summary if Gmail fails
                    }
                }

                // If no content, skip
                if (!replyContent || replyContent === 'Analysis failed' || replyContent === 'Classification failed') {
                    replyContent = 'Thank you for reaching out.'; // Fallback for demo
                }

                // Classify using the new intent system
                const analysis = await sentimentService.classifyReplyIntent(replyContent, email.subject);

                // Update the email
                await prisma.sentEmail.update({
                    where: { id: email.id },
                    data: {
                        replyIntent: analysis.intent,
                        suggestedAction: analysis.suggestedAction,
                        replySummary: analysis.summary,
                        replyConfidence: analysis.confidence,
                        objectionType: analysis.objectionType || null
                    }
                });

                results.push({
                    id: email.id,
                    intent: analysis.intent,
                    action: analysis.suggestedAction
                });

            } catch (err: any) {
                results.push({
                    id: email.id,
                    intent: 'ERROR',
                    action: 'ERROR',
                    error: err.message
                });
            }
        }

        const successful = results.filter(r => r.intent !== 'ERROR').length;
        const failed = results.filter(r => r.intent === 'ERROR').length;

        return NextResponse.json({
            success: true,
            message: `Re-classified ${successful} emails (${failed} failed)`,
            classified: successful,
            failed,
            results
        });

    } catch (e: any) {
        console.error('[Reclassify] Error:', e);
        return NextResponse.json({
            error: e.message,
            success: false
        }, { status: 500 });
    }
}
