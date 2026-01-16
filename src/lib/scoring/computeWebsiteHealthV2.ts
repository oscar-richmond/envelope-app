/**
 * Website Health Scoring Engine V2
 * 
 * CANONICAL CONTRACT (DO NOT MODIFY WITHOUT VERSION BUMP):
 * - Score measures STALENESS / REDESIGN OPPORTUNITY (0 = fresh, 100 = critical)
 * - BASE_SCORE = 50 (ALWAYS, enforced by literal type)
 * - Formula: score = clamp(BASE_SCORE + Σ(factor.points), 0, 100)
 * - Sign convention:
 *   - Freshness signals (modern, good) → NEGATIVE points (reduce staleness)
 *   - Outdatedness signals (old, bad) → POSITIVE points (increase staleness)
 * - Labels: Fresh (0-24), Aging (25-49), Outdated (50-74), Critical (75-100)
 */

export interface WebsiteHealthFactorV2 {
    id: string;
    label: string;
    points: number; // Sign already included (no separate polarity field)
    description: string;
}

export interface WebsiteHealthV2Report {
    version: 2;
    score: number;
    label: 'Fresh' | 'Aging' | 'Outdated' | 'Critical';
    baseScore: 50; // Literal type - enforces compile-time check
    factors: WebsiteHealthFactorV2[];
    computedAt: string;
    domain: string;
    traceId: string;
}

export interface WebsiteScanInputV2 {
    domain?: string;
    isReachable: boolean;
    isHttps: boolean;
    httpStatus?: number;
    daysSinceVerified?: number;
    hasSitemap?: boolean;
}

/**
 * Compute Website Health Score V2
 * 
 * @throws {Error} If validation fails (score math doesn't match)
 */
