/**
 * Phase 8: Deliverability Guardrails Service
 * Throttling, content scanning, and risk protection
 */

// ============================================
// TYPES
// ============================================

export interface ThrottleConfig {
    maxPerDay: number;
    maxPerHour: number;
    minGapMinutes: number; // Will add random jitter
    maxGapMinutes: number;
}

export interface SendingStats {
    todaySent: number;
    hourSent: number;
    lastSentAt: string | null;
    bounceCount: number;
    totalSent: number;
    replyCount: number;
    spamWarnings: number;
}

export interface RiskStatus {
    level: 'healthy' | 'warning' | 'critical' | 'paused';
    bounceRate: number;
    replyRate: number;
    verificationPassRate: number;
    isPaused: boolean;
    pauseReason?: string;
    recommendations: string[];
}

export interface ContentScanResult {
    isClean: boolean;
    warnings: ContentWarning[];
    score: number; // 0-100, higher = more risky
}

export interface ContentWarning {
    type: 'spam_phrase' | 'excessive_links' | 'formatting' | 'punctuation' | 'missing_unsubscribe';
    severity: 'info' | 'warning' | 'error';
    message: string;
    suggestion?: string;
}

// ============================================
// DEFAULT CONFIG
// ============================================

export const DEFAULT_THROTTLE_CONFIG: ThrottleConfig = {
    maxPerDay: 30,
    maxPerHour: 6,
    minGapMinutes: 3,
    maxGapMinutes: 5,
};

// ============================================
// THROTTLE STATE (in-memory, use DB in prod)
// ============================================

const sendingStats: Map<string, SendingStats> = new Map();

export function getSendingStats(userId: string): SendingStats {
    if (!sendingStats.has(userId)) {
        sendingStats.set(userId, {
            todaySent: 0,
            hourSent: 0,
            lastSentAt: null,
            bounceCount: 0,
            totalSent: 0,
            replyCount: 0,
            spamWarnings: 0,
        });
    }
    return sendingStats.get(userId)!;
}

export function recordSend(userId: string): void {
    const stats = getSendingStats(userId);
    stats.todaySent++;
    stats.hourSent++;
    stats.totalSent++;
    stats.lastSentAt = new Date().toISOString();
    sendingStats.set(userId, stats);
}

export function recordBounce(userId: string): void {
    const stats = getSendingStats(userId);
    stats.bounceCount++;
    sendingStats.set(userId, stats);
}

export function recordReply(userId: string): void {
    const stats = getSendingStats(userId);
    stats.replyCount++;
    sendingStats.set(userId, stats);
}

export function recordSpamWarning(userId: string): void {
    const stats = getSendingStats(userId);
    stats.spamWarnings++;
    sendingStats.set(userId, stats);
}

// Reset hourly counts (call via cron)
export function resetHourlyCounts(): void {
    sendingStats.forEach((stats, userId) => {
        stats.hourSent = 0;
        sendingStats.set(userId, stats);
    });
}

// Reset daily counts (call via cron at midnight)
export function resetDailyCounts(): void {
    sendingStats.forEach((stats, userId) => {
        stats.todaySent = 0;
        sendingStats.set(userId, stats);
    });
}

// ============================================
// THROTTLE CHECKS
// ============================================

export interface ThrottleResult {
    canSend: boolean;
    reason?: string;
    nextAvailableAt?: string;
    waitMs?: number;
}

export function checkThrottle(
    userId: string,
    config: ThrottleConfig = DEFAULT_THROTTLE_CONFIG
): ThrottleResult {
    const stats = getSendingStats(userId);

    // Check daily limit
    if (stats.todaySent >= config.maxPerDay) {
        return {
            canSend: false,
            reason: `Daily limit reached (${config.maxPerDay}/day)`,
            nextAvailableAt: getNextMidnight().toISOString(),
        };
    }

    // Check hourly limit
    if (stats.hourSent >= config.maxPerHour) {
        const nextHour = new Date();
        nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
        return {
            canSend: false,
            reason: `Hourly limit reached (${config.maxPerHour}/hour)`,
            nextAvailableAt: nextHour.toISOString(),
        };
    }

    // Check minimum gap with jitter
    if (stats.lastSentAt) {
        const lastSent = new Date(stats.lastSentAt);
        const jitter = config.minGapMinutes + Math.random() * (config.maxGapMinutes - config.minGapMinutes);
        const minNextSend = new Date(lastSent.getTime() + jitter * 60 * 1000);

        if (new Date() < minNextSend) {
            return {
                canSend: false,
                reason: `Please wait before sending again`,
                nextAvailableAt: minNextSend.toISOString(),
                waitMs: minNextSend.getTime() - Date.now(),
            };
        }
    }

    return { canSend: true };
}

function getNextMidnight(): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
}

// ============================================
// RISK ASSESSMENT
// ============================================

