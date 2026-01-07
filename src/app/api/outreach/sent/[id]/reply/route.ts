export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { gmailService } from '@/lib/services/gmail';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/outreach/sent/[id]/reply
 * Send a reply in the same Gmail thread
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const emailId = parseInt(id);
        const { body, threadId } = await req.json();

        if (!body?.trim()) {
            return NextResponse.json({ error: 'Reply body is required' }, { status: 400 });
        }

        // Get the sent email
        const sentEmail = await prisma.sentEmail.findUnique({
            where: { id: emailId },
            include: { lead: true }
        });

        if (!sentEmail) {
            return NextResponse.json({ error: 'Email not found' }, { status: 404 });
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

        // Extract recipient email
        const recipientEmail = sentEmail.formattedTo.match(/<(.+)>/)?.[1] || sentEmail.formattedTo;

        // Send reply in thread
        const result = await gmailService.sendEmailInThread(
            account.email,
            recipientEmail,
            `Re: ${sentEmail.subject}`,
            body,
            undefined, // No HTML
            sentEmail.sentThreadId || threadId
        );

        // Update sent email state
        await prisma.sentEmail.update({
            where: { id: emailId },
            data: {
                status: 'SENT', // Back to waiting for reply
                lastActivityAt: new Date(),
                // Cancel any pending follow-ups
                followUpSkipped: true,
                nextFollowUpAt: null
            }
        });

        // Remove from follow-up queue if present
        await prisma.followUpQueueItem.updateMany({
            where: { sentEmailId: emailId, status: 'QUEUED' },
            data: { status: 'SKIPPED' }
        });

        console.log(`[REPLY] Sent reply to ${recipientEmail} in thread ${sentEmail.sentThreadId}`);

        return NextResponse.json({
            success: true,
            messageId: result.id,
            threadId: result.threadId
        });

    } catch (e: any) {
        console.error('Reply send error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
