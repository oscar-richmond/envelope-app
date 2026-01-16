/**
 * Website Health Mismatch Detector
 * 
 * GET /api/debug/website-health-mismatches
 * 
 * Lists companies where new and legacy schema values differ:
 * - new status != legacy status (inferred)
 * - new score != legacy score (when both complete)
 * - one is complete and the other is idle
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { FEATURE_FLAGS } from '@/lib/featureFlags';

export async function GET() {
    try {
        // Get all companies with some health data
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
                companyNumber: true,
                // New fields
                websiteHealthStatus: true,
                websiteHealthScore: true,
                websiteHealthScannedAt: true,
                // Legacy fields
                stalenessScore: true,
                lastAnalysedAt: true
            },
            orderBy: { id: 'asc' }
        });

        const mismatches: Array<{
            id: number;
            companyName: string | null;
            companyNumber: string | null;
            mismatchType: string;
            newFields: {
                status: string | null;
                score: number | null;
                scannedAt: Date | null;
            };
            legacyFields: {
                statusInferred: string;
                score: number | null;
                scannedAt: Date | null;
            };
        }> = [];

        for (const p of prospects) {
            // Infer legacy status from lastAnalysedAt
            const legacyStatusInferred = p.lastAnalysedAt ? 'success' : 'idle';
            const newStatus = p.websiteHealthStatus || 'idle';

            let mismatchType: string | null = null;

            // Check for status mismatch
            if (newStatus === 'success' && legacyStatusInferred !== 'success') {
                mismatchType = 'status_mismatch: new=success, legacy=idle';
            } else if (newStatus !== 'success' && legacyStatusInferred === 'success') {
                mismatchType = 'status_mismatch: new=idle, legacy=success';
            }

            // Check for score mismatch when both are "complete"
            if (newStatus === 'success' && legacyStatusInferred === 'success') {
                const newScore = p.websiteHealthScore;
                const legacyScore = p.stalenessScore;

                if (newScore !== legacyScore) {
                    mismatchType = `score_mismatch: new=${newScore}, legacy=${legacyScore}`;
                }
            }

            if (mismatchType) {
                mismatches.push({
                    id: p.id,
                    companyName: p.companyName,
                    companyNumber: p.companyNumber,
                    mismatchType,
                    newFields: {
                        status: p.websiteHealthStatus,
                        score: p.websiteHealthScore,
                        scannedAt: p.websiteHealthScannedAt
                    },
                    legacyFields: {
                        statusInferred: legacyStatusInferred,
                        score: p.stalenessScore,
                        scannedAt: p.lastAnalysedAt
                    }
                });
            }
        }

        return NextResponse.json({
            meta: {
                endpoint: '/api/debug/website-health-mismatches',
                timestamp: new Date().toISOString(),
                featureFlag: FEATURE_FLAGS.USE_NEW_WEBSITE_HEALTH_SCHEMA,
                totalProspects: prospects.length,
                mismatchCount: mismatches.length
            },
            mismatches: mismatches.slice(0, 100) // Limit to 100
        });

    } catch (error: any) {
        console.error('[DebugMismatches] Error:', error);
        return NextResponse.json({
            error: 'Failed to check mismatches',
            details: error.message
        }, { status: 500 });
    }
}
