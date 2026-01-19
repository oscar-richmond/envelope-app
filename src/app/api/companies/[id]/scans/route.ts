import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Valid scan types
const SCAN_TYPES = ['web_health', 'financial_health', 'contacts'] as const;
type ScanType = typeof SCAN_TYPES[number];

/**
 * POST /api/companies/[id]/scans
 * 
 * Trigger a scan job for the company
 * Returns immediately with jobId, scan runs asynchronously
 */
export async function POST(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const companyId = parseInt(id);
        if (isNaN(companyId)) {
            return NextResponse.json({ error: 'Invalid company ID' }, { status: 400 });
        }

        const body = await request.json();
        const { scanType, force = false, surface = 'unknown' } = body;

        // Validate scan type
        if (!scanType || !SCAN_TYPES.includes(scanType)) {
            return NextResponse.json({
                error: `Invalid scanType. Must be one of: ${SCAN_TYPES.join(', ')}`
            }, { status: 400 });
        }

        console.log(`[Scans] Trigger ${scanType} scan for company ${companyId}`);

        // Check if company exists
        const company = await prisma.companyProspect.findUnique({
            where: { id: companyId },
            select: { id: true, websiteUrl: true, companyNumber: true }
        });

        if (!company) {
            return NextResponse.json({ error: 'Company not found' }, { status: 404 });
        }

        // Check for existing active job (unless force)
        if (!force) {
            const existingJob = await prisma.scanJob.findFirst({
                where: {
                    companyId,
                    scanType,
                    status: { in: ['queued', 'running'] }
                }
            });

            if (existingJob) {
                console.log(`[Scans] Existing job found: ${existingJob.id}`);
                return NextResponse.json({
                    jobId: existingJob.id,
                    status: existingJob.status,
                    progress: existingJob.progress,
                    message: 'Scan already in progress'
                });
            }
        }

        // Create new scan job
        const job = await prisma.scanJob.create({
            data: {
                companyId,
                scanType,
                status: 'queued',
                requestedFromSurface: surface
            }
        });

        console.log(`[Scans] Created job ${job.id} for ${scanType}`);

        // Fire and forget: run scan worker asynchronously
        runScanWorkerAsync(job.id, scanType, companyId);

        return NextResponse.json({
            success: true,
            jobId: job.id,
            status: 'queued',
            message: `${scanType} scan queued`
        }, { status: 201 });

    } catch (error: any) {
        console.error('[Scans] Error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to trigger scan'
        }, { status: 500 });
    }
}

/**
 * GET /api/companies/[id]/scans/status
 * 
 * Returns current scan statuses for all scan types
 */
export async function GET(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const companyId = parseInt(id);
        if (isNaN(companyId)) {
            return NextResponse.json({ error: 'Invalid company ID' }, { status: 400 });
        }

        // Get company with scan results
        const company = await prisma.companyProspect.findUnique({
            where: { id: companyId },
            select: {
                webHealthData: true,
                finHealthData: true,
                contactsLastScannedAt: true,
                enrichmentData: true,
                stalenessScore: true,
                financialActivityScore: true
            }
        });

        if (!company) {
            return NextResponse.json({ error: 'Company not found' }, { status: 404 });
        }

        // Get latest job for each scan type
        const latestJobs = await prisma.scanJob.findMany({
            where: { companyId },
            orderBy: { createdAt: 'desc' },
            take: 10 // Get recent jobs to find latest per type
        });

        // Build status for each scan type
        const getStatusForType = (type: ScanType) => {
            const job = latestJobs.find(j => j.scanType === type);

            // Parse stored data
            let data: any = null;
            let lastScannedAt: Date | null = null;
            let score: number | null = null;

            if (type === 'web_health') {
                if (company.webHealthData) {
                    try { data = JSON.parse(company.webHealthData); } catch { }
                }
                lastScannedAt = data?.lastScannedAt ? new Date(data.lastScannedAt) : null;
                score = data?.score ?? company.stalenessScore;
            } else if (type === 'financial_health') {
                if (company.finHealthData) {
                    try { data = JSON.parse(company.finHealthData); } catch { }
                }
                lastScannedAt = data?.lastSyncedAt ? new Date(data.lastSyncedAt) : null;
                score = data?.score ?? company.financialActivityScore;
            } else if (type === 'contacts') {
                lastScannedAt = company.contactsLastScannedAt;
                // Count contacts
                if (company.enrichmentData) {
                    try {
                        const enrichment = JSON.parse(company.enrichmentData);
                        score = (enrichment.contacts?.length || 0);
                    } catch { }
                }
            }

            // Determine current status
            let status = 'idle';
            if (job) {
                if (job.status === 'queued' || job.status === 'running') {
                    status = job.status;
                } else if (job.status === 'failed') {
                    status = 'failed';
                } else if (job.status === 'success') {
                    status = 'success';
                }
            } else if (!lastScannedAt) {
                status = 'not_scanned';
            } else {
                status = 'idle';
            }

            return {
                status,
                progress: job?.status === 'running' ? job.progress : undefined,
                lastRunAt: lastScannedAt?.toISOString() || job?.finishedAt?.toISOString() || null,
                score,
                jobId: job?.id,
                errorMessage: job?.status === 'failed' ? job.errorMessage : undefined
            };
        };

        return NextResponse.json({
            companyId,
            web_health: getStatusForType('web_health'),
            financial_health: getStatusForType('financial_health'),
            contacts: getStatusForType('contacts')
        });

    } catch (error: any) {
        console.error('[Scans Status] Error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to get scan status'
        }, { status: 500 });
    }
}

