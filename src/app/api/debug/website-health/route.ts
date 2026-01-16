/**
 * Website Health Debug Endpoint
 * 
 * GET /api/debug/website-health?companyId=...
 * 
 * Returns complete diagnostic info for website health:
 * - Feature flag state
 * - Raw DB fields (new + legacy)
 * - Computed display model
 * - Recent scan logs
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { getWebsiteHealthDisplay, getActiveSchema } from '@/lib/scoring/websiteHealthUtils';

// In-memory scan log store (dev only, last 5 per company)
const scanLogs: Map<string, Array<{
    timestamp: string;
    action: string;
    writeTarget: string[];
    valuesWritten: {
        status: string | null;
        score: number | null;
        scannedAt: string | null;
        error: string | null;
    };
    computeInputs: {
        signalsCount: number;
        breakdownLength: number;
        finalScore: number | null;
    };
}>> = new Map();

// Export for use by scan routes
export function logScanWrite(companyId: string, data: {
    action: string;
    writeTarget: string[];
    valuesWritten: {
        status: string | null;
        score: number | null;
        scannedAt: string | null;
        error: string | null;
    };
    computeInputs: {
        signalsCount: number;
        breakdownLength: number;
        finalScore: number | null;
    };
}) {
    const key = String(companyId);
    const existing = scanLogs.get(key) || [];
    existing.unshift({
        timestamp: new Date().toISOString(),
        ...data
    });
    // Keep only last 5
    scanLogs.set(key, existing.slice(0, 5));
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
        return NextResponse.json({
            error: 'companyId required',
            usage: 'GET /api/debug/website-health?companyId=123'
        }, { status: 400 });
    }

    try {
        // Get raw company record
        const prospect = await prisma.companyProspect.findUnique({
            where: { id: parseInt(companyId) },
            select: {
                id: true,
                companyName: true,
                websiteUrl: true,
                websiteDomain: true,

                // New canonical fields
                websiteHealthStatus: true,
                websiteHealthScore: true,
                websiteHealthScannedAt: true,
                websiteHealthError: true,
                websiteHealthVersion: true,

                // Legacy fields
                stalenessScore: true,
                lastAnalysedAt: true,
                stalenessConfidence: true,
                scoreReasons: true,
                signals: true,
                webHealthData: true
            }
        });

        if (!prospect) {
            return NextResponse.json({ error: 'Company not found' }, { status: 404 });
        }

        // Get computed display model
        const displayModel = getWebsiteHealthDisplay({
            // New fields
            websiteHealthStatus: prospect.websiteHealthStatus,
            websiteHealthScore: prospect.websiteHealthScore,
            websiteHealthScannedAt: prospect.websiteHealthScannedAt,
            websiteHealthError: prospect.websiteHealthError,
            // Legacy fields
            stalenessScore: prospect.stalenessScore,
            lastAnalysedAt: prospect.lastAnalysedAt,
            stalenessConfidence: prospect.stalenessConfidence,
            scoreReasons: prospect.scoreReasons,
            // Common
            websiteUrl: prospect.websiteUrl
        });

        // Get scan logs
        const logs = scanLogs.get(String(companyId)) || [];

        // Parse webHealthData if exists
        let parsedWebHealthData = null;
        if (prospect.webHealthData) {
            try {
                parsedWebHealthData = JSON.parse(prospect.webHealthData);
            } catch { }
        }

        // Parse signals if exists
        let parsedSignals = null;
        if (prospect.signals) {
            try {
                parsedSignals = JSON.parse(prospect.signals);
            } catch { }
        }

        return NextResponse.json({
            meta: {
                endpoint: '/api/debug/website-health',
                companyId: prospect.id,
                companyName: prospect.companyName,
                timestamp: new Date().toISOString()
            },

            featureFlags: {
                FF_NEW_WEBSITE_HEALTH: FEATURE_FLAGS.USE_NEW_WEBSITE_HEALTH_SCHEMA,
                activeSchema: getActiveSchema(),
                envValue: process.env.FF_NEW_WEBSITE_HEALTH
            },

            rawFields: {
                new: {
                    websiteHealthStatus: prospect.websiteHealthStatus,
                    websiteHealthScore: prospect.websiteHealthScore,
                    websiteHealthScannedAt: prospect.websiteHealthScannedAt,
                    websiteHealthError: prospect.websiteHealthError,
                    websiteHealthVersion: prospect.websiteHealthVersion
                },
                legacy: {
                    stalenessScore: prospect.stalenessScore,
                    lastAnalysedAt: prospect.lastAnalysedAt,
                    stalenessConfidence: prospect.stalenessConfidence,
                    signals: parsedSignals,
                    webHealthData: parsedWebHealthData
                }
            },

            displayDecision: {
                selectedSource: FEATURE_FLAGS.USE_NEW_WEBSITE_HEALTH_SCHEMA ? 'new' : 'legacy',
                selectedStatus: displayModel.status,
                selectedScore: displayModel.score,
                selectedLabel: displayModel.label,
                showScore: displayModel.showScore,
                reason: buildReason(prospect, displayModel)
            },

            computedDisplay: displayModel,

            recentScanLogs: logs
        });

    } catch (error: any) {
        console.error('[DebugWebsiteHealth] Error:', error);
        return NextResponse.json({
            error: 'Failed to fetch debug info',
            details: error.message
        }, { status: 500 });
    }
}

function buildReason(prospect: any, display: any): string {
    const parts: string[] = [];

    if (FEATURE_FLAGS.USE_NEW_WEBSITE_HEALTH_SCHEMA) {
        parts.push('FF_NEW_WEBSITE_HEALTH=true → using new fields');
        parts.push(`websiteHealthStatus=${prospect.websiteHealthStatus ?? 'null'}`);
        parts.push(`websiteHealthScore=${prospect.websiteHealthScore ?? 'null'}`);
    } else {
        parts.push('FF_NEW_WEBSITE_HEALTH=false → using legacy fields');
        parts.push(`lastAnalysedAt=${prospect.lastAnalysedAt ? 'set' : 'null'}`);
        parts.push(`stalenessScore=${prospect.stalenessScore ?? 'null'}`);
    }

    if (display.status !== 'success') {
        parts.push(`status=${display.status} → score hidden`);
    }

    return parts.join('; ');
}
