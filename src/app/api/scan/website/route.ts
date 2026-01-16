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
        const { companyProspectId, leadId, force = false } = body;

        if (!companyProspectId) {
            return NextResponse.json({ error: 'companyProspectId required' }, { status: 400 });
        }

        // Determine initiating surface
        let initiatedFrom: 'search' | 'leadboard' | 'overview' | 'api' = 'api';
        if (leadId) initiatedFrom = 'leadboard';

        // Use unified scan function with full tracing
        const trace = await runWebsiteHealthScan({
            companyId: companyProspectId,
            initiatedFrom,
            force
        });

        // Return enhanced response with full trace
        return NextResponse.json({
            // Status
            status: trace.status === 'success' ? 'complete' : 'failed',

            // Core data (for backward compatibility)
            websiteHealthStatus: trace.status,
            websiteHealthScore: trace.finalScore,
            websiteHealthLabel: trace.label,
            websiteHealthScannedAt: trace.persistedAt,
            websiteHealthError: trace.error,

            // Full trace (for debugging)
            _trace: trace
        });

    } catch (error: any) {
        console.error('[ScanWebsite] Fatal error:', error);
        return NextResponse.json({
            status: 'failed',
            error: error.message || 'Scan failed'
        }, { status: 500 });
    }
}
