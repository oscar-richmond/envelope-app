/**
 * Reset Derived Data Endpoint
 * 
 * POST /api/admin/reset-derived-data
 * 
 * Safely clears derived scan/enrichment data WITHOUT deleting core entities.
 * 
 * SAFE: Only resets website health, financial health, contact scan caches, scan statuses.
 * DOES NOT DELETE: Users, companies, leads, tags, drafts, threads, sent emails, 
 *                  manually-added contacts, auth sessions, Gmail data.
 * 
 * Required body:
 * {
 *   "scope": "all" | "companies",
 *   "companyIds": [...optional...],
 *   "confirm": "RESET_DERIVED_DATA"
 * }
 * 
 * Query params:
 *   ?dryRun=1 - Preview only, no writes
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';

// Check if production reset is allowed
const ALLOW_PROD_DERIVED_RESET = process.env.ALLOW_PROD_DERIVED_RESET === 'true';
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

interface ResetResult {
    companiesAffected: number;
    fieldsReset: {
        websiteHealth: number;
        financialHealth: number;
        contactScans: number;
        scanJobs: number;
    };
    timeMs: number;
    dryRun: boolean;
}

export async function POST(request: Request) {
    const startTime = Date.now();

    try {
        // Auth check
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if request is a dry run
        const { searchParams } = new URL(request.url);
        const dryRun = searchParams.get('dryRun') === '1' || searchParams.get('dryRun') === 'true';

        // Parse body
        const body = await request.json().catch(() => ({}));
        const { scope = 'all', companyIds, confirm } = body;

        // Production safety gate
        if (IS_PRODUCTION && !dryRun) {
            if (!ALLOW_PROD_DERIVED_RESET) {
                return NextResponse.json({
                    error: 'Production reset not allowed',
                    message: 'Set ALLOW_PROD_DERIVED_RESET=true to enable production resets',
                    hint: 'Use ?dryRun=1 to preview'
                }, { status: 403 });
            }
            if (confirm !== 'RESET_DERIVED_DATA') {
                return NextResponse.json({
                    error: 'Confirmation required for production reset',
                    message: 'Include { "confirm": "RESET_DERIVED_DATA" } in body'
                }, { status: 400 });
            }
        }

        // Staging still requires confirmation for non-dry-run
        if (!dryRun && confirm !== 'RESET_DERIVED_DATA') {
            return NextResponse.json({
                error: 'Confirmation required',
                message: 'Include { "confirm": "RESET_DERIVED_DATA" } in body, or use ?dryRun=1 to preview'
            }, { status: 400 });
        }

        console.log(`[ResetDerivedData] Starting reset (dryRun=${dryRun}, scope=${scope}, production=${IS_PRODUCTION})`);

        // Build where clause
        let whereClause: any = {};
        if (scope === 'companies' && companyIds && Array.isArray(companyIds) && companyIds.length > 0) {
            whereClause = { id: { in: companyIds.map((id: any) => parseInt(id)).filter((id: number) => !isNaN(id)) } };
        }

        // Count affected records
        const companiesCount = await prisma.companyProspect.count({ where: whereClause });

        // Count scan jobs
        const scanJobsCount = await prisma.scanJob.count();

        const result: ResetResult = {
            companiesAffected: companiesCount,
            fieldsReset: {
                websiteHealth: companiesCount,
                financialHealth: companiesCount,
                contactScans: 0, // Will update if we have contact scan data
                scanJobs: scanJobsCount
            },
            timeMs: 0,
            dryRun
        };

        if (!dryRun) {
            // ========== RESET WEBSITE HEALTH DERIVED FIELDS ==========
            await prisma.companyProspect.updateMany({
                where: whereClause,
                data: {
                    // New schema fields
                    websiteHealthStatus: 'idle',
                    websiteHealthScore: null,
                    websiteHealthScannedAt: null,
                    websiteHealthError: null,
                    // Keep websiteHealthVersion for tracking

                    // Legacy schema fields (for consistency)
                    stalenessScore: null,
                    stalenessConfidence: null,
                    lastAnalysedAt: null,
                    scoreReasons: null,
                    signals: null,
                    webHealthData: null
                }
            });

            // ========== RESET FINANCIAL HEALTH DERIVED FIELDS ==========
            await prisma.companyProspect.updateMany({
                where: whereClause,
                data: {
                    financialActivityScore: null,
                    financialActivityBand: null,
                    financialSignals: null,
                    financialLastCheckedAt: null,
                    finHealthData: null
                }
            });

            // ========== RESET CONTACT SCAN CACHES ==========
            // Note: We do NOT delete manually-added contacts
            // Only reset scan timestamps and cache data
            await prisma.companyProspect.updateMany({
                where: whereClause,
                data: {
                    contactsLastScannedAt: null,
                    // Do NOT reset enrichmentData - may contain manual data
                }
            });

            // ========== CLEAR SCAN JOBS (all statuses) ==========
            // Delete scan job records (these are just tracking records, not data)
            const deletedJobs = await prisma.scanJob.deleteMany({});
            result.fieldsReset.scanJobs = deletedJobs.count;

            console.log(`[ResetDerivedData] Reset complete: ${companiesCount} companies, ${deletedJobs.count} scan jobs`);
        }

        result.timeMs = Date.now() - startTime;

        return NextResponse.json({
            success: true,
            ...result,
            message: dryRun
                ? `DRY RUN: Would reset derived data for ${companiesCount} companies`
                : `Reset derived data for ${companiesCount} companies`,
            safetyNote: 'Core entities (users, leads, emails, contacts, threads) were NOT affected'
        });

    } catch (error: any) {
        console.error('[ResetDerivedData] Error:', error);
        return NextResponse.json({
            error: 'Failed to reset derived data',
            details: error.message
        }, { status: 500 });
    }
}

export async function GET(request: Request) {
    // GET returns preview info (same as dry run)
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const companiesCount = await prisma.companyProspect.count();
        const scanJobsCount = await prisma.scanJob.count();

        // Count companies with derived data
        const withWebsiteHealth = await prisma.companyProspect.count({
            where: {
                OR: [
                    { websiteHealthStatus: { not: 'idle' } },
                    { websiteHealthScore: { not: null } },
                    { lastAnalysedAt: { not: null } }
                ]
            }
        });

        const withFinancialHealth = await prisma.companyProspect.count({
            where: {
                OR: [
                    { financialActivityScore: { not: null } },
                    { finHealthData: { not: null } }
                ]
            }
        });

        return NextResponse.json({
            info: 'Reset Derived Data Preview',
            isProduction: IS_PRODUCTION,
            productionResetAllowed: ALLOW_PROD_DERIVED_RESET,
            totals: {
                companies: companiesCount,
                scanJobs: scanJobsCount
            },
            withDerivedData: {
                websiteHealth: withWebsiteHealth,
                financialHealth: withFinancialHealth
            },
            usage: {
                dryRun: 'POST /api/admin/reset-derived-data?dryRun=1',
                execute: 'POST /api/admin/reset-derived-data with { "confirm": "RESET_DERIVED_DATA" }'
            },
            safetyGuarantees: [
                'Does NOT delete users, leads, tags, drafts, threads',
                'Does NOT delete sent emails or Gmail data',
                'Does NOT delete manually-added contacts',
                'Does NOT delete auth sessions',
                'Only resets website health, financial health, scan caches'
            ]
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
