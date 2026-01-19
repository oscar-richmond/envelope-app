/**
 * Admin Endpoint: Rescore Website Health V1 → V2
 * 
 * Migrates companies from V1 scoring to V2:
 * - Recomputes scores using V2 engine
 * - Updates canonical fields
 * - Persists V2 report with traceId
 * - Marks version as 2
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { computeWebsiteHealthV2 } from '@/lib/scoring/computeWebsiteHealthV2';

export async function POST(request: Request) {
    // Guard: Production safety
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_ADMIN_RESCORE !== '1') {
        return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { dryRun = false, companyId, limit = 100 } = body;

        // Find companies needing migration
        const where = companyId
            ? { id: companyId }
            : {
                OR: [
                    { websiteHealthVersion: { not: 2 } },
                    { websiteHealthVersion: undefined },
                    // Also migration companies with version 2 but invalid data
                    {
                        AND: [
                            { websiteHealthVersion: 2 },
                            { websiteHealthScore: undefined }, // Changed from { not: null } to undefined to match the intent of "invalid data"
                            // Can add more complex validation here
                        ]
                    }
                ]
            };

        const companies = await prisma.companyProspect.findMany({
            where,
            take: limit,
            orderBy: { id: 'asc' }
        });

        const results = {
            total: companies.length,
            rescored: 0,
            skipped: 0,
            errors: [] as any[]
        };

        for (const company of companies) {
            try {
                // Skip if no website URL
                if (!company.websiteUrl) {
                    results.skipped++;
                    continue;
                }

                // Extract domain
                const domain = company.websiteUrl
                    .replace(/^https?:\/\//, '')
                    .replace(/^www\./, '')
                    .split('/')[0];

                // Determine scan state from existing data
                let isReachable = true;
                let isHttps = company.websiteUrl.startsWith('https');
                let httpStatus = 200;

                // If we have legacy data, try to infer state
                if (company.webHealthData) {
                    try {
                        const oldReport = JSON.parse(company.webHealthData);
                        // Try to extract signals from old report
                        if (oldReport.factors) {
                            const unreachableFactor = oldReport.factors.find((f: any) =>
                                f.id === 'unreachable' || f.label?.includes('unreachable')
                            );
                            if (unreachableFactor) {
                                isReachable = false;
                            }
                        }
                    } catch (e) {
                        // Ignore parse errors
                    }
                }

                // Calculate days since last verified
                let daysSinceVerified: number | undefined;
                if (company.websiteHealthScannedAt) {
                    const daysSince = Math.floor(
                        (Date.now() - new Date(company.websiteHealthScannedAt).getTime()) / (1000 * 60 * 60 * 24)
                    );
                    daysSinceVerified = daysSince;
                }

                // Recompute with V2
                const report = computeWebsiteHealthV2({
                    domain,
                    isReachable,
                    isHttps,
                    httpStatus,
                    daysSinceVerified,
                    hasSitemap: false // Unknown for backfill
                });

                // DRY RUN: Just log, don't write
                if (dryRun) {
                    const oldScore = company.websiteHealthScore;
                    const oldLabel = company.websiteHealthLabel;
                    const oldVersion = company.websiteHealthVersion;

                    console.log('[Rescore Dry Run]', {
                        companyId: company.id,
                        companyName: company.companyName,
                        old: { score: oldScore, label: oldLabel, version: oldVersion },
                        new: { score: report.score, label: report.label, version: 2 },
                        traceId: report.traceId
                    });

                    results.rescored++;
                    continue;
                }

                // WRITE: Persist V2 results
                await prisma.companyProspect.update({
                    where: { id: company.id },
                    data: {
                        // Canonical fields (V2)
                        websiteHealthStatus: 'success',
                        websiteHealthScore: report.score,
                        websiteHealthLabel: report.label,
                        websiteHealthScannedAt: new Date(),
                        websiteHealthError: null,
                        websiteHealthVersion: 2,

                        // Stored report
                        webHealthData: JSON.stringify(report),

                        // Legacy dual-write
                        stalenessScore: report.score,
                        lastAnalysedAt: new Date(),
                        signals: JSON.stringify(report.factors.map(f => f.label))
                    }
                });

                results.rescored++;

            } catch (error: any) {
                results.errors.push({
                    companyId: company.id,
                    companyName: company.companyName,
                    error: error.message
                });
            }
        }

        return NextResponse.json({
            success: true,
            dryRun,
            results,
            message: dryRun
                ? `Dry run: Would rescore ${results.rescored} companies`
                : `Rescored ${results.rescored} companies to V2`
        });

    } catch (error: any) {
        console.error('[Rescore] Fatal error:', error);
        return NextResponse.json({
            error: 'Rescore failed',
            details: error.message
        }, { status: 500 });
    }
}
