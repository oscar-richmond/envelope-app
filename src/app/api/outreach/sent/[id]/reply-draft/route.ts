export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { replyDraftService, type ReplyableIntent } from '@/lib/services/reply-drafts';
import { outreachGenerator } from '@/lib/services/outreach-generator';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/outreach/sent/[id]/reply-draft
 * Generate a reply draft for a received email based on intent
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const emailId = parseInt(id);

        const { searchParams } = new URL(req.url);
        const regenerate = searchParams.get('regenerate') === 'true';

        // Get email with context
        const email = await prisma.sentEmail.findUnique({
            where: { id: emailId },
            include: {
                lead: {
                    include: { companyProspect: true }
                }
            }
        });

        if (!email) {
            return NextResponse.json({ error: 'Email not found' }, { status: 404 });
        }

        // Check if intent is replyable
        const intent = email.replyIntent || email.replySentiment;
        if (!replyDraftService.isReplyableIntent(intent)) {
            return NextResponse.json({
                success: false,
                error: 'This reply needs manual review',
                intent,
                canDraft: false
            });
        }

        // Extract context
        const prospect = email.lead.companyProspect;
        const companyName = prospect
            ? outreachGenerator.getCanonicalName(prospect)
            : email.lead.companyName;

        // Get first name from recipient
        const firstName = extractFirstName(email.formattedTo) || 'there';

        // Extract referred contact name if present (from reply summary)
        let referredContactName: string | undefined;
        if (intent === 'REFERRAL' && email.replySummary) {
            const nameMatch = email.replySummary.match(/contact\s+(\w+)/i) ||
                email.replySummary.match(/speak\s+to\s+(\w+)/i) ||
                email.replySummary.match(/(\w+)\s+is\s+the\s+right/i);
            if (nameMatch) {
                referredContactName = nameMatch[1];
            }
        }

        // Generate draft
        const draft = replyDraftService.generateReplyDraft({
            intent: intent as ReplyableIntent,
            firstName,
            companyName,
            replyTextRaw: email.replySummary || '',
            lastOutboundContext: email.subject,
            referredContactName
        }, regenerate);

        return NextResponse.json({
            success: true,
            draft: {
                subject: `Re: ${email.subject}`,
                body: draft.body,
                intent: draft.intent
            },
            context: {
                replyIntent: intent,
                replySummary: email.replySummary,
                companyName
            },
            canDraft: true,
            regenerated: regenerate
        });

    } catch (e: any) {
        console.error('Reply draft error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

function extractFirstName(formatted: string): string | null {
    const nameMatch = formatted.match(/^([^<]+)</);
    if (nameMatch) {
        const fullName = nameMatch[1].trim();
        const firstName = fullName.split(' ')[0];
        if (firstName && firstName.length > 1) {
            return firstName;
        }
    }
    return null;
}
