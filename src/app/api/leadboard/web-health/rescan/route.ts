import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * POST /api/leadboard/web-health/rescan
 * 
 * Bulk rescan Web Health for all leads in scope
 * Returns job info for progress tracking
 */
export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const { leadIds, scope } = body;

        console.log('[BulkWebHealthRescan] Request received:', {
            leadIdsCount: leadIds?.length,
            scope
        });

        // Determine which leads to scan
        let leadsToScan: any[] = [];

        if (leadIds && Array.isArray(leadIds) && leadIds.length > 0) {
            // Scan specific leads
            leadsToScan = await prisma.lead.findMany({
                where: { id: { in: leadIds } },
                include: { companyProspect: true }
            });
        } else {
            // Scan all leads (current page/all - depends on scope)
            leadsToScan = await prisma.lead.findMany({
                take: 100, // Limit to prevent overload
                include: { companyProspect: true },
                orderBy: { createdAt: 'desc' }
            });
        }

        console.log(`[BulkWebHealthRescan] Found ${leadsToScan.length} leads to scan`);

        // Generate job ID
        const jobId = `webhealth-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Store job in memory (in production, use Redis or DB)
        const job = {
            id: jobId,
            total: leadsToScan.length,
            completed: 0,
            failed: 0,
            results: {} as Record<number, any>,
            status: 'processing' as 'processing' | 'complete' | 'failed',
            createdAt: new Date()
        };

        // Store job reference (using global for simplicity - use Redis in production)
        (global as any).__webHealthJobs = (global as any).__webHealthJobs || {};
        (global as any).__webHealthJobs[jobId] = job;

        // Process in background (don't await)
        processLeadsInBackground(jobId, leadsToScan, job);

        return NextResponse.json({
            success: true,
            jobId,
            countQueued: leadsToScan.length,
            message: `Queued ${leadsToScan.length} leads for Web Health scan`
        });

    } catch (error: any) {
        console.error('[BulkWebHealthRescan] Error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to start bulk rescan'
        }, { status: 500 });
    }
}

/**
 * GET /api/leadboard/web-health/rescan?jobId=xxx
 * 
 * Check status of bulk rescan job
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const jobId = searchParams.get('jobId');

        if (!jobId) {
            return NextResponse.json({ error: 'jobId required' }, { status: 400 });
        }

        const jobs = (global as any).__webHealthJobs || {};
        const job = jobs[jobId];

        if (!job) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }

        return NextResponse.json({
            jobId: job.id,
            status: job.status,
            total: job.total,
            completed: job.completed,
            failed: job.failed,
            results: job.results,
            progress: job.total > 0 ? Math.round((job.completed / job.total) * 100) : 0
        });

    } catch (error: any) {
        console.error('[BulkWebHealthRescan] GET error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to get job status'
        }, { status: 500 });
    }
}

// Background processor
async function processLeadsInBackground(
    jobId: string,
    leads: any[],
    job: any
) {
    console.log(`[BulkWebHealthRescan] Starting background processing for job ${jobId}`);

    for (const lead of leads) {
        try {
            const prospect = lead.companyProspect;
            if (!prospect) {
                job.failed++;
                job.results[lead.id] = { error: 'No prospect data' };
                continue;
            }

            // Get domain
            let domain = prospect.websiteDomain || '';
            const websiteUrl = prospect.websiteUrl || '';

            if (!domain && websiteUrl) {
                domain = websiteUrl
                    .replace(/^https?:\/\//, '')
                    .replace(/^www\./, '')
                    .split('/')[0];
            }

            if (!domain) {
                job.failed++;
                job.results[lead.id] = { error: 'No domain' };
                continue;
            }

            // Perform scan
            let score = 50;
            const signals: string[] = [];

            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 8000);

                const response = await fetch(`https://${domain}`, {
                    method: 'HEAD',
                    signal: controller.signal,
                    headers: { 'User-Agent': 'EnvelopeBot/1.0' }
                }).catch(() => null);

                clearTimeout(timeout);

                if (response) {
                    score += 20;
                    signals.push('Website reachable');
                    if (response.ok) {
                        score += 10;
                        signals.push('Returns 200 OK');
                    }
                } else {
                    score -= 20;
                    signals.push('Website may be unreachable');
                }
            } catch (e) {
                signals.push('Scan timeout');
            }

            score = Math.max(0, Math.min(100, score));
            const label = score >= 70 ? 'Fresh' : score >= 40 ? 'Stale' : 'Risk';

            // Update database
            await prisma.companyProspect.update({
                where: { id: prospect.id },
                data: {
                    websiteDomain: domain,
                    websiteDiscoveryDate: new Date(),
                    stalenessScore: score,
                    stalenessLabel: label,
                    websiteSignals: JSON.stringify(signals)
                }
            });

            job.completed++;
            job.results[lead.id] = {
                success: true,
                score,
                label,
                domain,
                lastScanned: new Date().toISOString()
            };

        } catch (e: any) {
            console.error(`[BulkWebHealthRescan] Error processing lead ${lead.id}:`, e);
            job.failed++;
            job.results[lead.id] = { error: e.message };
        }
    }

    job.status = 'complete';
    console.log(`[BulkWebHealthRescan] Job ${jobId} complete: ${job.completed}/${job.total} succeeded, ${job.failed} failed`);
}
