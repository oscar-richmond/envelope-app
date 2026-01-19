/**
 * Website Health Scan Client
 * 
 * Shared helper for scanning website health from any UI surface.
 * Standardizes payload format and error handling.
 */

export interface ScanWebsiteHealthParams {
    companyId: number;
    surface: 'search' | 'leadboard' | 'company_overview';
    force?: boolean;
}

export interface ScanWebsiteHealthResponse {
    status: 'complete' | 'failed';
    websiteHealthStatus: string;
    websiteHealthScore: number | null;
    websiteHealthLabel: string | null;
    websiteHealthError?: string;
    websiteHealthScannedAt?: string;
    updatedCompanyHealth: {
        companyId: number;
        websiteHealthStatus: string;
        websiteHealthScore: number | null;
        websiteHealthLabel: string | null;
        websiteHealthError?: string;
        websiteHealthScannedAt?: string;
    };
    _trace: any;
}

export interface ScanError {
    status: number;
    code: string;
    detail: string;
    traceId?: string;
}

export async function scanWebsiteHealth(
    params: ScanWebsiteHealthParams
): Promise<ScanWebsiteHealthResponse> {
    const res = await fetch('/api/scan/website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            companyId: params.companyId,
            surface: params.surface,
            force: params.force ?? false
        })
    });

    const data = await res.json();

    // START: Receipt Capture (Diagnostics)
    // We import dynamically or check window to avoid circular dep issues in some unrelated call sites if any
    try {
        if (data.receipt) {
            const { saveScanReceipt } = await import('../ui/webHealthActions');
            saveScanReceipt(params.companyId, data.receipt);
        }
    } catch (e) {
        console.warn('Failed to save receipt', e);
    }
    // END: Receipt Capture

    if (!res.ok) {
        throw {
            status: res.status,
            code: data.code || 'UNKNOWN_ERROR',
            detail: data.detail || data.error || 'Scan failed',
            traceId: data.traceId
        } as ScanError;
    }

    return data;
}

export function getErrorMessage(error: ScanError): string {
    switch (error.code) {
        case 'NO_WEBSITE_URL':
            return 'No website found for this company yet.';
        case 'COMPANY_NOT_FOUND':
            return 'Company record missing. Please re-sync this prospect.';
        case 'BAD_REQUEST':
            return 'Scan request invalid (bug detected).';
        case 'FETCH_FAILED':
            return "Website couldn't be reached right now.";
        case 'INTERNAL_ERROR':
            return `Scan failed: ${error.detail}`;
        default:
            return `Scan failed: ${error.detail}`;
    }
}
