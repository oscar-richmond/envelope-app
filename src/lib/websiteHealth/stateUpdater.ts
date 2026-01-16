/**
 * Shared state updater for Website Health
 * 
 * Ensures immutable updates to list state after scans
 */

export function applyWebsiteHealthUpdate<T extends {
    id: number;
    websiteHealthStatus?: string | null;
    websiteHealthScore?: number | null;
    websiteHealthLabel?: string | null;
    websiteHealthScannedAt?: Date | string | null;
    websiteHealthError?: string | null;
}>(
    list: T[],
    companyId: number,
    update: {
        websiteHealthStatus: string;
        websiteHealthScore: number | null;
        websiteHealthLabel: string | null;
        websiteHealthScannedAt: Date | string;
        websiteHealthError?: string | null;
    }
): T[] {
    // Debug trace
    if (process.env.NEXT_PUBLIC_DEBUG_HEALTH === '1') {
        const before = list.find(item => item.id === companyId);
        console.log('[WEB_HEALTH_UI]', {
            event: 'STATE_UPDATE',
            companyId,
            before: {
                status: before?.websiteHealthStatus,
                score: before?.websiteHealthScore,
                label: before?.websiteHealthLabel
            },
            after: {
                status: update.websiteHealthStatus,
                score: update.websiteHealthScore,
                label: update.websiteHealthLabel
            }
        });
    }

    // Immutable update - replace entire object
    return list.map(item =>
        item.id === companyId
            ? {
                ...item,
                websiteHealthStatus: update.websiteHealthStatus,
                websiteHealthScore: update.websiteHealthScore,
                websiteHealthLabel: update.websiteHealthLabel,
                websiteHealthScannedAt: update.websiteHealthScannedAt,
                websiteHealthError: update.websiteHealthError ?? null
            }
            : item
    );
}
