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

        // CRITICAL: Read back from DB AFTER scan to prove persistence
        const dbAfter = await prisma.companyProspect.findUnique({
            where: { id: targetCompanyId },
            select: {
                id: true,
                websiteHealthVersion: true,
                websiteHealthStatus: true,
                websiteHealthScore: true,
                websiteHealthLabel: true,
                websiteHealthScannedAt: true,
                websiteHealthError: true,
                websiteHealthTraceId: true,
                websiteHealthLastWriter: true,
                websiteHealthLastSurface: true,
                webHealthData: true
            }
        });

        if (!dbAfter) {
            console.error(`[ScanWebsite] CRITICAL: Record vanished after scan! companyId=${targetCompanyId}`);
            return NextResponse.json({
                code: 'RECORD_VANISHED',
                detail: 'Record not found after scan - this should never happen',
                traceId
            }, { status: 500 });
        }

        console.log(`[ScanWebsite] dbAfter snapshot (VERIFIED FROM DB):`, {
            id: dbAfter.id,
            version: dbAfter.websiteHealthVersion,
            status: dbAfter.websiteHealthStatus,
            score: dbAfter.websiteHealthScore,
            label: dbAfter.websiteHealthLabel,
            hasReport: !!dbAfter.webHealthData,
            traceId: dbAfter.websiteHealthTraceId,
            lastWriter: dbAfter.websiteHealthLastWriter
        });

        // Build write receipt with VERIFIED dbAfter from database
        const writeReceipt = {
            traceId: trace.traceId || traceId,
            input: {
                companyId: targetCompanyId,
                companyProspectId: companyProspectId || null,
                resolvedTo: targetCompanyId,
                surface,
                force
            },
            recordId: {
                queriedWith: 'findUnique({ where: { id: ' + targetCompanyId + ' } })',
                resolvedTo: dbAfter.id,
                proofOfPersistence: 'dbAfter queried immediately after scan completion'
            },
            dbBefore: {
                id: dbBefore.id,
                websiteHealthVersion: dbBefore.websiteHealthVersion,
                websiteHealthStatus: dbBefore.websiteHealthStatus,
                websiteHealthScore: dbBefore.websiteHealthScore,
                websiteHealthLabel: dbBefore.websiteHealthLabel,
                websiteHealthScannedAt: dbBefore.websiteHealthScannedAt?.toISOString() || null,
                websiteHealthError: dbBefore.websiteHealthError,
                hasReport: !!dbBefore.webHealthData
            },
            dbAfter: {
                id: dbAfter.id,
                websiteHealthVersion: dbAfter.websiteHealthVersion,
                websiteHealthStatus: dbAfter.websiteHealthStatus,
                websiteHealthScore: dbAfter.websiteHealthScore,
                websiteHealthLabel: dbAfter.websiteHealthLabel,
                websiteHealthScannedAt: dbAfter.websiteHealthScannedAt?.toISOString() || null,
                websiteHealthError: dbAfter.websiteHealthError,
                websiteHealthTraceId: dbAfter.websiteHealthTraceId,
                websiteHealthLastWriter: dbAfter.websiteHealthLastWriter,
                websiteHealthLastSurface: dbAfter.websiteHealthLastSurface,
                hasReport: !!dbAfter.webHealthData
            },
            persistenceProof: {
                reportPersisted: !!dbAfter.webHealthData,
                versionIncremented: (dbAfter.websiteHealthVersion || 0) > (dbBefore.websiteHealthVersion || 0),
                statusChanged: dbAfter.websiteHealthStatus !== dbBefore.websiteHealthStatus,
                traceIdWritten: !!dbAfter.websiteHealthTraceId,
                writerRecorded: !!dbAfter.websiteHealthLastWriter
            },
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
