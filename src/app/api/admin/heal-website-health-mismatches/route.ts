/**
 * Heal Website Health Mismatches
 * 
 * POST /api/admin/heal-website-health-mismatches
 * 
 * Finds companies where new vs legacy fields differ and syncs them.
 * 
 * Healing logic:
 * 1. If legacy scannedAt is newer AND legacy status is success → copy legacy → new
 * 2. If new scannedAt is newer AND new is success → copy new → legacy
 * 3. If one side is idle and other is complete → copy complete to both
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { FEATURE_FLAGS } from '@/lib/featureFlags';

interface HealResult {
    id: number;
    companyName: string | null;
    action: 'healed_new_to_legacy' | 'healed_legacy_to_new' | 'skipped' | 'error';
    details: string;
    before?: {
        new: { status: string | null; score: number | null; scannedAt: Date | null };
        legacy: { score: number | null; scannedAt: Date | null };
    };
    after?: {
        new: { status: string | null; score: number | null; scannedAt: Date | null };
        legacy: { score: number | null; scannedAt: Date | null };
    };
}

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const { dryRun = false, limit = 100 } = body;

        console.log(`[HealMismatches] Starting heal job (dryRun=${dryRun}, limit=${limit})`);

        // Find all companies with potential mismatches
        const prospects = await prisma.companyProspect.findMany({
            where: {
                OR: [
                    { websiteHealthStatus: { not: null } },
                    { lastAnalysedAt: { not: null } },
                    { stalenessScore: { not: null } }
                ]
            },
            select: {
                id: true,
                companyName: true,
                // New fields
                websiteHealthStatus: true,
                websiteHealthScore: true,
                websiteHealthScannedAt: true,
                websiteHealthError: true,
                websiteHealthVersion: true,
                // Legacy fields
                stalenessScore: true,
                lastAnalysedAt: true,
                stalenessConfidence: true
            },
            take: limit
        });

        const results: HealResult[] = [];
        let healedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const p of prospects) {
            try {
                // Infer legacy status from lastAnalysedAt
                const legacyStatusInferred = p.lastAnalysedAt ? 'success' : 'idle';
                const newStatus = p.websiteHealthStatus || 'idle';

                // Check if there's a mismatch
                let hasMismatch = false;
                let mismatchType = '';

                // Status mismatch
                if (newStatus === 'success' && legacyStatusInferred !== 'success') {
                    hasMismatch = true;
                    mismatchType = 'new=success, legacy=idle';
                } else if (newStatus !== 'success' && legacyStatusInferred === 'success') {
                    hasMismatch = true;
                    mismatchType = 'new=idle, legacy=success';
                }

                // Score mismatch when both complete
                if (newStatus === 'success' && legacyStatusInferred === 'success') {
                    if (p.websiteHealthScore !== p.stalenessScore) {
                        hasMismatch = true;
                        mismatchType = `score: new=${p.websiteHealthScore}, legacy=${p.stalenessScore}`;
                    }
                }

                if (!hasMismatch) {
                    skippedCount++;
                    continue; // No mismatch, skip
                }

                const before = {
                    new: {
                        status: p.websiteHealthStatus,
                        score: p.websiteHealthScore,
                        scannedAt: p.websiteHealthScannedAt
                    },
                    legacy: {
                        score: p.stalenessScore,
                        scannedAt: p.lastAnalysedAt
                    }
                };

                // Determine healing action
                let action: 'healed_new_to_legacy' | 'healed_legacy_to_new' | 'skipped' = 'skipped';
                let updateData: any = null;

                const newScannedAt = p.websiteHealthScannedAt ? new Date(p.websiteHealthScannedAt).getTime() : 0;
                const legacyScannedAt = p.lastAnalysedAt ? new Date(p.lastAnalysedAt).getTime() : 0;

                // Case 1: Legacy is complete but new is idle → copy legacy to new
                if (legacyStatusInferred === 'success' && newStatus === 'idle') {
                    action = 'healed_legacy_to_new';
                    updateData = {
                        websiteHealthStatus: 'success',
                        websiteHealthScore: p.stalenessScore,
                        websiteHealthScannedAt: p.lastAnalysedAt,
                        websiteHealthError: null,
                        websiteHealthVersion: { increment: 1 }
                    };
                }
                // Case 2: New is complete but legacy is idle → copy new to legacy
                else if (newStatus === 'success' && legacyStatusInferred === 'idle') {
                    action = 'healed_new_to_legacy';
                    updateData = {
                        stalenessScore: p.websiteHealthScore ?? 0,
                        lastAnalysedAt: p.websiteHealthScannedAt,
                        stalenessConfidence: p.stalenessConfidence || 'MEDIUM'
                    };
                }
                // Case 3: Both complete but scores differ
                else if (newStatus === 'success' && legacyStatusInferred === 'success') {
                    // Use the one with newer scannedAt, but prefer new if equal
                    if (legacyScannedAt > newScannedAt) {
                        // Legacy is newer → copy legacy to new
                        action = 'healed_legacy_to_new';
                        updateData = {
                            websiteHealthStatus: 'success',
                            websiteHealthScore: p.stalenessScore,
                            websiteHealthScannedAt: p.lastAnalysedAt,
                            websiteHealthError: null,
                            websiteHealthVersion: { increment: 1 }
                        };
                    } else {
                        // New is newer or equal → copy new to legacy
                        action = 'healed_new_to_legacy';
                        updateData = {
                            stalenessScore: p.websiteHealthScore ?? 0,
                            lastAnalysedAt: p.websiteHealthScannedAt
                        };
                    }
                }

                if (action === 'skipped' || !updateData) {
                    skippedCount++;
                    results.push({
                        id: p.id,
                        companyName: p.companyName,
                        action: 'skipped',
                        details: `No clear healing path for: ${mismatchType}`,
                        before
                    });
                    continue;
                }

                // Apply the heal (unless dry run)
                if (!dryRun) {
                    await prisma.companyProspect.update({
                        where: { id: p.id },
                        data: updateData
                    });
                }

                healedCount++;

                // Read back for "after" state
                let after = before;
                if (!dryRun) {
                    const updated = await prisma.companyProspect.findUnique({
                        where: { id: p.id },
                        select: {
                            websiteHealthStatus: true,
                            websiteHealthScore: true,
                            websiteHealthScannedAt: true,
                            stalenessScore: true,
                            lastAnalysedAt: true
                        }
                    });
                    if (updated) {
                        after = {
                            new: {
                                status: updated.websiteHealthStatus,
                                score: updated.websiteHealthScore,
                                scannedAt: updated.websiteHealthScannedAt
                            },
                            legacy: {
                                score: updated.stalenessScore,
                                scannedAt: updated.lastAnalysedAt
                            }
                        };
                    }
                }

                results.push({
                    id: p.id,
                    companyName: p.companyName,
                    action,
                    details: `Healed ${mismatchType}`,
                    before,
                    after
                });

            } catch (e: any) {
                errorCount++;
                results.push({
                    id: p.id,
                    companyName: p.companyName,
                    action: 'error',
                    details: e.message
                });
            }
        }

        console.log(`[HealMismatches] Complete: ${healedCount} healed, ${skippedCount} skipped, ${errorCount} errors`);

        return NextResponse.json({
            success: true,
            dryRun,
            summary: {
                total: prospects.length,
                healed: healedCount,
                skipped: skippedCount,
                errors: errorCount
            },
            featureFlag: FEATURE_FLAGS.USE_NEW_WEBSITE_HEALTH_SCHEMA,
            results: results.filter(r => r.action !== 'skipped') // Only return healed/error items
        });

    } catch (error: any) {
        console.error('[HealMismatches] Error:', error);
        return NextResponse.json({
            error: 'Failed to heal mismatches',
            details: error.message
        }, { status: 500 });
    }
}

export async function GET() {
    // Return current mismatch count for quick check
    const prospects = await prisma.companyProspect.findMany({
        where: {
            OR: [
                { websiteHealthStatus: { not: null } },
                { lastAnalysedAt: { not: null } }
            ]
        },
        select: {
            id: true,
            websiteHealthStatus: true,
            websiteHealthScore: true,
            stalenessScore: true,
            lastAnalysedAt: true
        }
    });

    let mismatchCount = 0;
    for (const p of prospects) {
        const legacyStatus = p.lastAnalysedAt ? 'success' : 'idle';
        const newStatus = p.websiteHealthStatus || 'idle';

        if (newStatus === 'success' && legacyStatus !== 'success') mismatchCount++;
        else if (newStatus !== 'success' && legacyStatus === 'success') mismatchCount++;
        else if (newStatus === 'success' && legacyStatus === 'success' && p.websiteHealthScore !== p.stalenessScore) {
            mismatchCount++;
        }
    }

    return NextResponse.json({
        totalProspects: prospects.length,
        mismatchCount,
        featureFlag: FEATURE_FLAGS.USE_NEW_WEBSITE_HEALTH_SCHEMA,
        hint: mismatchCount > 0 ? 'POST to this endpoint with { dryRun: true } to preview healing' : 'No mismatches to heal'
    });
}
