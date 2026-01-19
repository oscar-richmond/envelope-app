import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const BATCH_SIZE = 100;

/**
 * ⚠️ DEPRECATED - DO NOT USE ⚠️
 * 
 * Backfill Website Health Fields
 * 
 * This route is DISABLED because it creates invalid canonical records:
 * - Writes version=1 (not V2-compliant)
 * - Writes success status WITHOUT webHealthData/websiteHealthLabel
 * - Can write score=0 with success status
 * - Missing traceId, lastWriter, lastSurface metadata
 * 
 * REPLACEMENT: Use runWebsiteHealthScan() to properly scan companies.
 * 
 * This endpoint is kept for reference only and requires admin secret to execute.
 */

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'BACKFILL_DISABLED_NO_SECRET_SET';

interface BackfillResult {
    id: number;
    status: 'updated' | 'skipped' | 'error';
    wasScanned: boolean;
    score: number | null;
    error?: string;
}

export async function GET(request: Request) {
    // GUARD: Require admin secret
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');

    if (secret !== ADMIN_SECRET) {
        return NextResponse.json({
            error: 'DEPRECATED_ENDPOINT',
            message: 'This backfill route is disabled. It creates invalid version=1 records. Use runWebsiteHealthScan() instead.',
            documentation: 'See investigation_findings.md for details on why this was disabled.'
        }, { status: 403 });
    }
    const lastProcessedId = parseInt(searchParams.get('lastProcessedId') || '0');
    const limit = parseInt(searchParams.get('limit') || String(BATCH_SIZE));
    const dryRun = searchParams.get('dryRun') === 'true';
    const statusOnly = searchParams.get('status') === 'true';

    try {
        // Status check - how many need backfill?
        if (statusOnly) {
            const [total, needsBackfill, alreadyMigrated] = await Promise.all([
                prisma.companyProspect.count(),
                prisma.companyProspect.count({
                    where: { websiteHealthStatus: null }
                }),
                prisma.companyProspect.count({
                    where: { websiteHealthStatus: { not: null } }
                })
            ]);

            return NextResponse.json({
                total,
                needsBackfill,
                alreadyMigrated,
                percentComplete: total > 0
                    ? Math.round((alreadyMigrated / total) * 100)
                    : 100
            });
        }

        // Find companies needing backfill
        const companies = await prisma.companyProspect.findMany({
            where: {
                websiteHealthStatus: null,
                id: { gt: lastProcessedId }
            },
            select: {
                id: true,
                stalenessScore: true,
                lastAnalysedAt: true,
                websiteHealthStatus: true
            },
            orderBy: { id: 'asc' },
            take: limit
        });

        if (companies.length === 0) {
            return NextResponse.json({
                status: 'complete',
                message: 'No more companies to backfill',
                processed: 0,
                lastProcessedId
            });
        }

        const results: BackfillResult[] = [];

        for (const company of companies) {
            // Skip if already migrated
            if (company.websiteHealthStatus !== null) {
                results.push({
                    id: company.id,
                    status: 'skipped',
                    wasScanned: false,
                    score: null
                });
                continue;
            }

            const wasScanned = company.lastAnalysedAt !== null;

            const updateData = {
                websiteHealthStatus: wasScanned ? 'success' : 'idle',
                websiteHealthScore: wasScanned ? company.stalenessScore : null,
                websiteHealthScannedAt: wasScanned ? company.lastAnalysedAt : null,
                websiteHealthError: null,
                websiteHealthVersion: 1
            };

            if (dryRun) {
                results.push({
                    id: company.id,
                    status: 'skipped',
                    wasScanned,
                    score: updateData.websiteHealthScore ?? null
                });
                continue;
            }

            try {
                await prisma.companyProspect.update({
                    where: { id: company.id },
                    data: updateData
                });

                results.push({
                    id: company.id,
                    status: 'updated',
                    wasScanned,
                    score: updateData.websiteHealthScore ?? null
                });
            } catch (error: any) {
                results.push({
                    id: company.id,
                    status: 'error',
                    wasScanned,
                    score: null,
                    error: error.message
                });
            }
        }

        const lastId = companies[companies.length - 1]?.id || lastProcessedId;
        const updatedCount = results.filter(r => r.status === 'updated').length;
        const scannedCount = results.filter(r => r.wasScanned).length;
        const errorCount = results.filter(r => r.status === 'error').length;

        console.log(`[WebsiteHealth Backfill] Processed ${companies.length}: ${updatedCount} updated, ${scannedCount} were scanned, ${errorCount} errors`);

        return NextResponse.json({
            status: companies.length === limit ? 'in_progress' : 'complete',
            mode: dryRun ? 'dry_run' : 'live',
            processed: companies.length,
            updated: updatedCount,
            scanned: scannedCount,
            errors: errorCount,
            lastProcessedId: lastId,
            nextUrl: dryRun
                ? `/api/admin/backfill-website-health?lastProcessedId=${lastId}&limit=${limit}&dryRun=true`
                : `/api/admin/backfill-website-health?lastProcessedId=${lastId}&limit=${limit}`,
            results: results.slice(0, 10) // Only return first 10 for brevity
        });

    } catch (error: any) {
        console.error('[WebsiteHealth Backfill] Error:', error);
        return NextResponse.json({
            error: error.message
        }, { status: 500 });
    }
}

export async function POST(request: Request) {
    // Full backfill - processes all records in one go
    // Use with caution on large datasets

    const body = await request.json().catch(() => ({}));
    const dryRun = body.dryRun === true;
    const batchSize = body.batchSize || BATCH_SIZE;

    let totalProcessed = 0;
    let totalUpdated = 0;
    let totalErrors = 0;
    let cursor = 0;

    try {
        while (true) {
            const companies = await prisma.companyProspect.findMany({
                where: {
                    websiteHealthStatus: null,
                    id: { gt: cursor }
                },
                select: {
                    id: true,
                    stalenessScore: true,
                    lastAnalysedAt: true
                },
                orderBy: { id: 'asc' },
                take: batchSize
            });

            if (companies.length === 0) break;

            for (const company of companies) {
                const wasScanned = company.lastAnalysedAt !== null;

                if (!dryRun) {
                    try {
                        await prisma.companyProspect.update({
                            where: { id: company.id },
                            data: {
                                websiteHealthStatus: wasScanned ? 'success' : 'idle',
                                websiteHealthScore: wasScanned ? company.stalenessScore : null,
                                websiteHealthScannedAt: wasScanned ? company.lastAnalysedAt : null,
                                websiteHealthError: null,
                                websiteHealthVersion: 1
                            }
                        });
                        totalUpdated++;
                    } catch {
                        totalErrors++;
                    }
                } else {
                    totalUpdated++;
                }
                totalProcessed++;
            }

            cursor = companies[companies.length - 1].id;
            console.log(`[Backfill] Batch complete: cursor=${cursor}, processed=${totalProcessed}`);
        }

        return NextResponse.json({
            status: 'complete',
            mode: dryRun ? 'dry_run' : 'live',
            totalProcessed,
            totalUpdated,
            totalErrors
        });

    } catch (error: any) {
        console.error('[WebsiteHealth Backfill] Error:', error);
        return NextResponse.json({
            error: error.message,
            processedBeforeError: totalProcessed
        }, { status: 500 });
    }
}
