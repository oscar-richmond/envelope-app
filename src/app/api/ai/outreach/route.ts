import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

/**
 * POST /api/ai/outreach
 * 
 * AI tools for new outreach (no existing thread)
 * Actions: draft_outreach | suggest_angle | summarize_company
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action, companyName, contactName, contactEmail, context, tone = 'polite' } = body;

        if (!companyName) {
            return NextResponse.json({
                success: false,
                error: 'Company name required'
            }, { status: 400 });
        }

        console.log(`[AI Outreach] action=${action}, company=${companyName}`);

        // Build context string from company data
        const contextStr = context ? `
Company Information:
- Website signals: ${context.websiteSignals?.join(', ') || 'N/A'}
- Financial signals: ${context.financialSignals?.join(', ') || 'N/A'}
- Offering: ${context.offering || 'N/A'}
- Industry: ${context.industry || 'N/A'}
`.trim() : '';

        let result: string;

        switch (action) {
            case 'draft_outreach': {
                const prompt = `You are an expert B2B outreach copywriter. Write a compelling first outreach email.

Company: ${companyName}
Contact: ${contactName || 'Unknown'}
Email: ${contactEmail || 'Unknown'}
Tone: ${tone}
${contextStr}

Guidelines:
- Keep it under 100 words
- Be specific to the company if context provided
- Avoid generic phrases like "I hope this email finds you well"
- Lead with value, not a pitch
- End with a clear, low-commitment CTA (e.g., "Open to a quick call this week?")

Write ONLY the email body (no subject line, no signature).`;

                const completion = await openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.7,
                    max_tokens: 300
                });

                result = completion.choices[0]?.message?.content?.trim() || '';
                break;
            }

            case 'suggest_angle': {
                const prompt = `You are a B2B sales strategist. Suggest 3 compelling outreach angles for this company.

Company: ${companyName}
${contextStr}

For each angle, provide:
1. A one-liner angle description
2. A suggested subject line

Format as numbered list. Be specific if context is available.`;

                const completion = await openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.8,
                    max_tokens: 400
                });

                result = completion.choices[0]?.message?.content?.trim() || '';
                break;
            }

            case 'summarize_company': {
                if (!contextStr) {
                    result = `${companyName} - No additional company information available. Consider scanning the website for more insights.`;
                } else {
                    const prompt = `Provide a brief company snapshot for sales prospecting.

Company: ${companyName}
${contextStr}

Write 2-3 sentences summarizing:
- What the company does
- Any notable signals (positive or negative)
- Best approach angle

Be concise and actionable.`;

                    const completion = await openai.chat.completions.create({
                        model: 'gpt-4o-mini',
                        messages: [{ role: 'user', content: prompt }],
                        temperature: 0.5,
                        max_tokens: 200
                    });

                    result = completion.choices[0]?.message?.content?.trim() || '';
                }
                break;
            }

            default:
                return NextResponse.json({
                    success: false,
                    error: `Unknown action: ${action}. Use draft_outreach, suggest_angle, or summarize_company`
                }, { status: 400 });
        }

        console.log(`[AI Outreach] Generated ${result.length} chars for ${action}`);

        return NextResponse.json({
            success: true,
            result,
            action
        });

    } catch (error: any) {
        console.error('[AI Outreach] Error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'AI service unavailable'
        }, { status: 500 });
    }
}
