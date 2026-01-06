import OpenAI from 'openai';

/**
 * Reply Intent Categories (Authoritative)
 */
export type ReplyIntent =
    | 'INTERESTED'      // Wants to engage - call, meeting, question
    | 'NOT_NOW'         // Polite deferral - timing, later, check back
    | 'NOT_INTERESTED'  // Clear rejection - no thanks, remove me
    | 'REFERRAL'        // Forwarding to someone else
    | 'AUTO_REPLY'      // OOO, vacation, auto-acknowledgement
    | 'UNCLEAR';        // Ambiguous, needs manual review

export type IntentResult = {
    intent: ReplyIntent;
    summary: string;
    confidence: number;
    suggestedAction: 'REPLY_MANUALLY' | 'SNOOZE' | 'CLOSE' | 'ADD_CONTACT' | 'AUTO_SCHEDULE' | 'REVIEW';
    returnDate?: string; // For AUTO_REPLY with detected return date
};

/**
 * Legacy type alias for backward compatibility
 */
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

    /**
     * New intent-based classification
     */
    async classifyReplyIntent(replyBody: string, originalSubject: string): Promise<IntentResult> {
        try {
            const completion = await this.openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: `You are an expert assistant analyzing email replies to cold outreach.

Classify the reply into exactly one of these intent categories:

1. INTERESTED - Shows engagement:
   - Mentions call, chat, meeting, discussion
   - Asks a question about services
   - Requests more info or examples
   - Suggests timing for a call
   - Positive tone about exploring further

2. NOT_NOW - Polite deferral:
   - "Not right now", "Maybe later"
   - Mentions timing (next quarter, next month)
   - Busy but not rejecting outright
   - "Check back in..."

3. NOT_INTERESTED - Clear rejection:
   - "No thanks", "Not interested"
   - "Please remove me"
   - "Not relevant to us"
   - Explicit opt-out language

4. REFERRAL - Pointing to someone else:
   - "Speak to X"
   - "Forwarding to the right person"
   - "CC'ing my colleague"
   - Introducing a new contact

5. AUTO_REPLY - Automated response:
   - Out of office messages
   - Vacation auto-responders
   - "I'm away until..."
   - Automated email acknowledgements

6. UNCLEAR - Ambiguous:
   - Very short (1-3 words)
   - Confusing or off-topic
   - Cannot determine intent

Also provide:
- A 1-sentence summary of the reply
- Confidence score (0-100)
- Suggested action: REPLY_MANUALLY, SNOOZE, CLOSE, ADD_CONTACT, AUTO_SCHEDULE, or REVIEW
- If AUTO_REPLY, extract return date if mentioned (format: YYYY-MM-DD)

Return JSON: { "intent": "...", "summary": "...", "confidence": 85, "suggestedAction": "...", "returnDate": null }`
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
                intent: this.validateIntent(result.intent),
                summary: result.summary || "No summary available",
                confidence: result.confidence || 50,
                suggestedAction: this.validateAction(result.suggestedAction),
                returnDate: result.returnDate || undefined
            };

        } catch (e) {
            console.error("Intent Classification Failed:", e);
            return {
                intent: 'UNCLEAR',
                summary: "Classification failed",
                confidence: 0,
                suggestedAction: 'REVIEW'
            };
        }
    }

    private validateIntent(intent: string): ReplyIntent {
        const valid: ReplyIntent[] = ['INTERESTED', 'NOT_NOW', 'NOT_INTERESTED', 'REFERRAL', 'AUTO_REPLY', 'UNCLEAR'];
        return valid.includes(intent as ReplyIntent) ? (intent as ReplyIntent) : 'UNCLEAR';
    }

    private validateAction(action: string): IntentResult['suggestedAction'] {
        const valid = ['REPLY_MANUALLY', 'SNOOZE', 'CLOSE', 'ADD_CONTACT', 'AUTO_SCHEDULE', 'REVIEW'];
        return valid.includes(action) ? (action as IntentResult['suggestedAction']) : 'REVIEW';
    }

    /**
     * Legacy method for backward compatibility
     * Maps new intents to old sentiment types
     */
    async analyzeReply(replyBody: string, originalSubject: string): Promise<SentimentResult> {
        const result = await this.classifyReplyIntent(replyBody, originalSubject);

        // Map new intents to legacy sentiments
        let sentiment: SentimentResult['sentiment'];
        switch (result.intent) {
            case 'INTERESTED':
                sentiment = 'INTERESTED';
                break;
            case 'NOT_INTERESTED':
                sentiment = 'NOT_INTERESTED';
                break;
            case 'AUTO_REPLY':
                sentiment = 'OOO';
                break;
            default:
                sentiment = 'OTHER';
        }

        return {
            sentiment,
            summary: result.summary,
            confidence: result.confidence
        };
    }
}

export const sentimentService = new SentimentService();
