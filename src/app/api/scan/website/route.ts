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

    console.log(`[ScanWebsite] ========== SCAN REQUEST START ==========`);
    console.log(`[ScanWebsite] TraceId: ${traceId}`);

    try {
        const body = await request.json();
        const {
            companyId,
            companyProspectId,  // Legacy parameter name (deprecated)
            surface = 'api',
            force = false
        } = body;

        console.log(`[ScanWebsite] Request payload:`, { companyId, companyProspectId, surface, force });

        // Accept both parameter names for backward compatibility
        const targetCompanyId = companyId || companyProspectId;

        console.log(`[ScanWebsite] Resolved target companyId: ${targetCompanyId}`);

        // Validate companyId
        if (!targetCompanyId || typeof targetCompanyId !== 'number') {
            console.error(`[ScanWebsite] Invalid companyId:`, targetCompanyId);
            return NextResponse.json({
                code: 'BAD_REQUEST',
                detail: 'companyId required and must be a number',
                traceId
            }, { status: 400 });
        }

        // Check company exists AND capture dbBefore snapshot
        const dbBefore = await prisma.companyProspect.findUnique({
            where: { id: targetCompanyId },
            select: {
                id: true,
                websiteHealthVersion: true,
                websiteHealthStatus: true,
                websiteHealthScore: true,
                websiteHealthLabel: true,
                websiteHealthScannedAt: true,
                websiteHealthError: true,
                webHealthData: true
            }
        });

        if (!dbBefore) {
            console.error(`[ScanWebsite] Company not found: ${targetCompanyId}`);
            return NextResponse.json({
                code: 'COMPANY_NOT_FOUND',
                detail: `Company ${targetCompanyId} not found`,
                traceId
            }, { status: 404 });
        }

        console.log(`[ScanWebsite] dbBefore snapshot:`, {
            id: dbBefore.id,
            version: dbBefore.websiteHealthVersion,
            status: dbBefore.websiteHealthStatus,
            score: dbBefore.websiteHealthScore,
            hasReport: !!dbBefore.webHealthData
        });

        // Use unified scan function with full tracing
        console.log(`[ScanWebsite] Calling runWebsiteHealthScan...`);
        const trace = await runWebsiteHealthScan({
            companyId: targetCompanyId,
            initiatedFrom: surface,
            force,
            requestId: traceId
        });
        console.log(`[ScanWebsite] Scan completed. Status: ${trace.status}`);

        // Build write receipt
        const writeReceipt = {
            traceId: trace.traceId || traceId,
            input: {
                companyId: targetCompanyId,
                surface,
                force
            },
            dbBefore: {
                websiteHealthVersion: dbBefore.websiteHealthVersion,
                websiteHealthStatus: dbBefore.websiteHealthStatus,
                websiteHealthScore: dbBefore.websiteHealthScore,
                websiteHealthLabel: dbBefore.websiteHealthLabel,
                websiteHealthScannedAt: dbBefore.websiteHealthScannedAt?.toISOString() || null
            },
            dbAfter: {
                websiteHealthVersion: trace.dbReadback?.websiteHealthVersion || null,
                websiteHealthStatus: trace.status,
                websiteHealthScore: trace.dbReadback?.websiteHealthScore ?? null,
                websiteHealthLabel: trace.dbReadback?.websiteHealthLabel ?? null,
                websiteHealthScannedAt: trace.persistedAt,
                websiteHealthError: trace.error || null
            },
            reportPersisted: trace.dbReadback?.webHealthDataExists || false,
            writer: 'runWebsiteHealthScan',
            surface
        };

        console.log(`[ScanWebsite] Write receipt:`, writeReceipt);
        console.log(`[ScanWebsite] ========== SCAN REQUEST END ==========`);

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

                writeReceipt,


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
                    websiteHealthScannedAt: trace.persistedAt,
                    websiteHealthVersion: 2
                },

                writeReceipt,

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
                websiteHealthVersion: trace.dbReadback.websiteHealthVersion,
                websiteHealthError: null
            },

            // CRITICAL: Write Receipt proving persistence
            writeReceipt,

            // Full trace (for debugging)
            _trace: trace,

            // Proof Receipt
            receipt: trace.receipt
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
