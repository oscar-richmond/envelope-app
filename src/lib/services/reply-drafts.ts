/**
 * Reply Draft Generator Service
 * 
 * Generates high-quality reply drafts for responding to inbound emails
 * after intent has been classified (Interested, Not Now, Referred).
 * 
 * Rules:
 * - No em dashes
 * - Short paragraphs (1-2 sentences)
 * - Plain English, calm tone
 * - No re-pitching or sales language
 * - 60-120 words
 */

export type ReplyableIntent = 'INTERESTED' | 'NOT_NOW' | 'REFERRAL';

export interface ReplyDraftInput {
    intent: ReplyableIntent;
    firstName: string;
    companyName: string;
    replyTextRaw: string;
    lastOutboundContext: string;
    referredContactName?: string;
}

export interface ReplyDraft {
    subject: string;
    body: string;
    intent: ReplyableIntent;
}

class ReplyDraftService {
    private senderName = 'Oscar';

    /**
     * Check if intent is replyable (draft should be generated)
     */
    isReplyableIntent(intent: string | null): intent is ReplyableIntent {
        return ['INTERESTED', 'NOT_NOW', 'REFERRAL'].includes(intent || '');
    }

    /**
     * Generate a reply draft based on intent and context
     */
    generateReplyDraft(input: ReplyDraftInput, regenerate: boolean = false): ReplyDraft {
        const variantIndex = regenerate ? Math.floor(Math.random() * 3) : 0;

        switch (input.intent) {
            case 'INTERESTED':
                return this.generateInterestedReply(input, variantIndex);
            case 'NOT_NOW':
                return this.generateNotNowReply(input, variantIndex);
            case 'REFERRAL':
                return this.generateReferralReply(input, variantIndex);
            default:
                throw new Error(`Cannot generate reply for intent: ${input.intent}`);
        }
    }

    /**
     * INTERESTED: They want to talk or learn more
     * Goal: Acknowledge, address their message, suggest call
     */
    private generateInterestedReply(input: ReplyDraftInput, variantIndex: number): ReplyDraft {
        const { firstName, companyName } = input;
        const greeting = `Hi ${firstName},`;

        const openers = [
            `Thanks for getting back to me. That makes sense, and happy to expand on the points I mentioned.`,
            `Thanks for the reply. I appreciate you taking the time to respond, and glad the note was useful.`,
            `Good to hear from you. I appreciate you getting back to me on this.`
        ];

        const middles = [
            `If it's helpful, I'd be glad to walk through a few specific observations on a short call and answer any questions you have. I'm fairly flexible over the next few days, but let me know what works on your side.`,
            `Happy to share more detail on a quick call if that would be useful. I can work around most times this week or next.`,
            `If you'd like to discuss further, I'm available for a short call to walk through my thoughts. Just let me know what works for you.`
        ];

        const opener = openers[variantIndex % openers.length];
        const middle = middles[variantIndex % middles.length];

        const body = this.cleanDraft(`${greeting}

${opener}

${middle}

Best,
${this.senderName}`);

        return {
            subject: `Re: ${companyName}`,
            body,
            intent: 'INTERESTED'
        };
    }

    /**
     * NOT_NOW: Timing issue, not rejection
     * Goal: Acknowledge timing, remove pressure, offer future option
     */
    private generateNotNowReply(input: ReplyDraftInput, variantIndex: number): ReplyDraft {
        const { firstName, companyName } = input;
        const greeting = `Hi ${firstName},`;

        const openers = [
            `Thanks for letting me know, that makes sense. I appreciate the reply.`,
            `Thanks for the honest response. Completely understand.`,
            `Appreciate you getting back to me. That makes total sense.`
        ];

        const middles = [
            `No problem at all to leave this for now. If it's useful, I can check back in later in the year, or I'm also happy to send a short note with a couple of ideas you can look at in your own time.

Just let me know what you'd prefer.`,
            `Happy to leave this for now. If it would be helpful, I can reach out again in a few months when timing might be better.

Either way, no pressure at all.`,
            `Totally understand the timing. I'm happy to check back later if that's useful, or just leave it here for now.

Let me know what works best.`
        ];

        const opener = openers[variantIndex % openers.length];
        const middle = middles[variantIndex % middles.length];

        const body = this.cleanDraft(`${greeting}

${opener}

${middle}

Best,
${this.senderName}`);

        return {
            subject: `Re: ${companyName}`,
            body,
            intent: 'NOT_NOW'
        };
    }

    /**
     * REFERRAL: They passed to someone else
     * Goal: Thank them, acknowledge referral, state next step
     */
    private generateReferralReply(input: ReplyDraftInput, variantIndex: number): ReplyDraft {
        const { firstName, companyName, referredContactName } = input;
        const greeting = `Hi ${firstName},`;
        const contactRef = referredContactName || 'them';

        const openers = [
            `Thanks for pointing me in the right direction, I appreciate it.`,
            `Thanks for the introduction. Really appreciate you taking the time.`,
            `Thanks for passing this on. That's really helpful.`
        ];

        const middles = [
            `I'll reach out to ${contactRef} and share a bit of context so they know why I'm getting in touch. Thanks again for the help.`,
            `I'll follow up with ${contactRef} directly and give them some background. Thanks again for the introduction.`,
            `I'll get in touch with ${contactRef} and explain a bit about what I was suggesting. Appreciate the referral.`
        ];

        const opener = openers[variantIndex % openers.length];
        const middle = middles[variantIndex % middles.length];

        const body = this.cleanDraft(`${greeting}

${opener}

${middle}

Best,
${this.senderName}`);

        return {
            subject: `Re: ${companyName}`,
            body,
            intent: 'REFERRAL'
        };
    }

    /**
     * Clean and validate the draft
     * - Remove em dashes
     * - Ensure proper spacing
     */
    private cleanDraft(text: string): string {
        return text
            .replace(/—/g, ',')           // Replace em dashes with commas
            .replace(/–/g, ',')            // Replace en dashes too
            .replace(/\n{3,}/g, '\n\n')    // Max 2 newlines
            .trim();
    }
}

export const replyDraftService = new ReplyDraftService();
