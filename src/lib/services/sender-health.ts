/**
 * Sender Health Service
 * 
 * Provides sender trust classification and deliverability guidance
 * without using alarmist language like "High Risk"
 * 
 * Statuses:
 * - VERIFIED_WARM: Established reputation
 * - VERIFIED_WARMING: Building reputation (conservative sending)
 * - COOLING_DOWN: Spam complaint or negative signal (protective pause)
 * - UNVERIFIED: Not connected or auth fails
 */

export type SenderStatus =
    | 'VERIFIED_WARM'
    | 'VERIFIED_WARMING'
    | 'COOLING_DOWN'
    | 'UNVERIFIED';

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

    // Protection state
    isCoolingDown: boolean;
    coolingDownReason: string | null;
}

export interface ContentSafeguard {
    type: 'warning' | 'info';
    message: string;
    suggestion: string | null;
}

export interface RecipientRiskCheck {
    isRisky: boolean;
    reason: string | null;
    severity: 'block' | 'warn' | 'ok';
}

// Free email domains to suppress during warming
const FREE_EMAIL_DOMAINS = [
    'gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com',
    'aol.com', 'icloud.com', 'mail.com', 'protonmail.com'
];

// Role inboxes to suppress during warming
const ROLE_PREFIXES = [
    'info', 'admin', 'enquiries', 'support', 'contact',
    'sales', 'hello', 'team', 'office', 'help', 'general'
];

class SenderHealthService {

    /**
     * Get sender health status
     */
    async getSenderHealth(
        gmailConnected: boolean,
        domain: string,
        sendingStats: {
            totalSent: number;
            bounces: number;
            replies: number;
            spamComplaints?: number;
            lastSpamComplaintAt?: Date | null;
        }
    ): Promise<SenderHealth> {
        const spf = gmailConnected ? 'pass' : 'unknown';
        const dkim = gmailConnected ? 'pass' : 'unknown';
        const dmarc = gmailConnected ? 'monitoring' : 'unknown';

        const isVerified = spf === 'pass' && dkim === 'pass';
        const isWarmedUp = sendingStats.totalSent > 50 && sendingStats.bounces < 3;

        // Check for cooling down state
        const hasRecentSpamComplaint = sendingStats.lastSpamComplaintAt &&
            (Date.now() - new Date(sendingStats.lastSpamComplaintAt).getTime()) < 72 * 60 * 60 * 1000; // 72 hours
        const hasTooManyBounces = sendingStats.bounces >= 3;
        const isCoolingDown = hasRecentSpamComplaint || hasTooManyBounces;

        let status: SenderStatus;
        let statusLabel: string;
        let statusDescription: string;
        let coolingDownReason: string | null = null;

        if (!isVerified) {
            status = 'UNVERIFIED';
            statusLabel = 'Unverified';
            statusDescription = 'Please connect your Gmail account to enable sending.';
        } else if (isCoolingDown) {
            status = 'COOLING_DOWN';
            statusLabel = 'Cooling Down';
            statusDescription = 'A short pause helps protect inbox placement. Sending will resume at lower volume.';
            coolingDownReason = hasRecentSpamComplaint
                ? 'Recent spam complaint detected'
                : 'Multiple bounces detected';
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
        let recommendedDailyVolume: { min: number; max: number };
        switch (status) {
            case 'VERIFIED_WARM':
                recommendedDailyVolume = { min: 20, max: 40 };
                break;
            case 'COOLING_DOWN':
                recommendedDailyVolume = { min: 2, max: 5 }; // Very conservative
                break;
            case 'VERIFIED_WARMING':
            default:
                recommendedDailyVolume = { min: 5, max: 10 }; // Conservative for warming
                break;
        }

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
            isWarmedUp,
            isCoolingDown,
            coolingDownReason
        };
    }

    /**
     * Check if daily volume exceeds recommendation
     */
    checkVolumeGuidance(
        todaySent: number,
        recommended: { min: number; max: number }
    ): string | null {
        if (todaySent >= recommended.max) {
            return `You've sent ${todaySent} emails today. We recommend ${recommended.min}-${recommended.max} for optimal inbox placement.`;
        }
        if (todaySent >= recommended.max - 2) {
            return `Approaching daily limit. Consider pausing to protect inbox placement.`;
        }
        return null;
    }

    /**
     * Check if recipient is risky during warming/cooling states
     */
    checkRecipientRisk(
        email: string,
        senderStatus: SenderStatus
    ): RecipientRiskCheck {
        const emailLower = email.toLowerCase();
        const [localPart, domain] = emailLower.split('@');

        // Only apply during warming or cooling
        if (senderStatus === 'VERIFIED_WARM') {
            return { isRisky: false, reason: null, severity: 'ok' };
        }

        // Check free email domains
        if (FREE_EMAIL_DOMAINS.includes(domain)) {
            const severity = senderStatus === 'COOLING_DOWN' ? 'block' : 'warn';
            return {
                isRisky: true,
                reason: 'Personal email addresses are higher risk during warming. Consider sending to business addresses.',
                severity
            };
        }

        // Check role inboxes
        if (ROLE_PREFIXES.some(prefix => localPart === prefix || localPart.startsWith(prefix + '.'))) {
            return {
                isRisky: true,
                reason: 'Role inboxes (info@, support@, etc.) are higher risk. Consider finding a direct contact.',
                severity: 'warn'
            };
        }

        return { isRisky: false, reason: null, severity: 'ok' };
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
            'hope this finds you well',
            'touching base',
            'wanted to reach out',
            'circling back'
        ];

        const lowerBody = body.toLowerCase();
        for (const phrase of spamPhrases) {
            if (lowerBody.includes(phrase)) {
                safeguards.push({
                    type: 'info',
                    message: `The phrase "${phrase}" is commonly used in spam. Consider rephrasing.`,
                    suggestion: 'Try a more specific, personal opening.'
                });
                break;
            }
        }

        // Check for link shorteners
        const shortenerPatterns = ['bit.ly', 'tinyurl', 'goo.gl', 't.co', 'short.io', 'ow.ly'];
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

        // Check for too many links
        const linkCount = (body.match(/https?:\/\//g) || []).length;
        if (linkCount > 1) {
            safeguards.push({
                type: 'warning',
                message: 'Multiple links can hurt deliverability.',
                suggestion: 'Try to use 0-1 links only.'
            });
        }

        return safeguards;
    }

    /**
     * Calculate send delay for pacing
     */
    calculateSendDelay(queuePosition: number, senderStatus: SenderStatus): number {
        // Longer delays when cooling or warming
        let baseDelayMs: number;
        switch (senderStatus) {
            case 'COOLING_DOWN':
                baseDelayMs = 30 * 60 * 1000; // 30 minutes
                break;
            case 'VERIFIED_WARMING':
                baseDelayMs = 15 * 60 * 1000; // 15 minutes
                break;
            default:
                baseDelayMs = 10 * 60 * 1000; // 10 minutes
        }

        // Add randomization (±5 minutes)
        const randomMs = (Math.random() - 0.5) * 10 * 60 * 1000;

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

    /**
     * Get safe testing guidance message (show once per session)
     */
    getTestingGuidance(): string {
        return 'When testing, send only to trusted contacts and ask them to reply or delete. Marking emails as spam during testing can hurt inbox placement.';
    }
}

export const senderHealthService = new SenderHealthService();
