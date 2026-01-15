import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const REWRITE_PROMPTS: Record<string, string> = {
    shorter: 'Rewrite this email to be more concise and shorter, removing unnecessary words while keeping the core message.',
    clearer: 'Rewrite this email to be clearer and easier to understand, using simpler language.',
    confident: 'Rewrite this email to sound more confident and authoritative, removing hedging language.',
    friendly: 'Rewrite this email to sound warmer and more friendly, while remaining professional.',
    direct: 'Rewrite this email to be more direct and to the point, removing filler phrases.'
};

export async function POST(req: NextRequest) {
    try {
        const { content, style, companyName, contactName } = await req.json();

        if (!content || !style) {
            return NextResponse.json({ success: false, error: 'Missing content or style' }, { status: 400 });
        }

        const stylePrompt = REWRITE_PROMPTS[style] || REWRITE_PROMPTS.clearer;

        const prompt = `You are an expert email writer. ${stylePrompt}

${contactName ? `The recipient's name is ${contactName}.` : ''}
${companyName ? `The recipient works at ${companyName}.` : ''}

Important rules:
- Never use em dashes (—)
- Keep paragraphs short (2-3 sentences max)
- Preserve any personalization
- Maintain a professional but human tone
- Do not add new information

Original email:
${content}

Rewritten email:`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 500,
            temperature: 0.7,
        });

        const result = completion.choices[0]?.message?.content?.trim() || '';

        return NextResponse.json({ success: true, result });
    } catch (error: any) {
        console.error('[AI Rewrite] Error:', error);
        return NextResponse.json({ success: false, error: error.message || 'Failed to rewrite' }, { status: 500 });
    }
}
