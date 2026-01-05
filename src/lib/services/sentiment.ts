import OpenAI from 'openai';
import prisma from '@/lib/prisma';

export type SentimentResult = {
    sentiment: 'INTERESTED' | 'NOT_INTERESTED' | 'OOO' | 'OTHER';
    summary: string;
    confidence: number;
};

export class SentimentService {
    private openai: OpenAI;

    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }

    async analyzeReply(replyBody: string, originalSubject: string): Promise<SentimentResult> {
        try {
            const completion = await this.openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: `You are an expert sales assistant analyzing email replies.
                        
                        Classify the reply into exactly one of these categories:
                        - INTERESTED: Positive signal, asking for a call, asking for more info, or agreeing to review.
                        - NOT_INTERESTED: Explicit "no", "unsubscribe", "remove me", "not right now", or ignore request.
                        - OOO: Auto-replies saying they are out of office or away.
                        - OTHER: Ambiguous, confusing, or doesn't fit the above.

                        Also provide a 1-sentence summary of the reply context.
                        Provide a confidence score (0-100).
                        
                        Return JSON format: { "sentiment": "ENUM_VALUE", "summary": "...", "confidence": 85 }`
                    },
                    {
                        role: "user",
                        content: `Original Subject: "${originalSubject}"
                        
                        Reply Body:
                        """
                        ${replyBody.substring(0, 2000)}
                        """`
                    }
                ],
                response_format: { type: "json_object" }
            });

            const content = completion.choices[0].message.content;
            if (!content) throw new Error("No content from OpenAI");

            const result = JSON.parse(content);

            return {
                sentiment: result.sentiment || 'OTHER',
                summary: result.summary || "No summary available",
                confidence: result.confidence || 50
            };

        } catch (e) {
            console.error("Sentiment Analysis Failed:", e);
            return { sentiment: 'OTHER', summary: "Analysis failed", confidence: 0 };
        }
    }
}

export const sentimentService = new SentimentService();
