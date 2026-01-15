/**
 * Website Health Scoring Constants
 * 
 * Single source of truth for website health/staleness scoring.
 * 
 * SCORING DIRECTION (Opportunity Score):
 * - 0 = Fresh / Healthy (low opportunity for redesign)
 * - 100 = Very Outdated (high opportunity for redesign)
 * 
 * This is an "opportunity score" - higher means more opportunity for a redesign.
 */

export interface WebsiteHealthLabel {
    label: string;
    tone: 'positive' | 'neutral' | 'warning' | 'negative';
    color: 'green' | 'amber' | 'orange' | 'red' | 'gray';
    description: string;
}

/**
 * Get website health label from staleness score
 * 
 * @param score - Staleness score (0-100, 100 = very stale/outdated)
 * @returns Label, tone, color for UI display
 */
export function getWebsiteHealthLabel(score: number | null | undefined): WebsiteHealthLabel {
    if (score === null || score === undefined) {
        return {
            label: 'Not Scanned',
            tone: 'neutral',
            color: 'gray',
            description: 'Website has not been analyzed yet'
        };
    }

    // Higher score = More outdated = More opportunity
    if (score >= 75) {
        return {
            label: 'Very Outdated',
            tone: 'negative',
            color: 'red',
            description: 'Website shows multiple signs of needing a refresh'
        };
    }

    if (score >= 50) {
        return {
            label: 'Outdated',
            tone: 'warning',
            color: 'orange',
            description: 'Website shows signs of aging'
        };
    }

    if (score >= 25) {
        return {
            label: 'Aging',
            tone: 'neutral',
            color: 'amber',
            description: 'Website is maintained but could use updates'
        };
    }

    return {
        label: 'Fresh',
        tone: 'positive',
        color: 'green',
        description: 'Website appears well-maintained'
    };
}

/**
 * Get accent color for score display
 * Maps staleness score to color - higher = more red
 */
export function getWebsiteScoreAccent(score: number | null | undefined): 'green' | 'amber' | 'orange' | 'red' | 'gray' {
    return getWebsiteHealthLabel(score).color;
}

/**
 * Validate that a score is not artificially stuck at 100
 * Used for debugging suspicious all-100 scenarios
 */
export function warnIfSuspiciousScores(scores: (number | null | undefined)[]): void {
    const validScores = scores.filter((s): s is number => s !== null && s !== undefined);
    if (validScores.length >= 3 && validScores.every(s => s === 100)) {
        console.warn('[WebsiteHealth] Suspicious: all scores are exactly 100. Check for fallback/default bugs.');
    }
}

// Backwards compatibility export
export const websiteHealthLabel = getWebsiteHealthLabel;