export function assessRisk(userId: string): RiskStatus {
    const stats = getSendingStats(userId);
    const recommendations: string[] = [];

    // Calculate rates
    const bounceRate = stats.totalSent > 0 ? (stats.bounceCount / stats.totalSent) * 100 : 0;
    const replyRate = stats.totalSent > 0 ? (stats.replyCount / stats.totalSent) * 100 : 0;
    const verificationPassRate = 85; // TODO: Calculate from actual verification data

    let level: RiskStatus['level'] = 'healthy';
    let isPaused = false;
    let pauseReason: string | undefined;

    // Check bounce rate
    if (bounceRate > 5) {
        level = 'critical';
        isPaused = true;
        pauseReason = 'Bounce rate exceeds 5%';
        recommendations.push('Verify emails before sending');
    } else if (bounceRate > 3) {
        level = 'warning';
        recommendations.push('Bounce rate is elevated - review email list quality');
    }

    // Check spam warnings
    if (stats.spamWarnings > 2) {
        level = 'critical';
        isPaused = true;
        pauseReason = 'Multiple spam warnings detected';
        recommendations.push('Review email content and remove spammy language');
    } else if (stats.spamWarnings > 0) {
        if (level !== 'critical') level = 'warning';
        recommendations.push('Spam warning detected - review recent emails');
    }

    // Check reply rate (low reply can indicate issues)
    if (stats.totalSent > 20 && replyRate < 1) {
        recommendations.push('Low reply rate - consider improving subject lines');
    }

    if (recommendations.length === 0) {
        recommendations.push('All metrics healthy');
    }

    return {
        level,
        bounceRate: Math.round(bounceRate * 10) / 10,
        replyRate: Math.round(replyRate * 10) / 10,
        verificationPassRate,
        isPaused,
        pauseReason,
        recommendations,
    };
}

// ============================================
// CONTENT SCANNING
// ============================================

const SPAM_PHRASES = [
    'act now', 'limited time', 'urgent', 'free money', 'click here',
    'guaranteed', 'no obligation', 'winner', 'congratulations',
    'double your', 'earn extra', 'once in a lifetime', 'risk-free',
    'special promotion', 'this is not spam', 'unsubscribe',
];

const LINK_REGEX = /https?:\/\/[^\s]+/gi;
const EM_DASH_REGEX = /[—–]/g;

export function scanContent(subject: string, body: string): ContentScanResult {
    const warnings: ContentWarning[] = [];
    let score = 0;

    const fullText = `${subject} ${body}`.toLowerCase();

    // Check spam phrases
    for (const phrase of SPAM_PHRASES) {
        if (fullText.includes(phrase)) {
            warnings.push({
                type: 'spam_phrase',
                severity: 'warning',
                message: `Contains spammy phrase: "${phrase}"`,
                suggestion: 'Consider rephrasing',
            });
            score += 15;
        }
    }

    // Check excessive links
    const links = body.match(LINK_REGEX) || [];
    if (links.length > 3) {
        warnings.push({
            type: 'excessive_links',
            severity: 'warning',
            message: `Contains ${links.length} links (recommended: max 3)`,
            suggestion: 'Reduce number of links',
        });
        score += 20;
    }

    // Check em-dash/en-dash
    if (EM_DASH_REGEX.test(body) || EM_DASH_REGEX.test(subject)) {
        warnings.push({
            type: 'punctuation',
            severity: 'info',
            message: 'Contains em-dash or en-dash',
            suggestion: 'Replace with hyphen (-) for better compatibility',
        });
        score += 5;
    }

    // Check for ALL CAPS words
    const capsWords = (subject + ' ' + body).match(/\b[A-Z]{4,}\b/g) || [];
    if (capsWords.length > 2) {
        warnings.push({
            type: 'formatting',
            severity: 'warning',
            message: 'Contains multiple ALL CAPS words',
            suggestion: 'Use normal capitalization',
        });
        score += 10;
    }

    // Check for excessive exclamation marks
    const exclamations = (subject + body).match(/!/g) || [];
    if (exclamations.length > 2) {
        warnings.push({
            type: 'formatting',
            severity: 'info',
            message: 'Contains multiple exclamation marks',
            suggestion: 'Reduce excitement - one ! is usually enough',
        });
        score += 5;
    }

    return {
        isClean: warnings.filter(w => w.severity === 'error' || w.severity === 'warning').length === 0,
        warnings,
        score: Math.min(score, 100),
    };
}

// Clean content (auto-fix some issues)
export function cleanContent(text: string): string {
    let cleaned = text;

    // Replace em-dash/en-dash with hyphen
    cleaned = cleaned.replace(/[—–]/g, '-');

    // Reduce multiple exclamation marks
    cleaned = cleaned.replace(/!{2,}/g, '!');

    return cleaned;
}
