'use client';

/**
 * Unified action to open the Website Health Modal.
 * Dispatches a custom event that the root provider listens to.
 * 
 * Usage:
 * openWebHealthModal(123);
 */
export function openWebHealthModal(companyId: number, context?: { surface?: string }) {
    if (!companyId) {
        console.warn('[openWebHealthModal] No companyId provided');
        return;
    }

    console.log(`[webHealthActions] Opening modal for company ${companyId}`, context);

    // Dispatch event for the ModalProvider to catch
    const event = new CustomEvent('OPEN_WEB_HEALTH_MODAL', {
        detail: {
            companyId,
            ...context
        }
    });
    window.dispatchEvent(event);
}

// --- SCAN RECEIPT STORE (Diagnostics) ---

declare global {
    interface Window {
        __SCAN_RECEIPTS__?: Record<number, any>;
    }
}

export function saveScanReceipt(companyId: number, receipt: any) {
    if (typeof window === 'undefined') return;

    if (!window.__SCAN_RECEIPTS__) {
        window.__SCAN_RECEIPTS__ = {};
    }

    window.__SCAN_RECEIPTS__[companyId] = receipt;

    // Dispatch update event for UI to react
    window.dispatchEvent(new CustomEvent('SCAN_RECEIPT_UPDATED', {
        detail: { companyId, receipt }
    }));

    console.log('[ReceiptStore] Saved receipt for', companyId, receipt);
}

export function getScanReceipt(companyId: number) {
    if (typeof window === 'undefined') return null;
    return window.__SCAN_RECEIPTS__?.[companyId] || null;
}
