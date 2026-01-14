import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/scans/jobs/[jobId]
 * 
 * Poll the status of a scan job
 */
export async function GET(
    request: Request,
    context: { params: Promise<{ jobId: string }> }
) {
    try {
        const { jobId } = await context.params;

        if (!jobId) {
            return NextResponse.json({ error: 'Job ID required' }, { status: 400 });
        }

        const job = await prisma.scanJob.findUnique({
            where: { id: jobId },
            include: {
                company: {
                    select: {
                        companyName: true,
                        websiteUrl: true
                    }
                }
            }
        });

        if (!job) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }

        return NextResponse.json({
            jobId: job.id,
            companyId: job.companyId,
            companyName: job.company.companyName,
            scanType: job.scanType,
            status: job.status,
            progress: job.progress,
            startedAt: job.startedAt?.toISOString() || null,
            finishedAt: job.finishedAt?.toISOString() || null,
            errorCode: job.errorCode,
            errorMessage: job.errorMessage,
            attemptCount: job.attemptCount,
            resultSummary: job.resultSummary,
            requestedFromSurface: job.requestedFromSurface
        });

    } catch (error: any) {
        console.error('[ScanJob] Error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to get job status'
        }, { status: 500 });
    }
}

/**
 * DELETE /api/scans/jobs/[jobId]
 * 
 * Cancel a queued or running job
 */
export async function DELETE(
    request: Request,
    context: { params: Promise<{ jobId: string }> }
) {
    try {
        const { jobId } = await context.params;

        if (!jobId) {
            return NextResponse.json({ error: 'Job ID required' }, { status: 400 });
        }

        const job = await prisma.scanJob.findUnique({
            where: { id: jobId }
        });

        if (!job) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }

        if (job.status !== 'queued' && job.status !== 'running') {
            return NextResponse.json({
                error: 'Can only cancel queued or running jobs'
            }, { status: 400 });
        }

        await prisma.scanJob.update({
            where: { id: jobId },
            data: {
                status: 'cancelled',
                finishedAt: new Date()
            }
        });

        return NextResponse.json({
            success: true,
            message: 'Job cancelled'
        });

    } catch (error: any) {
        console.error('[ScanJob Cancel] Error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to cancel job'
        }, { status: 500 });
    }
}
