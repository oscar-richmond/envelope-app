/**
 * Website Review Scoring Engine
 * 
 * Computes STALENESS/OPPORTUNITY score from scan data.
 * Score = BASE_SCORE (0) + Σ(outdatedness signals), clamped 0-100
 * 
 * HIGHER SCORE = MORE OUTDATED = HIGHER REDESIGN OPPORTUNITY
 * 0-24: Fresh, 25-49: Aging, 50-74: Outdated, 75-100: Very Outdated
 */

import { Factor, ReportResult, computeScoreFromFactors } from './types';

const BASE_SCORE = 0; // Start at 0, add outdatedness signals

export interface WebsiteScanInput {
    isReachable: boolean;
    isHttps: boolean;
    httpStatus?: number;
    daysSinceVerified?: number;
    hasSitemap?: boolean;
    hasRobotsTxt?: boolean;
    pageLoadOk?: boolean;
    error?: string;
}

/**
 * Compute website staleness/opportunity score from raw scan data
 * Higher score = more outdated = higher redesign opportunity
 */
export function computeWebsiteReview(input: WebsiteScanInput): ReportResult {
    const factors: Factor[] = [];

    // OUTDATEDNESS SIGNALS (increase score = more outdated)

    // Factor: Not HTTPS (insecure = outdated practice)
    if (!input.isHttps && input.isReachable) {
        factors.push({
            id: 'no_https',
            label: 'No HTTPS / Insecure',
            points: 25,
            polarity: 'negative',
            description: 'Site uses HTTP instead of HTTPS - outdated security'
        });
    }

    // Factor: Site unreachable (likely abandoned/outdated)
    if (!input.isReachable) {
        factors.push({
            id: 'unreachable',
            label: 'Site unreachable or down',
            points: 40,
            polarity: 'negative',
            description: input.error || 'Could not connect - possibly abandoned'
        });
    }

    // Factor: HTTP errors (broken site = outdated/unmaintained)
    if (input.httpStatus !== undefined && input.httpStatus >= 400) {
        factors.push({
            id: 'http_error',
            label: `Server returns ${input.httpStatus} error`,
            points: 30,
            polarity: 'negative',
            description: 'Broken pages indicate unmaintained site'
        });
    }

    // Factor: Long time since verification (stale check)
    if (input.daysSinceVerified !== undefined) {
        if (input.daysSinceVerified > 180) {
            // 6+ months old check
            factors.push({
                id: 'very_stale_check',
                label: 'Not verified in 6+ months',
                points: 15,
                polarity: 'negative',
                description: 'Long time since last check - likely outdated'
            });
        } else if (input.daysSinceVerified > 90) {
            // 3-6 months
            factors.push({
                id: 'stale_check',
                label: 'Not verified in 3+ months',
                points: 10,
                polarity: 'negative',
                description: 'Moderate time since last check'
            });
        }
    }

    // Factor: Missing modern features (if detectable)
    if (!input.hasSitemap && input.isReachable) {
        factors.push({
            id: 'no_sitemap',
            label: 'No sitemap.xml found',
            points: 5,
            polarity: 'negative',
            description: 'Missing modern SEO practice'
        });
    }

    // FRESHNESS SIGNALS (decrease score = more modern)

    // Factor: HTTPS + reachable + 200 OK = basic modern standards met
    if (input.isHttps && input.isReachable && input.httpStatus === 200) {
        factors.push({
            id: 'modern_basics',
            label: 'Meets modern basics',
            points: -10,
            polarity: 'positive',
            description: 'HTTPS, reachable, and working correctly'
        });
    }

    // Factor: Recently verified (active monitoring = maintained)
    if (input.daysSinceVerified !== undefined && input.daysSinceVerified < 30) {
        factors.push({
            id: 'recently_checked',
            label: 'Recently verified',
            points: -5,
            polarity: 'positive',
            description: 'Checked within last month - actively monitored'
        });
    }

    // Compute staleness score from factors
    // Higher score = more stale/outdated
    const score = computeScoreFromFactors(BASE_SCORE, factors);

    // Determine status label based on staleness score
    // Remember: higher = more outdated
    let statusLabel = 'Fresh';
    if (score >= 75) statusLabel = 'Very Outdated';      // 75-100: Critical redesign opportunity
    else if (score >= 50) statusLabel = 'Outdated';       // 50-74: Clear redesign need
    else if (score >= 25) statusLabel = 'Aging';          // 25-49: Starting to show age
    else statusLabel = 'Fresh';                           // 0-24: Modern/recent

    // Determine confidence based on how much data we have
    let confidence: 'high' | 'medium' | 'low' = 'high';
    if (factors.length <= 1) confidence = 'low';
    else if (factors.length <= 2) confidence = 'medium';

    return {
        score,
        statusLabel,
        factors,
        computedAt: new Date().toISOString(),
        confidence,
        baseScore: BASE_SCORE
    };
}

/**
 * Create a "not scanned" report result
 */
export function createUnscannedWebsiteReport(): ReportResult {
    return {
        score: null,
        statusLabel: 'Not Scanned',
        factors: [],
        computedAt: new Date().toISOString(),
        confidence: 'low',
        baseScore: BASE_SCORE
    };
}

/**
 * Create a failed scan report result
 */
export function createFailedWebsiteReport(reason: string): ReportResult {
    return {
        score: null,
        statusLabel: 'Scan Failed',
        factors: [{
            id: 'scan_failed',
            label: 'Scan could not complete',
            points: 0,
            polarity: 'negative',
            description: reason
        }],
        computedAt: new Date().toISOString(),
        confidence: 'low',
        baseScore: BASE_SCORE
    };
}
