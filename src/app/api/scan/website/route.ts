import { NextResponse } from 'next/server';
import { runWebsiteHealthScan } from '@/lib/websiteHealth/runScan';
import prisma from '@/lib/prisma';

/**
 * Website Scan API
 * 
 * Unified endpoint using runWebsiteHealthScan() with full tracing and explicit error codes.
 */

export async function POST(request: Request) {
    const traceId = crypto.randomUUID();

    try {
        const body = await request.json();
        const {
            companyId,
            companyProspectId,  // Legacy parameter name (deprecated)
            surface = 'api',
            force = false
        } = body;

        // Accept both parameter names for backward compatibility
        const targetCompanyId = companyId || companyProspectId;

        // Validate companyId
        if (!targetCompanyId || typeof targetCompanyId !== 'number') {
            return NextResponse.json({
                code: 'BAD_REQUEST',
                detail: 'companyId required and must be a number',
                traceId
            }, { status: 400 });
        }

        // Check company exists
        const companyExists = await prisma.companyProspect.findUnique({
            where: { id: targetCompanyId },
            select: { id: true }
        });

        if (!companyExists) {
            return NextResponse.json({
                code: 'COMPANY_NOT_FOUND',
                detail: `Company ${targetCompanyId} not found`,
                traceId
            }, { status: 404 });
        }

        // Use unified scan function with full tracing
        const trace = await runWebsiteHealthScan({
            companyId: targetCompanyId,
            initiatedFrom: surface,
            force,
            requestId: traceId
        });

        // Handle NO_WEBSITE_URL error explicitly
        if (trace.status === 'error' && trace.error?.includes('No website')) {
            return NextResponse.json({
                status: 'failed',
                code: 'NO_WEBSITE_URL',
                detail: 'No website URL found for this company',
                traceId: trace.traceId,

                websiteHealthStatus: 'error',
                websiteHealthScore: null,
                websiteHealthLabel: null,
                websiteHealthError: 'NO_WEBSITE_URL',

                updatedCompanyHealth: {
                    companyId: targetCompanyId,
                    websiteHealthStatus: 'error',
                    websiteHealthScore: null,
                    websiteHealthLabel: null,
                    websiteHealthError: 'NO_WEBSITE_URL',
                    websiteHealthScannedAt: trace.persistedAt,
                    websiteHealthVersion: 2
                },

                _trace: trace
            }, { status: 422 });
        }

        // Handle other errors
        if (trace.status === 'error') {
            return NextResponse.json({
                status: 'failed',
                code: 'SCAN_ERROR',
                detail: trace.error || 'Scan failed',
                traceId: trace.traceId,

                websiteHealthStatus: 'error',
                websiteHealthScore: null,
                websiteHealthLabel: null,
                websiteHealthError: trace.error,

                updatedCompanyHealth: {
                    companyId: targetCompanyId,
                    websiteHealthStatus: 'error',
                    websiteHealthScore: null,
                    websiteHealthLabel: null,
                    websiteHealthError: trace.error,
                    websiteHealthScannedAt: trace.persistedAt
                },

                _trace: trace
            }, { status: 500 });
        }

        // Success - return enhanced response with full trace AND authoritative updated state
        return NextResponse.json({
            // Status
            status: 'complete',

            // Core data (for backward compatibility)
            websiteHealthStatus: trace.status,
            websiteHealthScore: trace.dbReadback.websiteHealthScore,
            websiteHealthLabel: trace.dbReadback.websiteHealthLabel,
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
            _trace: trace
        });

    } catch (error: any) {
        console.error('[ScanWebsite] Fatal error:', error);
        return NextResponse.json({
            status: 'failed',
            code: 'INTERNAL_ERROR',
            detail: error.message || 'Scan failed',
            traceId
        }, { status: 500 });
    }
}