export function computeWebsiteHealthV2(
    input: WebsiteScanInputV2
): WebsiteHealthV2Report {
    const BASE_SCORE: 50 = 50; // Literal type enforces this value
    const factors: WebsiteHealthFactorV2[] = [];

    // ========================================
    // FRESHNESS SIGNALS (NEGATIVE POINTS)
    // ========================================

    // Modern basics: HTTPS + reachable + HTTP 200
    if (input.isHttps && input.isReachable && input.httpStatus === 200) {
        factors.push({
            id: 'modern_basics',
            label: 'Modern standards met',
            points: -15, // NEGATIVE = reduces staleness
            description: 'HTTPS, reachable, and returns 200 OK'
        });
    }

    // Recently verified (< 30 days)
    if (input.daysSinceVerified !== undefined && input.daysSinceVerified < 30) {
        factors.push({
            id: 'recently_verified',
            label: 'Recently maintained',
            points: -10, // NEGATIVE = reduces staleness
            description: 'Verified within the last 30 days'
        });
    }

    // ========================================
    // OUTDATEDNESS SIGNALS (POSITIVE POINTS)
    // ========================================

    // No HTTPS (insecure)
    if (!input.isHttps && input.isReachable) {
        factors.push({
            id: 'no_https',
            label: 'No HTTPS',
            points: 20, // POSITIVE = increases staleness
            description: 'Uses insecure HTTP instead of HTTPS'
        });
    }

    // Site unreachable
    if (!input.isReachable) {
        factors.push({
            id: 'unreachable',
            label: 'Site unreachable',
            points: 35, // POSITIVE = increases staleness
            description: 'Cannot connect to website'
        });
    }

    // Server error (4xx/5xx)
    if (input.httpStatus && (input.httpStatus >= 400 && input.httpStatus < 600)) {
        factors.push({
            id: 'http_error',
            label: `Server error ${input.httpStatus}`,
            points: 25, // POSITIVE = increases staleness
            description: `HTTP error status ${input.httpStatus}`
        });
    }

    // Very stale verification (6+ months)
    if (input.daysSinceVerified !== undefined && input.daysSinceVerified >= 180) {
        factors.push({
            id: 'very_stale_check',
            label: 'Not checked in 6+ months',
            points: 15, // POSITIVE = increases staleness
            description: 'Long time since last verification'
        });
    }
    // Moderately stale (3-6 months)
    else if (input.daysSinceVerified !== undefined && input.daysSinceVerified >= 90) {
        factors.push({
            id: 'stale_check',
            label: 'Not checked in 3+ months',
            points: 8, // POSITIVE = increases staleness
            description: 'Moderate time since verification'
        });
    }

    // No sitemap.xml
    if (input.hasSitemap === false) {
        factors.push({
            id: 'no_sitemap',
            label: 'No sitemap.xml',
            points: 5, // POSITIVE = increases staleness
            description: 'Missing modern SEO requirement'
        });
    }

    // ========================================
    // COMPUTE SCORE
    // ========================================

    const sumPoints = factors.reduce((sum, f) => sum + f.points, 0);
    const rawScore = BASE_SCORE + sumPoints;
    const score = Math.max(0, Math.min(100, rawScore));

    // ========================================
    // DERIVE LABEL
    // ========================================

    let label: 'Fresh' | 'Aging' | 'Outdated' | 'Critical' = 'Fresh';
    if (score >= 75) label = 'Critical';
    else if (score >= 50) label = 'Outdated';
    else if (score >= 25) label = 'Aging';

    // ========================================
    // VALIDATION (ENFORCE CONTRACT)
    // ========================================

    // Math check
    const expectedScore = Math.max(0, Math.min(100, BASE_SCORE + sumPoints));
    if (score !== expectedScore) {
        throw new Error(
            `[WebHealthV2] Score validation failed: computed=${score}, expected=${expectedScore}, base=${BASE_SCORE}, sum=${sumPoints}`
        );
    }

    // BaseScore check (compile-time + runtime)
    if (BASE_SCORE !== 50) {
        throw new Error(`[WebHealthV2] BASE_SCORE must be 50, got ${BASE_SCORE}`);
    }

    // Reject if any factor has a polarity field (V1 artifact)
    for (const factor of factors) {
        if ('polarity' in factor) {
            throw new Error(
                `[WebHealthV2] Factor "${factor.id}" has polarity field - V2 uses signed points only`
            );
        }
    }

    // ========================================
    // BUILD REPORT
    // ========================================

    const report: WebsiteHealthV2Report = {
        version: 2,
        score,
        label,
        baseScore: BASE_SCORE,
        factors,
        computedAt: new Date().toISOString(),
        domain: input.domain || 'unknown',
        traceId: crypto.randomUUID()
    };

    // Debug logging (dev only)
    if (process.env.NEXT_PUBLIC_DEBUG_HEALTH === '1' || process.env.DEBUG_HEALTH === '1') {
        console.log('[WebHealthV2] Report generated:', {
            traceId: report.traceId,
            domain: report.domain,
            baseScore: report.baseScore,
            sumPoints,
            score: report.score,
            label: report.label,
            factorCount: factors.length
        });
    }

    return report;
}

/**
 * Validate an existing V2 report
 * Returns validation errors or null if valid
 */
export function validateWebsiteHealthV2Report(
    report: any
): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Version check
    if (report.version !== 2) {
        errors.push(`Invalid version: expected 2, got ${report.version}`);
    }

    // BaseScore check
    if (report.baseScore !== 50) {
        errors.push(`Invalid baseScore: expected 50, got ${report.baseScore}`);
    }

    // Math check
    const sumPoints = (report.factors || []).reduce((sum: number, f: any) => sum + (f.points || 0), 0);
    const expectedScore = Math.max(0, Math.min(100, report.baseScore + sumPoints));
    if (report.score !== expectedScore) {
        errors.push(
            `Score math mismatch: score=${report.score}, expected=${expectedScore} (base=${report.baseScore} + sum=${sumPoints})`
        );
    }

    // Label check
    let expectedLabel: string = 'Fresh';
    if (report.score >= 75) expectedLabel = 'Critical';
    else if (report.score >= 50) expectedLabel = 'Outdated';
    else if (report.score >= 25) expectedLabel = 'Aging';

    if (report.label !== expectedLabel) {
        errors.push(
            `Label mismatch: label="${report.label}", expected="${expectedLabel}" for score=${report.score}`
        );
    }

    return {
        valid: errors.length === 0,
        errors
    };
}
