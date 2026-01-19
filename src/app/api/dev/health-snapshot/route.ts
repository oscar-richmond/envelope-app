/**
 * Health Snapshot Endpoint
 * 
 * Dev-only diagnostic endpoint that shows:
 * - DB canonical state
 * - What each surface (Search/Lead Board/Overview) returns
 * - Validation checks
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { validateWebsiteHealthV2Report } from '@/lib/scoring/computeWebsiteHealthV2';

import { auth } from '@/auth';

export async function GET(request: Request) {
    // 1. Check for valid session
    // const session = await auth();
    // if (!session) {
    //     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    // 2. Guard: Diagnostics enabled
    // Allow if either debug flag is set
    const isDiagnosticsEnabled =
        process.env.NEXT_PUBLIC_DIAGNOSTICS === '1' ||
        process.env.DEBUG_HEALTH === '1' ||
        process.env.NODE_ENV === 'development'; // Allow in dev

    if (process.env.NODE_ENV === 'production' && !isDiagnosticsEnabled) {
        return NextResponse.json({ error: 'Diagnostics not enabled' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
        return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    try {
        // Fetch company with all health fields
        const company = await prisma.companyProspect.findUnique({
            where: { id: parseInt(companyId) },
            select: {
                id: true,
                companyName: true,
                websiteUrl: true,

                // Website Health (canonical)
                websiteHealthStatus: true,
                websiteHealthScore: true,
                websiteHealthLabel: true,
                websiteHealthVersion: true,
                websiteHealthScannedAt: true,
                websiteHealthError: true,
                websiteHealthTraceId: true,
                websiteHealthLastSurface: true,
                websiteHealthLastWriter: true,
                webHealthData: true,

                // Financial Health
                financialActivityScore: true,
                financialActivityBand: true,
                financialLastCheckedAt: true,
                financialHealthStatus: true,
                financialHealthScore: true,
                financialHealthLabel: true,
                financialHealthError: true,
                financialHealthVersion: true,
                financialHealthTraceId: true,
                financialHealthLastSurface: true,
                financialHealthLastWriter: true,
                finHealthData: true,

                // Legacy
                stalenessScore: true,
                lastAnalysedAt: true,
                signals: true
            }
        });

        if (!company) {
            return NextResponse.json({ error: 'Company not found' }, { status: 404 });
        }

        // Parse stored reports
        let webHealthReport = null;
        let finHealthReport = null;

        if (company.webHealthData) {
            try {
                webHealthReport = JSON.parse(company.webHealthData);
            } catch (e) {
                webHealthReport = { parseError: 'Invalid JSON' };
            }
        }

        if (company.finHealthData) {
            try {
                finHealthReport = JSON.parse(company.finHealthData);
            } catch (e) {
                finHealthReport = { parseError: 'Invalid JSON' };
            }
        }

        // Simulate what each surface returns
        const surfaces = {
            search: {
                source: 'canonical fields',
                websiteHealthStatus: company.websiteHealthStatus,
                websiteHealthScore: company.websiteHealthScore,
                websiteHealthLabel: company.websiteHealthLabel,
                financialScore: company.financialActivityScore,
                financialBand: company.financialActivityBand
            },
            leadBoard: {
                source: 'signals.webHealth + signals.finHealth',
                webHealth: {
                    score: company.websiteHealthStatus === 'success' ? company.websiteHealthScore : null,
                    label: company.websiteHealthLabel,
                    updatedAt: company.websiteHealthScannedAt
                },
                finHealth: {
                    score: company.financialActivityScore,
                    label: company.financialActivityBand,
                    updatedAt: company.financialLastCheckedAt
                }
            },
            companyOverview: {
                source: 'canonical + stored report',
                websiteHealthScore: company.websiteHealthScore,
                websiteHealthLabel: company.websiteHealthLabel,
                websiteReport: webHealthReport,
                financialReport: finHealthReport
            }
        };

        // Validation checks
        const checks: any = {
            website: {},
            financial: {}
        };

        // Website Health checks
        if (webHealthReport) {
            const v2Validation = validateWebsiteHealthV2Report(webHealthReport);
            checks.website = {
                versionMatch: company.websiteHealthVersion === webHealthReport.version,
                validation: v2Validation,
                scoreMatch: company.websiteHealthScore === webHealthReport.score,
                labelMatch: company.websiteHealthLabel === webHealthReport.label,
                reportExists: true,
                traceId: webHealthReport.traceId || 'missing'
            };
        } else {
            checks.website = {
                reportExists: false,
                reason: 'No stored report (webHealthData is null)'
            };
        }

        // Financial Health checks
        if (finHealthReport) {
            const factorsCount = finHealthReport.factors?.length || 0;
            checks.financial = {
                reportExists: true,
                factorsCount,
                factorsEmpty: factorsCount === 0,
                scoreMatch: company.financialActivityScore === finHealthReport.score,
                traceId: finHealthReport.traceId || 'missing'
            };
        } else {
            checks.financial = {
                reportExists: false,
                reason: 'No stored report (finHealthData is null)'
            };
        }

        return NextResponse.json({
            companyId: company.id,
            companyName: company.companyName,
            websiteUrl: company.websiteUrl,

            // DB canonical state
            db: {
                websiteHealth: {
                    status: company.websiteHealthStatus,
                    score: company.websiteHealthScore,
                    label: company.websiteHealthLabel,
                    version: company.websiteHealthVersion,
                    scannedAt: company.websiteHealthScannedAt,
                    error: company.websiteHealthError,
                    traceId: company.websiteHealthTraceId,
                    lastSurface: company.websiteHealthLastSurface,
                    lastWriter: company.websiteHealthLastWriter,
                    storedReport: webHealthReport
                },
                financialHealth: {
                    status: company.financialHealthStatus,
                    score: company.financialHealthScore ?? company.financialActivityScore,
                    label: company.financialHealthLabel ?? company.financialActivityBand,
                    version: company.financialHealthVersion,
                    lastCheckedAt: company.financialLastCheckedAt,
                    error: company.financialHealthError,
                    traceId: company.financialHealthTraceId,
                    lastSurface: company.financialHealthLastSurface,
                    lastWriter: company.financialHealthLastWriter,
                    storedReport: finHealthReport
                },
                legacy: {
                    stalenessScore: company.stalenessScore,
                    lastAnalysedAt: company.lastAnalysedAt,
                    signals: company.signals
                }
            },

            // What each surface returns
            surfaces,

            // Validation checks
            checks,

            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
        console.error('[HealthSnapshot] Error:', error);
        return NextResponse.json({
            error: 'Failed to generate snapshot',
            details: error.message
        }, { status: 500 });
    }
}
