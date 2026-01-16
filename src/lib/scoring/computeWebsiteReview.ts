/**
 * Website Review Scoring Engine
 * 
 * Computes STALENESS/OPPORTUNITY score from scan data.
 * 
 * SCORING SPEC (v2):
 * - baseScore = 50 (neutral starting point)
 * - Score = clamp(baseScore + Σ(factor.points), 0, 100)
 * - Lower score = fresher/better (0 = perfect)
 * - Higher score = more outdated/worse (100 = critical)
 * 
 * FACTOR POLARITY:
 * - polarity:"positive" = points are NEGATIVE (reduces staleness, improves score)
 * - polarity:"negative" = points are POSITIVE (increases staleness, worsens score)
 * 
 * LABELS:
 * - 0-24: Fresh
 * - 25-49: Aging  
 * - 50-74: Outdated
 * - 75-100: Critical
 */

import { Factor, ReportResult, computeScoreFromFactors } from './types';

const BASE_SCORE = 50; // Neutral middle ground
const MODEL_VERSION = 2; // Track scoring model changes

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
 * Lower score = fresher, Higher score = more outdated
 */
export function computeWebsiteReview(input: WebsiteScanInput): ReportResult {
    const factors: Factor[] = [];

    // FRESHNESS SIGNALS (reduce staleness = negative points, positive polarity)

    // Factor: Modern basics (HTTPS + reachable + 200)
    if (input.isHttps && input.isReachable && input.httpStatus === 200) {
        factors.push({
            id: 'modern_basics',
            label: 'Modern standards met',
            points: -15,  // Reduces staleness significantly
            polarity: 'positive',
            description: 'HTTPS, reachable, and returns 200 OK'
        });
    }

    // Factor: Recently verified (active maintenance)
    if (input.daysSinceVerified !== undefined && input.daysSinceVerified < 30) {
        factors.push({
            id: 'recently_checked',
            label: 'Recently maintained',
            points: -10,  // Reduces staleness
            polarity: 'positive',
            description: 'Verified within last 30 days - actively monitored'
        });
    }

    // OUTDATEDNESS SIGNALS (increase staleness = positive points, negative polarity)

    // Factor: Not HTTPS (outdated security)
    if (!input.isHttps && input.isReachable) {
        factors.push({
            id: 'no_https',
            label: 'No HTTPS',
            points: 20,  // Increases staleness significantly
            polarity: 'negative',
            description: 'Uses HTTP instead of HTTPS - outdated security practice'
        });
    }

    // Factor: Site unreachable (likely abandoned)
    if (!input.isReachable) {
        factors.push({
            id: 'unreachable',
            label: 'Site unreachable',
            points: 35,  // Increases staleness heavily
            polarity: 'negative',
            description: input.error || 'Cannot connect - possibly abandoned or down'
        });
    }

    // Factor: HTTP errors (broken/unmaintained)
    if (input.httpStatus !== undefined && input.httpStatus >= 400) {
        factors.push({
            id: 'http_error',
            label: `Server error ${input.httpStatus}`,
            points: 25,  // Increases staleness
            polarity: 'negative',
            description: 'Server errors indicate unmaintained site'
        });
    }

    // Factor: Long time without verification (stale data)
    if (input.daysSinceVerified !== undefined) {
        if (input.daysSinceVerified > 180) {
            factors.push({
                id: 'very_stale_check',
                label: 'Not checked in 6+ months',
                points: 15,  // Increases staleness
                polarity: 'negative',
                description: 'Long time since verification - data may be stale'
            });
        } else if (input.daysSinceVerified > 90) {
            factors.push({
                id: 'stale_check',
                label: 'Not checked in 3+ months',
                points: 8,  // Increases staleness moderately
                polarity: 'negative',
                description: 'Moderate time since last check'
            });
        }
    }

    // Factor: Missing modern SEO (minor signal)
    if (!input.hasSitemap && input.isReachable) {
        factors.push({
            id: 'no_sitemap',
            label: 'No sitemap.xml',
            points: 5,  // Increases staleness slightly
            polarity: 'negative',
            description: 'Missing sitemap - less modern SEO practice'
        });
    }

    // Compute staleness score
    // Formula: score = clamp(BASE_SCORE + Σ(points), 0, 100)
    const score = computeScoreFromFactors(BASE_SCORE, factors);

    // Determine label from score (lower = better)
    let statusLabel = 'Fresh';
    if (score >= 75) statusLabel = 'Critical';         // 75-100: Very serious issues
    else if (score >= 50) statusLabel = 'Outdated';     // 50-74: Clear redesign need
    else if (score >= 25) statusLabel = 'Aging';        // 25-49: Starting to show age
    else statusLabel = 'Fresh';                         // 0-24: Modern/recent

    // Determine confidence
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
