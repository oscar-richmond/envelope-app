import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
    try {
        const { companyName, contactName, content, count = 5 } = await req.json();

        if (!companyName) {
            return NextResponse.json({ success: false, error: 'Missing company name' }, { status: 400 });
        }

        const firstName = contactName?.split(' ')[0] || '';

        const prompt = `Generate ${count} email subject lines for a professional outreach email.

Company: ${companyName}
${firstName ? `Recipient first name: ${firstName}` : ''}
${content ? `Email content summary: ${content.substring(0, 200)}...` : ''}

Rules:
- Never use em dashes (—)
- Keep under 50 characters
- Be specific and relevant
- Sound personal, not spammy
- Mix styles: question, statement, personalized
- ${firstName ? `Can use first name "${firstName}" in some` : 'Keep professional'}

Return exactly ${count} subject lines, one per line, no numbering or bullets.`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 200,
            temperature: 0.8,
        });

        const result = completion.choices[0]?.message?.content?.trim() || '';
        const subjects = result
            .split('\n')
            .map(s => s.trim())
            .filter(s => s.length > 0 && s.length < 80)
            .slice(0, count);

        return NextResponse.json({ success: true, subjects });
    } catch (error: any) {
        console.error('[AI Subject] Error:', error);
        return NextResponse.json({ success: false, error: error.message || 'Failed to generate subjects' }, { status: 500 });
    }
}