/**
 * Async worker that runs the actual scan
 * Fire-and-forget pattern for Vercel serverless
 */
/**
 * Async worker that runs the actual scan
 * Fire-and-forget pattern for Vercel serverless
 */
async function runScanWorkerAsync(jobId: string, scanType: string, companyId: number) {
    // Import canonical scanners dynamically to avoid circular deps during init if any
    const { runWebsiteHealthScan } = await import('@/lib/websiteHealth/runScan');
    const { runFinancialHealthScan } = await import('@/lib/financials/runFinancialScan');

    // Don't await - let it run in background
    (async () => {
        try {
            console.log(`[ScanWorker] Starting ${scanType} for job ${jobId}`);

            // Update job to running
            await prisma.scanJob.update({
                where: { id: jobId },
                data: { status: 'running', startedAt: new Date(), attemptCount: { increment: 1 } }
            });

            let result: any = null;

            if (scanType === 'web_health') {
                // CANONICAL DELEGATION
                const scanResult = await runWebsiteHealthScan({
                    companyId,
                    initiatedFrom: 'api',
                    requestId: jobId,
                    force: true
                });

                if (scanResult.status === 'error') throw new Error(scanResult.error);
                result = { summary: `Score: ${scanResult.finalScore}, ${scanResult.label}` };

            } else if (scanType === 'financial_health') {
                // CANONICAL DELEGATION
                const scanResult = await runFinancialHealthScan({
                    companyId,
                    initiatedFrom: 'scan_job',
                    force: true
                });

                if (scanResult.status === 'error') throw new Error(scanResult.error);
                result = { summary: scanResult.receipt.computed.score ? `Score: ${scanResult.receipt.computed.score}` : 'Completed' };

            } else if (scanType === 'contacts') {
                result = await runContactsScan(companyId, jobId);
            }

            // Update job to success
            await prisma.scanJob.update({
                where: { id: jobId },
                data: {
                    status: 'success',
                    progress: 100,
                    finishedAt: new Date(),
                    resultSummary: result?.summary || 'Completed'
                }
            });

            console.log(`[ScanWorker] Completed ${scanType} for job ${jobId}`);

        } catch (error: any) {
            console.error(`[ScanWorker] Failed ${scanType} for job ${jobId}:`, error);

            // Update job to failed
            await prisma.scanJob.update({
                where: { id: jobId },
                data: {
                    status: 'failed',
                    finishedAt: new Date(),
                    errorMessage: error.message || 'Unknown error'
                }
            }).catch(console.error);
        }
    })();
}

/**
 * Contacts Scan Worker (Kept as is for now, user focus is Health)
 */
async function runContactsScan(companyId: number, jobId: string) {
    const company = await prisma.companyProspect.findUnique({
        where: { id: companyId },
        select: { websiteUrl: true, websiteDomain: true }
    });

    if (!company?.websiteUrl && !company?.websiteDomain) {
        throw new Error('No website URL for contact discovery');
    }

    // Update progress
    await prisma.scanJob.update({
        where: { id: jobId },
        data: { progress: 20 }
    });

    // Mock implementation for contacts
    await prisma.scanJob.update({
        where: { id: jobId },
        data: { progress: 80 }
    });

    // Update last scanned timestamp
    await prisma.companyProspect.update({
        where: { id: companyId },
        data: { contactsLastScannedAt: new Date() }
    });

    return { summary: 'Contact scan completed' };
}
