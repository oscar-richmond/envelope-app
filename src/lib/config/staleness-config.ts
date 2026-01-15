/**
 * Staleness Configuration for Lead Board Scans
 * 
 * Centralized constants and helpers for determining scan freshness.
 */

// TTL (Time-To-Live) for scan results in days
export const SCAN_TTL_DAYS = {
    WEB_HEALTH: 7,   // Web health scores valid for 7 days
    FIN_HEALTH: 14   // Financial data valid for 14 days
};

/**
 * Check if scan data is stale (past TTL)
 * Returns false if data is missing (use isMissing for that check)
 */
export function isStale(lastScannedAt: Date | string | null | undefined, ttlDays: number): boolean {
    if (!lastScannedAt) return false; // Missing, not stale
    const date = typeof lastScannedAt === 'string' ? new Date(lastScannedAt) : lastScannedAt;
    const ageMs = Date.now() - date.getTime();
    return ageMs > ttlDays * 24 * 60 * 60 * 1000;
}

/**
 * Check if scan data is missing (never scanned)
 */
export function isMissing(lastScannedAt: Date | string | null | undefined): boolean {
    return !lastScannedAt;
}

/**
 * Get freshness label for display
 */
export function getFreshnessLabel(
    lastScannedAt: Date | string | null | undefined,
    ttlDays: number
): 'fresh' | 'stale' | 'missing' {
    if (isMissing(lastScannedAt)) return 'missing';
    if (isStale(lastScannedAt, ttlDays)) return 'stale';
    return 'fresh';
}

/**
 * Compute staleness flags for a lead/prospect
 */
export function computeStalenessFlags(prospect: {
    webHealthData?: string | null;
    finHealthData?: string | null;
} | null) {
    let webLastScanned: Date | null = null;
    let finLastScanned: Date | null = null;

    // Parse webHealthData JSON
    if (prospect?.webHealthData) {
        try {
            const data = JSON.parse(prospect.webHealthData);
            webLastScanned = data.lastScannedAt ? new Date(data.lastScannedAt) : null;
        } catch (e) { /* ignore parse errors */ }
    }

    // Parse finHealthData JSON
    if (prospect?.finHealthData) {
        try {
            const data = JSON.parse(prospect.finHealthData);
            finLastScanned = data.lastSyncedAt ? new Date(data.lastSyncedAt) : null;
        } catch (e) { /* ignore parse errors */ }
    }

    return {
        isWebMissing: isMissing(webLastScanned),
        isWebStale: isStale(webLastScanned, SCAN_TTL_DAYS.WEB_HEALTH),
        isFinMissing: isMissing(finLastScanned),
        isFinStale: isStale(finLastScanned, SCAN_TTL_DAYS.FIN_HEALTH),
        webLastScanned,
        finLastScanned
    };
}

/**
 * Parse health data JSON safely
 */
export function parseWebHealthData(json: string | null | undefined): {
    score: number | null;
    label: string | null;
    signals: any[];
    lastScannedAt: Date | null;
} | null {
    if (!json) return null;
    try {
        const data = JSON.parse(json);
        return {
            score: data.score ?? null,
            label: data.label ?? null,
            signals: data.signals ?? [],
            lastScannedAt: data.lastScannedAt ? new Date(data.lastScannedAt) : null
        };
    } catch (e) {
        return null;
    }
}

export function parseFinHealthData(json: string | null | undefined): {
    score: number | null;
    band: string | null;
    breakdown: any[];
    lastSyncedAt: Date | null;
} | null {
    if (!json) return null;
    try {
        const data = JSON.parse(json);
        return {
            score: data.score ?? null,
            band: data.band ?? null,
            breakdown: data.breakdown ?? [],
            lastSyncedAt: data.lastSyncedAt ? new Date(data.lastSyncedAt) : null
        };
    } catch (e) {
        return null;
    }
}
