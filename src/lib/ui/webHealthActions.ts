'use client';

/**
 * Unified action to open the Website Health Modal.
 * Dispatches a custom event that the root provider listens to.
 * 
 * Usage:
 * openWebHealthModal(123);
 */
export function openWebHealthModal(companyId: number, surface?: string) {
    if (typeof window === 'undefined') return; // SSR safety

    const event = new CustomEvent('OPEN_WEB_HEALTH_MODAL', {
        detail: { companyId, surface }
    });
    window.dispatchEvent(event);
}

// --- SCAN RECEIPT STORE (Diagnostics) ---

declare global {
    interface Window {
        __SCAN_RECEIPTS__?: Record<number, any>;
    }
}

/**
 * Save a scan receipt to the in-memory store for diagnostics
 * Receipts include: computed score, persisted readback, and metadata
 */
export function saveScanReceipt(companyId: number, receipt: any) {
    if (typeof window === 'undefined') return; // SSR safety

    if (!window.__SCAN_RECEIPTS__) {
        window.__SCAN_RECEIPTS__ = {};
    }

    window.__SCAN_RECEIPTS__[companyId] = receipt;

    // Dispatch event for diagnostics UI
    window.dispatchEvent(new CustomEvent('SCAN_RECEIPT_UPDATED', {
        detail: { companyId, receipt }
    }));
}

export function getScanReceipt(companyId: number): any {
    if (typeof window === 'undefined') return null; // SSR safety
    return window.__SCAN_RECEIPTS__?.[companyId] || null;
}
