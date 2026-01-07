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
 * 
 * Read-only operation - never modifies Gmail state
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
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

    // Build base response (always available)
    const prospect = sentEmail.lead.companyProspect;
    const companyName = prospect?.name || sentEmail.lead.companyName;
    const contactEmail = sentEmail.formattedTo.match(/<(.+)>/)?.[1] || sentEmail.formattedTo;
    const contactName = sentEmail.formattedTo.match(/^([^<]+)/)?.[1]?.trim() || contactEmail.split('@')[0];

    const baseResponse = {
        email: {
            id: sentEmail.id,
            status: sentEmail.status,
            subject: sentEmail.subject,
            conversationOutcome: sentEmail.conversationOutcome,
            replyIntent: sentEmail.replyIntent,
            bodyText: sentEmail.bodyText
        },
        company: {
            name: companyName,
            domain: prospect?.domain
        },
        contact: {
            name: contactName,
            email: contactEmail
        },
        threadId: sentEmail.sentThreadId
    };

    // Case A: No thread ID - return fallback with cached outbound message
    if (!sentEmail.sentThreadId) {
        console.log(`[THREAD] Email ${emailId}: No thread ID, using cached data`);

        const cachedMessage: ThreadMessage = {
            id: `local-${emailId}`,
            from: 'You',
            fromName: 'You',
            to: sentEmail.formattedTo,
            subject: sentEmail.subject,
            body: sentEmail.bodyText,
            timestamp: sentEmail.sentAt?.toISOString() || new Date().toISOString(),
            isOutbound: true
        };

        return NextResponse.json({
            success: true,
            ...baseResponse,
            messages: [cachedMessage],
            partial: true,
            partialReason: 'Thread ID not yet synced'
        });
    }

    // Get Gmail account
    const account = await prisma.gmailAccount.findFirst();
    if (!account) {
        console.log(`[THREAD] Email ${emailId}: Gmail not connected, using cached data`);

        const cachedMessage: ThreadMessage = {
            id: `local-${emailId}`,
            from: 'You',
            fromName: 'You',
            to: sentEmail.formattedTo,
            subject: sentEmail.subject,
            body: sentEmail.bodyText,
            timestamp: sentEmail.sentAt?.toISOString() || new Date().toISOString(),
            isOutbound: true
        };

        return NextResponse.json({
            success: true,
            ...baseResponse,
            messages: [cachedMessage],
            partial: true,
            partialReason: 'Gmail connection required'
        });
    }

    try {
        // Set credentials
        gmailService.setCredentials({
            access_token: account.accessToken,
            refresh_token: account.refreshToken,
            expiry_date: Number(account.expiryDate)
        });

        // Fetch thread from Gmail (read-only)
        const thread = await gmailService.getThread(sentEmail.sentThreadId);

        // Case B: Gmail API returned empty/null
        if (!thread || !thread.messages || thread.messages.length === 0) {
            console.log(`[THREAD] Email ${emailId}: Gmail returned empty thread, using cached data`);

            const cachedMessage: ThreadMessage = {
                id: `local-${emailId}`,
                from: 'You',
                fromName: 'You',
                to: sentEmail.formattedTo,
                subject: sentEmail.subject,
                body: sentEmail.bodyText,
                timestamp: sentEmail.sentAt?.toISOString() || new Date().toISOString(),
                isOutbound: true
            };

            return NextResponse.json({
                success: true,
                ...baseResponse,
                messages: [cachedMessage],
                partial: true,
                partialReason: 'Some earlier messages may not be visible yet'
            });
        }

        // Parse messages (tolerate malformed individual messages)
        const senderEmail = account.email.toLowerCase();
        const messages: ThreadMessage[] = [];

        for (const msg of thread.messages) {
            try {
                const parsed = parseGmailMessage(msg, senderEmail);
                if (parsed) {
                    messages.push(parsed);
                }
            } catch (parseError) {
                console.log(`[THREAD] Email ${emailId}: Failed to parse message ${msg.id}`, parseError);
                // Continue with other messages - one malformed message doesn't fail the thread
            }
        }

        // Sort chronologically
        messages.sort((a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        // If parsing failed for all messages, use cached
        if (messages.length === 0) {
            console.log(`[THREAD] Email ${emailId}: All message parsing failed, using cached data`);

            const cachedMessage: ThreadMessage = {
                id: `local-${emailId}`,
                from: 'You',
                fromName: 'You',
                to: sentEmail.formattedTo,
                subject: sentEmail.subject,
                body: sentEmail.bodyText,
                timestamp: sentEmail.sentAt?.toISOString() || new Date().toISOString(),
                isOutbound: true
            };

            return NextResponse.json({
                success: true,
                ...baseResponse,
                messages: [cachedMessage],
                partial: true,
                partialReason: 'Some messages could not be displayed'
            });
        }

        return NextResponse.json({
            success: true,
            ...baseResponse,
            messages,
            partial: false
        });

    } catch (e: any) {
        // Case C: Gmail API error - return cached data with warning
        console.error(`[THREAD] Email ${emailId}: Gmail API error:`, e.message);

        const cachedMessage: ThreadMessage = {
            id: `local-${emailId}`,
            from: 'You',
            fromName: 'You',
            to: sentEmail.formattedTo,
            subject: sentEmail.subject,
            body: sentEmail.bodyText,
            timestamp: sentEmail.sentAt?.toISOString() || new Date().toISOString(),
            isOutbound: true
        };

        return NextResponse.json({
            success: true,
            ...baseResponse,
            messages: [cachedMessage],
            partial: true,
            partialReason: 'We\'re having trouble loading the full thread. Please try again shortly.',
            retryable: true
        });
    }
}

/**
 * Parse a single Gmail message into our format
 * Returns null if message is malformed
 */
function parseGmailMessage(msg: any, senderEmail: string): ThreadMessage | null {
    const headers = msg.payload?.headers || [];
    const getHeader = (name: string) =>
        headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    const from = getHeader('From');
    const to = getHeader('To');
    const subject = getHeader('Subject');
    const date = getHeader('Date');

    // Extract body - try multiple sources
    let body = '';

    // Try direct body data
    if (msg.payload?.body?.data) {
        try {
            body = Buffer.from(msg.payload.body.data, 'base64').toString('utf-8');
        } catch (e) {
            // Ignore decode error
        }
    }

    // Try multipart parts
    if (!body && msg.payload?.parts) {
        // First try text/plain
        const textPart = msg.payload.parts.find((p: any) =>
            p.mimeType === 'text/plain' && p.body?.data
        );
        if (textPart?.body?.data) {
            try {
                body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
            } catch (e) {
                // Ignore decode error
            }
        }

        // Fallback to text/html if no plain text
        if (!body) {
            const htmlPart = msg.payload.parts.find((p: any) =>
                p.mimeType === 'text/html' && p.body?.data
            );
            if (htmlPart?.body?.data) {
                try {
                    let html = Buffer.from(htmlPart.body.data, 'base64').toString('utf-8');
                    // Basic HTML to text conversion
                    body = html
                        .replace(/<br\s*\/?>/gi, '\n')
                        .replace(/<\/p>/gi, '\n\n')
                        .replace(/<[^>]+>/g, '')
                        .replace(/&nbsp;/g, ' ')
                        .replace(/&amp;/g, '&')
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                        .trim();
                } catch (e) {
                    // Ignore decode error
                }
            }
        }

        // Try nested parts (multipart/alternative inside multipart/mixed)
        if (!body) {
            for (const part of msg.payload.parts) {
                if (part.parts) {
                    const nestedText = part.parts.find((p: any) =>
                        p.mimeType === 'text/plain' && p.body?.data
                    );
                    if (nestedText?.body?.data) {
                        try {
                            body = Buffer.from(nestedText.body.data, 'base64').toString('utf-8');
                            break;
                        } catch (e) {
                            // Ignore
                        }
                    }
                }
            }
        }
    }

    // Determine if outbound
    const fromEmail = from.match(/<(.+)>/)?.[1] || from;
    const isOutbound = fromEmail.toLowerCase() === senderEmail;

    // Extract name from "Name <email>" format
    const fromName = from.match(/^([^<]+)/)?.[1]?.trim() || from.split('@')[0] || 'Unknown';

    return {
        id: msg.id || `msg-${Date.now()}`,
        from: from || 'Unknown',
        fromName: isOutbound ? 'You' : fromName,
        to: to || 'Unknown',
        subject: subject || '(No subject)',
        body: cleanEmailBody(body) || '(No content)',
        timestamp: date || new Date().toISOString(),
        isOutbound
    };
}

/**
 * Clean up email body (remove signatures, quoted text, etc.)
 */
function cleanEmailBody(body: string): string {
    if (!body) return '';

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
