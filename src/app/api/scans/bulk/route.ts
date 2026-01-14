import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Valid scan types
const SCAN_TYPES = ['web_health', 'financial_health', 'contacts'] as const;
type ScanType = typeof SCAN_TYPES[number];

/**
 * POST /api/scans/bulk
 * 
 * Trigger bulk scans for multiple companies
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { scanType, companyIds, surface = 'leadboard' } = body;

        // Validate scan type
        if (!scanType || !SCAN_TYPES.includes(scanType)) {
            return NextResponse.json({
                error: `Invalid scanType. Must be one of: ${SCAN_TYPES.join(', ')}`
            }, { status: 400 });
        }

        // Validate company IDs
        if (!Array.isArray(companyIds) || companyIds.length === 0) {
            return NextResponse.json({ error: 'companyIds array required' }, { status: 400 });
        }

        // Limit batch size
        const MAX_BATCH = 100;
        const idsToProcess = companyIds.slice(0, MAX_BATCH).map(id => parseInt(id)).filter(id => !isNaN(id));

        if (idsToProcess.length === 0) {
            return NextResponse.json({ error: 'No valid company IDs' }, { status: 400 });
        }

        console.log(`[BulkScan] Starting ${scanType} for ${idsToProcess.length} companies`);

        // Check which companies already have active jobs
        const existingJobs = await prisma.scanJob.findMany({
            where: {
                companyId: { in: idsToProcess },
                scanType,
                status: { in: ['queued', 'running'] }
            },
            select: { companyId: true }
        });

        const existingCompanyIds = new Set(existingJobs.map(j => j.companyId));
        const newCompanyIds = idsToProcess.filter(id => !existingCompanyIds.has(id));

        // Create jobs for companies without active jobs
        const jobs: any[] = [];
        for (const companyId of newCompanyIds) {
            const job = await prisma.scanJob.create({
                data: {
                    companyId,
                    scanType,
                    status: 'queued',
                    requestedFromSurface: surface
                }
            });
            jobs.push(job);
        }

        console.log(`[BulkScan] Created ${jobs.length} jobs (${existingCompanyIds.size} already running)`);

        // Fire and forget: trigger workers for each job
        for (const job of jobs) {
            triggerScanWorker(job.id, scanType, job.companyId);
        }

        return NextResponse.json({
            success: true,
            totalRequested: idsToProcess.length,
            queued: jobs.length,
            alreadyRunning: existingCompanyIds.size,
            jobIds: jobs.map(j => j.id)
        }, { status: 201 });

    } catch (error: any) {
        console.error('[BulkScan] Error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to trigger bulk scan'
        }, { status: 500 });
    }
}

/**
 * GET /api/scans/bulk?jobIds=...
 * 
 * Get status of multiple jobs at once
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const jobIdsParam = searchParams.get('jobIds');

        if (!jobIdsParam) {
            return NextResponse.json({ error: 'jobIds query param required' }, { status: 400 });
        }

        const jobIds = jobIdsParam.split(',').filter(Boolean);

        if (jobIds.length === 0) {
            return NextResponse.json({ error: 'No valid job IDs' }, { status: 400 });
        }

        const jobs = await prisma.scanJob.findMany({
            where: { id: { in: jobIds } },
            orderBy: { createdAt: 'desc' }
        });

        // Calculate aggregate stats
        const stats = {
            total: jobs.length,
            queued: jobs.filter(j => j.status === 'queued').length,
            running: jobs.filter(j => j.status === 'running').length,
            success: jobs.filter(j => j.status === 'success').length,
            failed: jobs.filter(j => j.status === 'failed').length
        };

        return NextResponse.json({
            stats,
            jobs: jobs.map(j => ({
                jobId: j.id,
                companyId: j.companyId,
                status: j.status,
                progress: j.progress,
                errorMessage: j.errorMessage
            }))
        });

    } catch (error: any) {
        console.error('[BulkScan Status] Error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to get bulk status'
        }, { status: 500 });
    }
}

/**
 * Trigger a scan worker (fire and forget)
 */
function triggerScanWorker(jobId: string, scanType: string, companyId: number) {
    // Call the company scans endpoint to trigger the worker
    // This is a fire-and-forget internal call
    fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/companies/${companyId}/scans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanType, force: false, surface: 'bulk' })
    }).catch(e => console.error(`[BulkScan] Worker trigger failed for ${jobId}:`, e));
}
