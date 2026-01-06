/**
 * Sender Health Service
 * 
 * Provides sender trust classification and deliverability guidance
 * without using alarmist language like "High Risk"
 */

export type SenderStatus = 'VERIFIED_WARM' | 'VERIFIED_WARMING' | 'UNVERIFIED';

export interface SenderHealth {
    status: SenderStatus;
    statusLabel: string;
    statusDescription: string;

    // Authentication
    spf: 'pass' | 'fail' | 'unknown';
    dkim: 'pass' | 'fail' | 'unknown';
    dmarc: 'monitoring' | 'enforced' | 'none' | 'unknown';

    // Guidance
    recommendedDailyVolume: { min: number; max: number };
    volumeWarning: string | null;

    // Send history
    totalSent: number;
    recentBounces: number;
    recentReplies: number;
    isWarmedUp: boolean;
}

export interface ContentSafeguard {
    type: 'warning' | 'info';
    message: string;
    suggestion: string | null;
}

class SenderHealthService {

    /**
     * Get sender health status
     * This is a simplified version - in production you'd want to
     * actually check DNS records and sending history
     */
    async getSenderHealth(
        gmailConnected: boolean,
        domain: string,
        sendingStats: { totalSent: number; bounces: number; replies: number }
    ): Promise<SenderHealth> {
        // Assume SPF/DKIM pass if Gmail is connected (Google handles this)
        const spf = gmailConnected ? 'pass' : 'unknown';
        const dkim = gmailConnected ? 'pass' : 'unknown';
        const dmarc = gmailConnected ? 'monitoring' : 'unknown';

        // Determine warm status based on sending history
        const isWarmedUp = sendingStats.totalSent > 50 && sendingStats.bounces < 3;
        const isVerified = spf === 'pass' && dkim === 'pass';

        let status: SenderStatus;
        let statusLabel: string;
        let statusDescription: string;

        if (!isVerified) {
            status = 'UNVERIFIED';
            statusLabel = 'Unverified';
            statusDescription = 'Please connect your Gmail account to enable sending.';
        } else if (isWarmedUp) {
            status = 'VERIFIED_WARM';
            statusLabel = 'Verified & Warm';
            statusDescription = 'Your sender reputation is established. You can send at normal volume.';
        } else {
            status = 'VERIFIED_WARMING';
            statusLabel = 'Verified & Warming';
            statusDescription = 'This domain is still warming. Sending slowly helps inbox placement.';
        }

        // Volume guidance based on status
        const recommendedDailyVolume = status === 'VERIFIED_WARM'
            ? { min: 20, max: 40 }
            : { min: 5, max: 15 };

        return {
            status,
            statusLabel,
            statusDescription,
            spf,
            dkim,
            dmarc,
            recommendedDailyVolume,
            volumeWarning: null,
            totalSent: sendingStats.totalSent,
            recentBounces: sendingStats.bounces,
            recentReplies: sendingStats.replies,
            isWarmedUp
        };
    }

    /**
     * Check if daily volume exceeds recommendation
     */
    checkVolumeGuidance(
        todaySent: number,
        recommended: { min: number; max: number }
    ): string | null {
        if (todaySent > recommended.max) {
            return `You've sent ${todaySent} emails today. We recommend ${recommended.min}-${recommended.max} for optimal inbox placement.`;
        }
        return null;
    }

    /**
     * Analyze email content for spam patterns
     */
    analyzeContent(subject: string, body: string): ContentSafeguard[] {
        const safeguards: ContentSafeguard[] = [];

        // Check word count
        const wordCount = body.split(/\s+/).filter(w => w.length > 0).length;
        if (wordCount > 150) {
            safeguards.push({
                type: 'warning',
                message: `Your email is ${wordCount} words. Shorter emails tend to get better responses.`,
                suggestion: 'Consider trimming to under 150 words.'
            });
        }

        // Check for spam-adjacent phrases
        const spamPhrases = [
            'quick question',
            'just checking in',
            'following up again',
            'hope this finds you well'
        ];

        const lowerBody = body.toLowerCase();
        for (const phrase of spamPhrases) {
            if (lowerBody.includes(phrase)) {
                safeguards.push({
                    type: 'info',
                    message: `The phrase "${phrase}" is commonly used in spam. Consider rephrasing.`,
                    suggestion: 'Try a more specific, personal opening.'
                });
                break; // Only show one phrase warning
            }
        }

        // Check for link shorteners
        const shortenerPatterns = ['bit.ly', 'tinyurl', 'goo.gl', 't.co', 'short.io'];
        for (const shortener of shortenerPatterns) {
            if (lowerBody.includes(shortener)) {
                safeguards.push({
                    type: 'warning',
                    message: 'Link shorteners can trigger spam filters.',
                    suggestion: 'Use full URLs instead.'
                });
                break;
            }
        }

        // Check for excessive caps
        const capsRatio = (body.match(/[A-Z]/g) || []).length / body.length;
        if (capsRatio > 0.3 && body.length > 50) {
            safeguards.push({
                type: 'warning',
                message: 'Too many capital letters can trigger spam filters.',
                suggestion: 'Use normal capitalization.'
            });
        }

        return safeguards;
    }

    /**
     * Calculate send delay for pacing
     * Returns milliseconds to wait before sending
     */
    calculateSendDelay(queuePosition: number): number {
        // Base delay: spread sends across the day
        // For a batch of 10 emails, space them out over ~2 hours
        const baseDelayMs = 10 * 60 * 1000; // 10 minutes base

        // Add randomization (±3 minutes)
        const randomMs = (Math.random() - 0.5) * 6 * 60 * 1000;

        return Math.max(0, (queuePosition * baseDelayMs) + randomMs);
    }

    /**
     * Check if CTA is reply-friendly
     */
    hasReplyFriendlyCTA(body: string): boolean {
        const replyFriendlyPatterns = [
            /would you be open/i,
            /happy to share/i,
            /let me know/i,
            /what do you think/i,
            /would that be useful/i,
            /interested in/i,
            /does that sound/i,
            /quick call/i,
            /short chat/i
        ];

        return replyFriendlyPatterns.some(pattern => pattern.test(body));
    }
}

export const senderHealthService = new SenderHealthService();
