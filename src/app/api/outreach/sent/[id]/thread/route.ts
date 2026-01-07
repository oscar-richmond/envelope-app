export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { gmailService } from '@/lib/services/gmail';

type RouteParams = { params: Promise<{ id: string }> };

interface ThreadMessage {
    id: string;
    from: string;
    fromName: string;
    to: string;
    subject: string;
    body: string;
    timestamp: string;
    isOutbound: boolean;
}

/**
 * GET /api/outreach/sent/[id]/thread
 * Fetch the full Gmail thread for a sent email
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const emailId = parseInt(id);

        // Get the sent email with lead info
        const sentEmail = await prisma.sentEmail.findUnique({
            where: { id: emailId },
            include: {
                lead: {
                    include: { companyProspect: true }
                }
            }
        });

        if (!sentEmail) {
            return NextResponse.json({ error: 'Email not found' }, { status: 404 });
        }

        if (!sentEmail.sentThreadId) {
            return NextResponse.json({ error: 'No thread ID found' }, { status: 400 });
        }

        // Get Gmail account
        const account = await prisma.gmailAccount.findFirst();
        if (!account) {
            return NextResponse.json({ error: 'Gmail not connected' }, { status: 400 });
        }

        // Set credentials
        gmailService.setCredentials({
            access_token: account.accessToken,
            refresh_token: account.refreshToken,
            expiry_date: Number(account.expiryDate)
        });

        // Fetch thread from Gmail
        const thread = await gmailService.getThread(sentEmail.sentThreadId);

        if (!thread || !thread.messages) {
            return NextResponse.json({
                error: 'Could not load thread',
                messages: [],
                email: sentEmail
            });
        }

        // Parse messages
        const senderEmail = account.email.toLowerCase();
        const messages: ThreadMessage[] = thread.messages.map((msg: any) => {
            const headers = msg.payload?.headers || [];
            const getHeader = (name: string) =>
                headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

            const from = getHeader('From');
            const to = getHeader('To');
            const subject = getHeader('Subject');
            const date = getHeader('Date');

            // Extract body
            let body = '';
            if (msg.payload?.body?.data) {
                body = Buffer.from(msg.payload.body.data, 'base64').toString('utf-8');
            } else if (msg.payload?.parts) {
                const textPart = msg.payload.parts.find((p: any) =>
                    p.mimeType === 'text/plain' && p.body?.data
                );
                if (textPart?.body?.data) {
                    body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
                }
            }

            // Determine if outbound
            const fromEmail = from.match(/<(.+)>/)?.[1] || from;
            const isOutbound = fromEmail.toLowerCase() === senderEmail;

            // Extract name from "Name <email>" format
            const fromName = from.match(/^([^<]+)/)?.[1]?.trim() || from.split('@')[0];

            return {
                id: msg.id,
                from,
                fromName,
                to,
                subject,
                body: cleanEmailBody(body),
                timestamp: date,
                isOutbound
            };
        });

        // Sort chronologically
        messages.sort((a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        // Get company/contact info
        const prospect = sentEmail.lead.companyProspect;
        const companyName = prospect?.name || sentEmail.lead.companyName;
        const contactEmail = sentEmail.formattedTo.match(/<(.+)>/)?.[1] || sentEmail.formattedTo;
        const contactName = sentEmail.formattedTo.match(/^([^<]+)/)?.[1]?.trim() || contactEmail.split('@')[0];

        return NextResponse.json({
            success: true,
            email: {
                id: sentEmail.id,
                status: sentEmail.status,
                subject: sentEmail.subject,
                conversationOutcome: sentEmail.conversationOutcome,
                replyIntent: sentEmail.replyIntent
            },
            company: {
                name: companyName,
                domain: prospect?.domain
            },
            contact: {
                name: contactName,
                email: contactEmail
            },
            messages,
            threadId: sentEmail.sentThreadId
        });

    } catch (e: any) {
        console.error('Thread fetch error:', e);
        return NextResponse.json({
            error: 'This conversation couldn\'t be loaded right now.',
            detail: e.message
        }, { status: 500 });
    }
}

/**
 * Clean up email body (remove signatures, quoted text, etc.)
 */
function cleanEmailBody(body: string): string {
    // Remove common signature markers
    const signaturePatterns = [
        /^--\s*$/m,
        /^Sent from my/m,
        /^On.*wrote:$/m
    ];

    let cleaned = body;
    for (const pattern of signaturePatterns) {
        const match = cleaned.match(pattern);
        if (match && match.index) {
            cleaned = cleaned.substring(0, match.index);
        }
    }

    return cleaned.trim();
}
