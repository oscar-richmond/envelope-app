import OpenAI from 'openai';

/**
 * Reply Intent Categories (Extended)
 */
export type ReplyIntent =
    | 'POSITIVE'          // Wants to engage - call, meeting, booking
    | 'NEUTRAL_QUESTION'  // Asking clarifying questions
    | 'OBJECTION'         // Price concern, already have provider, not priority
    | 'NOT_INTERESTED'    // Clear rejection - no thanks, remove me
    | 'WRONG_PERSON'      // Not the decision maker, forwarding
    | 'AUTO_REPLY'        // OOO, vacation, auto-acknowledgement
    | 'UNCLEAR';          // Ambiguous, needs manual review

/**
 * Suggested Actions based on Intent
 */
export type SuggestedAction =
    | 'DRAFT_REPLY'       // Need to respond (positive, questions, objections)
    | 'SEND_BOOKING_LINK' // Ready to book a call
    | 'HANDLE_OBJECTION'  // Address their concern
    | 'REQUEST_REFERRAL'  // Ask wrong person for referral
    | 'MARK_CLOSED'       // Not interested, close politely
    | 'WAIT_RETURN'       // OOO - wait for return date
    | 'REVIEW';           // Unclear, needs manual review

export type IntentResult = {
    intent: ReplyIntent;
    summary: string;
    confidence: number;
    suggestedAction: SuggestedAction;
    returnDate?: string; // For AUTO_REPLY with detected return date
    objectionType?: string; // For OBJECTION - what the concern is
};

/**
 * Legacy type alias for backward compatibility
 */
export type SentimentResult = {
    sentiment: 'INTERESTED' | 'NOT_INTERESTED' | 'OOO' | 'OTHER';
    summary: string;
    confidence: number;
};

/**
 * Action labels for UI display
 */
export const ACTION_LABELS: Record<SuggestedAction, { label: string; cta: string; variant: 'primary' | 'secondary' | 'warning' | 'danger' }> = {
    DRAFT_REPLY: { label: 'Reply needed', cta: 'Draft Reply', variant: 'primary' },
    SEND_BOOKING_LINK: { label: 'Ready to book', cta: 'Send Booking Link', variant: 'primary' },
    HANDLE_OBJECTION: { label: 'Handle objection', cta: 'Address Concern', variant: 'warning' },
    REQUEST_REFERRAL: { label: 'Wrong person', cta: 'Ask for Referral', variant: 'secondary' },
    MARK_CLOSED: { label: 'Close thread', cta: 'Mark Closed', variant: 'danger' },
    WAIT_RETURN: { label: 'Out of office', cta: 'Set Reminder', variant: 'secondary' },
    REVIEW: { label: 'Needs review', cta: 'Review Manually', variant: 'secondary' }
};

/**
 * Intent badge styling
 */
export const INTENT_STYLES: Record<ReplyIntent, { bg: string; text: string; label: string }> = {
    POSITIVE: { bg: 'rgba(16, 185, 129, 0.15)', text: 'rgb(5, 150, 105)', label: 'Interested' },
    NEUTRAL_QUESTION: { bg: 'rgba(59, 130, 246, 0.15)', text: 'rgb(37, 99, 235)', label: 'Question' },
    OBJECTION: { bg: 'rgba(245, 158, 11, 0.15)', text: 'rgb(180, 120, 20)', label: 'Objection' },
    NOT_INTERESTED: { bg: 'rgba(239, 68, 68, 0.15)', text: 'rgb(220, 38, 38)', label: 'Not Interested' },
    WRONG_PERSON: { bg: 'rgba(139, 92, 246, 0.15)', text: 'rgb(124, 58, 237)', label: 'Wrong Person' },
    AUTO_REPLY: { bg: 'rgba(107, 114, 128, 0.15)', text: 'rgb(75, 85, 99)', label: 'Auto-Reply' },
    UNCLEAR: { bg: 'rgba(107, 114, 128, 0.15)', text: 'rgb(107, 114, 128)', label: 'Unclear' }
};

