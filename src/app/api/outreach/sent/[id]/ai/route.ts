export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import OpenAI from 'openai';

type RouteParams = { params: Promise<{ id: string }> };

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

/**
 * POST /api/outreach/sent/[id]/ai
 * 
 * AI-powered thread operations:
 * - action: 'summarize' - Summarize the thread
 * - action: 'suggest_reply' - Generate a suggested reply
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
    const { id } = await params;
    const emailId = parseInt(id);

    try {
        const body = await req.json();
        const { action, threadContent, companyName, contactName } = body;

        if (!action) {
            return NextResponse.json({ error: 'Missing action' }, { status: 400 });
        }

        // Get email context
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

        const company = companyName || sentEmail.lead.companyProspect?.displayBrandName || sentEmail.lead.companyName;
        const contact = contactName || sentEmail.formattedTo.match(/^([^<]+)/)?.[1]?.trim() || 'the contact';

        if (action === 'summarize') {
            const response = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `You summarize email threads concisely. Focus on:
- Key points discussed
- Any commitments or next steps
- Current status of the conversation
- Tone/sentiment of the reply if any

Be brief - 2-4 sentences max. Use professional language.`
                    },
                    {
                        role: 'user',
                        content: `Summarize this email thread with ${company} (${contact}):\n\n${threadContent}`
                    }
                ],
                max_tokens: 200,
                temperature: 0.3
            });

            const summary = response.choices[0]?.message?.content || 'Unable to generate summary.';

            return NextResponse.json({
                success: true,
                action: 'summarize',
                result: summary
            });
        }

        if (action === 'suggest_reply') {
            // Get settings for tone guidelines
            const settings = await prisma.settings.findFirst();
            const toneGuidelines = settings?.toneGuidelines || 'Professional, friendly, and concise.';
            const signature = settings?.emailSignature || '';

            const response = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `You draft professional email replies. 
Tone guidelines: ${toneGuidelines}

Rules:
- Be concise and direct
- Match the formality of the conversation
- If they showed interest, propose a clear next step (call, meeting)
- If they declined, thank them gracefully
- Never be pushy
- Keep it to 3-6 sentences
- Do NOT include subject line
- Do NOT include greeting/sign-off (those are handled separately)`
                    },
                    {
                        role: 'user',
                        content: `Draft a reply to this thread with ${company} (${contact}):\n\n${threadContent}\n\nGenerate just the body of the reply.`
                    }
                ],
                max_tokens: 300,
                temperature: 0.7
            });

            let suggestion = response.choices[0]?.message?.content || '';

            // Format with greeting and signature
            const greeting = `Hi ${contact.split(' ')[0]},\n\n`;
            const signOff = signature ? `\n\n${signature}` : '\n\nBest,';

            const fullReply = `${greeting}${suggestion}${signOff}`;

            return NextResponse.json({
                success: true,
                action: 'suggest_reply',
                result: fullReply
            });
        }

        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

    } catch (e: any) {
        console.error('[AI Thread] Error:', e);
        return NextResponse.json({
            error: 'AI service unavailable. Please try again.',
            details: e.message
        }, { status: 500 });
    }
}
