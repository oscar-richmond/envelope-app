/**
 * Website Review Scoring Engine
 * 
 * Computes website health score from scan data.
 * Score = BASE_SCORE (50) + Σ(factor.points), clamped 0-100
 */

import { Factor, ReportResult, computeScoreFromFactors } from './types';

const BASE_SCORE = 50;

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
 * Compute website review from raw scan data
 * 
 * All factors are determined from actual scan results - no fabrication
 */
export function computeWebsiteReview(input: WebsiteScanInput): ReportResult {
    const factors: Factor[] = [];

    // Factor: Reachability
    if (input.isReachable) {
        factors.push({
            id: 'reachable',
            label: 'Website is reachable',
            points: 20,
            polarity: 'positive',
            description: 'Site responds to requests'
        });
    } else {
        factors.push({
            id: 'unreachable',
            label: 'Website may be unreachable',
            points: -20,
            polarity: 'negative',
            description: input.error || 'Could not connect to website'
        });
    }

    // Factor: HTTPS
    if (input.isHttps) {
        factors.push({
            id: 'https',
            label: 'SSL certificate is active',
            points: 10,
            polarity: 'positive',
            description: 'HTTPS enabled for secure connections'
        });
    }

    // Factor: HTTP Status
    if (input.httpStatus !== undefined) {
        if (input.httpStatus >= 200 && input.httpStatus < 300) {
            factors.push({
                id: 'http_ok',
                label: 'Website returns 200 OK',
                points: 10,
                polarity: 'positive',
                description: 'Server returns successful response'
            });
        } else if (input.httpStatus >= 400) {
            factors.push({
                id: 'http_error',
                label: `Website returns ${input.httpStatus} error`,
                points: -15,
                polarity: 'negative',
                description: 'Server returns error response'
            });
        }
    }

    // Factor: Verification recency
    if (input.daysSinceVerified !== undefined) {
        if (input.daysSinceVerified < 7) {
            factors.push({
                id: 'recent_verify',
                label: 'Recently verified',
                points: 10,
                polarity: 'positive',
                description: 'Verified within the last week'
            });
        } else if (input.daysSinceVerified > 30) {
            factors.push({
                id: 'stale_verify',
                label: 'May need re-verification',
                points: -10,
                polarity: 'negative',
                description: 'Last verified over 30 days ago'
            });
        }
    }

    // Compute score from factors  
    // Note: This module uses BASE_SCORE=50 and adds/subtracts, so higher = healthier
    // This is different from stalenessScore where higher = more stale
    const score = computeScoreFromFactors(BASE_SCORE, factors);

    // Determine status label (for this module: higher score = healthier)
    let statusLabel = 'At Risk';
    if (score >= 70) statusLabel = 'Healthy';
    else if (score >= 50) statusLabel = 'Fair';
    else if (score >= 30) statusLabel = 'Needs Work';

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