export class SentimentService {
    private openai: OpenAI;

    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }

    /**
     * Enhanced intent-based classification with action mapping
     */
    async classifyReplyIntent(replyBody: string, originalSubject: string): Promise<IntentResult> {
        try {
            if (!process.env.OPENAI_API_KEY) {
                console.warn('No OpenAI API key configured');
                return {
                    intent: 'UNCLEAR',
                    summary: "API key not configured",
                    confidence: 0,
                    suggestedAction: 'REVIEW'
                };
            }

            const completion = await this.openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: `You are an expert assistant analyzing email replies to B2B cold outreach.

Classify the reply into exactly one of these intent categories:

1. POSITIVE - Shows clear engagement:
   - Wants to schedule a call/meeting
   - Asks "when are you available?"
   - Expresses genuine interest in services
   - Positive tone about moving forward

2. NEUTRAL_QUESTION - Seeking clarification:
   - Asks about pricing, process, or details
   - "How does this work?"
   - "Can you tell me more about X?"
   - Not committing but not rejecting

3. OBJECTION - Has a specific concern:
   - "Too expensive" / budget concerns
   - "We already have a provider"
   - "Not a priority right now"
   - "Too small/big for this"
   - Mentions a blocker that could be addressed

4. NOT_INTERESTED - Clear rejection:
   - "No thanks", "Not interested"
   - "Please remove me from your list"
   - "Not relevant to us"
   - Explicit opt-out

5. WRONG_PERSON - Not the decision maker:
   - "I'm not the right person"
   - "You should speak to [name]"
   - "Forwarding to the right team"
   - "CC'ing my colleague who handles this"

6. AUTO_REPLY - Automated response:
   - Out of office messages
   - Vacation auto-responders
   - "I'm away until..."
   - Generic auto-acknowledgement

7. UNCLEAR - Cannot determine:
   - Very short (1-3 words like "thanks" or "ok")
   - Off-topic response
   - Ambiguous meaning

Based on the intent, suggest an action:
- POSITIVE → SEND_BOOKING_LINK
- NEUTRAL_QUESTION → DRAFT_REPLY
- OBJECTION → HANDLE_OBJECTION
- NOT_INTERESTED → MARK_CLOSED
- WRONG_PERSON → REQUEST_REFERRAL
- AUTO_REPLY → WAIT_RETURN
- UNCLEAR → REVIEW

Also provide:
- A 1-sentence summary of the reply
- Confidence score (0-100)
- If OBJECTION, specify the objection type (e.g., "budget", "timing", "existing_provider")
- If AUTO_REPLY, extract return date if mentioned (format: YYYY-MM-DD)

Return JSON: { "intent": "...", "summary": "...", "confidence": 85, "suggestedAction": "...", "objectionType": null, "returnDate": null }`
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
                objectionType: result.objectionType || undefined,
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
        const valid: ReplyIntent[] = ['POSITIVE', 'NEUTRAL_QUESTION', 'OBJECTION', 'NOT_INTERESTED', 'WRONG_PERSON', 'AUTO_REPLY', 'UNCLEAR'];
        return valid.includes(intent as ReplyIntent) ? (intent as ReplyIntent) : 'UNCLEAR';
    }

    private validateAction(action: string): SuggestedAction {
        const valid: SuggestedAction[] = ['DRAFT_REPLY', 'SEND_BOOKING_LINK', 'HANDLE_OBJECTION', 'REQUEST_REFERRAL', 'MARK_CLOSED', 'WAIT_RETURN', 'REVIEW'];
        return valid.includes(action as SuggestedAction) ? (action as SuggestedAction) : 'REVIEW';
    }

    /**
     * Generate AI reply draft based on intent
     */
    async generateReplyDraft(
        intent: ReplyIntent,
        threadContent: string,
        contactName: string,
        objectionType?: string
    ): Promise<string> {
        try {
            if (!process.env.OPENAI_API_KEY) {
                return '';
            }

            let prompt = '';

            switch (intent) {
                case 'POSITIVE':
                    prompt = `The prospect is interested in scheduling a call. Draft a brief, enthusiastic reply that:
- Thanks them for their interest
- Suggests 2-3 specific times for a call this week
- Keeps it to 2-3 sentences`;
                    break;

                case 'NEUTRAL_QUESTION':
                    prompt = `The prospect asked a clarifying question. Draft a helpful reply that:
- Directly answers their question
- Provides brief, relevant information
- Ends with a soft call-to-action`;
                    break;

                case 'OBJECTION':
                    prompt = `The prospect raised an objection${objectionType ? ` about ${objectionType}` : ''}. Draft a reply that:
- Acknowledges their concern without being defensive
- Addresses it with a brief, compelling point
- Suggests a brief call to discuss if relevant
- Respects their time`;
                    break;

                case 'WRONG_PERSON':
                    prompt = `The prospect indicated they're not the right person. Draft a polite reply that:
- Thanks them for letting you know
- Asks if they could forward to the right person or share a name
- Keeps it very brief (2 sentences max)`;
                    break;

                case 'NOT_INTERESTED':
                    prompt = `The prospect is not interested. Draft a graceful close that:
- Thanks them for their time
- Respects their decision without pushiness
- Leaves the door open for future (optional)
- Maximum 2 sentences`;
                    break;

                default:
                    return '';
            }

            const completion = await this.openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: `You draft professional email replies for B2B outreach. 
Be concise, warm, and professional. No hard selling.
Do NOT include subject line or signature - just the body.`
                    },
                    {
                        role: "user",
                        content: `${prompt}

Contact name: ${contactName}
Thread context:
${threadContent.substring(0, 1500)}

Generate the reply body with greeting (Hi ${contactName.split(' ')[0]},) but no signature.`
                    }
                ],
                max_tokens: 250,
                temperature: 0.7
            });

            return completion.choices[0]?.message?.content || '';

        } catch (e) {
            console.error("Reply draft generation failed:", e);
            return '';
        }
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
            case 'POSITIVE':
            case 'NEUTRAL_QUESTION':
                sentiment = 'INTERESTED';
                break;
            case 'NOT_INTERESTED':
            case 'OBJECTION':
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
