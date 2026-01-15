/**
 * Shared types for scoring engine
 * 
 * Score is ALWAYS derived from factors: score = BASE_SCORE + Σ(factor.points)
 */

export interface Factor {
    id: string;
    label: string;
    points: number;
    polarity: 'positive' | 'negative';
    description?: string;
}

export interface ReportResult {
    score: number | null;
    statusLabel: string;
    factors: Factor[];
    computedAt: string;
    confidence: 'high' | 'medium' | 'low';
    baseScore: number; // For transparency: what was the starting point
}

/**
 * Compute score from factors with clamping
 */
export function computeScoreFromFactors(baseScore: number, factors: Factor[]): number {
    const total = baseScore + factors.reduce((sum, f) => sum + f.points, 0);
    return Math.round(Math.max(0, Math.min(100, total)));
}

/**
 * Validate that a report's score matches its factors
 */
export function validateReport(report: ReportResult): { valid: boolean; expectedScore: number } {
    if (report.score === null) {
        return { valid: true, expectedScore: 0 };
    }
    const expectedScore = computeScoreFromFactors(report.baseScore, report.factors);
    return {
        valid: report.score === expectedScore,
        expectedScore
    };
}
