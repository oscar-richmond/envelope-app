import { NextResponse } from 'next/server';
import { runWebsiteHealthScan } from '@/lib/websiteHealth/runScan';

/**
 * Website Scan API
 * 
 * Unified endpoint using runWebsiteHealthScan() with full tracing
 */

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            companyId,
            companyProspectId,  // Legacy parameter name
            surface = 'api',
            force = false
        } = body;

        // Accept both parameter names for backward compatibility
        const targetCompanyId = companyId || companyProspectId;

        if (!targetCompanyId) {
            return NextResponse.json({
                error: 'companyId or companyProspectId required'
            }, { status: 400 });
        }

        // Use unified scan function with full tracing
        const trace = await runWebsiteHealthScan({
            companyId: targetCompanyId,
            initiatedFrom: surface,
            force
        });

        // Return enhanced response with full trace AND authoritative updated state
        return NextResponse.json({
            // Status
            status: trace.status === 'success' ? 'complete' : 'failed',

            // Core data (for backward compatibility)
            websiteHealthStatus: trace.status,
            websiteHealthScore: trace.finalScore,
            websiteHealthLabel: trace.label,
            websiteHealthScannedAt: trace.persistedAt,
            websiteHealthError: trace.error,

            // NEW: Authoritative updated state from DB readback
            updatedCompanyHealth: {
                companyId: targetCompanyId,
                websiteHealthStatus: trace.status,
                websiteHealthScore: trace.dbReadback.websiteHealthScore,
                websiteHealthLabel: trace.dbReadback.websiteHealthLabel,
                websiteHealthScannedAt: trace.persistedAt,
                websiteHealthVersion: trace.dbReadback.websiteHealthVersion
            },

            // Full trace (for debugging)
            _trace: {
                ...trace,
                // Enhanced forensics
                resolvedUrlUsed: trace.status === 'success' ? 'urlResolution?.url' : null,
                urlSource: trace.status === 'success' ? 'urlResolution?.source' : 'none',
                httpStatus: trace.status === 'success' ? 200 : null  // TODO: Get actual from trace
            }
        });

    } catch (error: any) {
        console.error('[ScanWebsite] Fatal error:', error);
        return NextResponse.json({
            status: 'failed',
            error: error.message || 'Scan failed'
        }, { status: 500 });
    }
}
