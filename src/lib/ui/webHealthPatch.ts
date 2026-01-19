/**
 * CANONICAL UI State Patch Function
 * 
 * This is the ONLY way to update Website Health state in the UI.
 * All scan responses must call this to ensure immediate, deterministic updates.
 */

export interface UpdatedCompanyHealth {
    companyId: number;
    websiteHealthStatus: string | null;
    websiteHealthScore: number | null;
    websiteHealthLabel: string | null;
    websiteHealthScannedAt: string | null;
    websiteHealthVersion: number | null;
}

/**
 * Apply Website Health patch across all UI surfaces
 * 
 * Dispatches a global event that ALL list components listen to.
 * This ensures Search, Lead Board, and Overview stay in sync.
 */
export function applyWebsiteHealthPatch(updatedHealth: UpdatedCompanyHealth) {
    const timestamp = new Date().toISOString();

    console.log('[WebHealthPatch] Applying patch:', {
        companyId: updatedHealth.companyId,
        score: updatedHealth.websiteHealthScore,
        label: updatedHealth.websiteHealthLabel,
        timestamp
    });

    // Dispatch global event for all listeners
    const event = new CustomEvent('COMPANY_HEALTH_UPDATED', {
        detail: {
            companyId: updatedHealth.companyId,
            updatedCompanyHealth: updatedHealth,
            timestamp,
            patchedAt: timestamp
        }
    });

    if (typeof window !== 'undefined') {
        window.dispatchEvent(event);
    }

    // Store patch metadata for debug strip
    if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(
            `healthPatch_${updatedHealth.companyId}`,
            JSON.stringify({
                score: updatedHealth.websiteHealthScore,
                label: updatedHealth.websiteHealthLabel,
                version: updatedHealth.websiteHealthVersion,
                patchedAt: new Date().toLocaleTimeString(),
                patchedFromScan: true
            })
        );
    }
}

/**
 * Get patch metadata for debug display
 */
export function getWebHealthPatchDebug(companyId: number) {
    if (typeof sessionStorage === 'undefined') return null;

    const data = session Storage.getItem(`healthPatch_${companyId}`);
    return data ? JSON.parse(data) : null;
}
