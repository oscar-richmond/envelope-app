/**
 * Web Health Forensics Snapshot
 * 
 * Returns complete state of website health for a company
 * including DB state and how each API surface would serialize it
 */

import { NextResponse } from 'next/server';
import { getWebsiteHealthCanonical } from '@/lib/websiteHealth/canonicalRead';
import { FEATURE_FLAGS } from '@/lib/featureFlags';

export async function GET(request: Request) {
    // Guard: Dev only
    if (process.env.NODE_ENV === 'production' && process.env.DEBUG_HEALTH !== '1') {
        return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
        return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    try {
        // Get canonical DB state
        const db = await getWebsiteHealthCanonical(parseInt(companyId));

        // Simulate how each surface serializes this data
        const apiSurfaces = {
            search: simulateSearchSerializer(db),
            leadBoard: simulateLeadBoardSerializer(db),
            companyOverview: simulateCompanyOverviewSerializer(db),
            websiteReport: simulateWebsiteReportSerializer(db)
        };

        // Feature flag state
        const featureFlags = {
            FF_NEW_WEBSITE_HEALTH: FEATURE_FLAGS.USE_NEW_WEBSITE_HEALTH_SCHEMA,
            NEXT_PUBLIC_DEBUG_HEALTH: process.env.NEXT_PUBLIC_DEBUG_HEALTH
        };

        return NextResponse.json({
            db,
            apiSurfaces,
            featureFlags,
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        return NextResponse.json({
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
}

// Simulate how Search endpoint would serialize
function simulateSearchSerializer(db: any) {
    const useNew = FEATURE_FLAGS.USE_NEW_WEBSITE_HEALTH_SCHEMA;

    return {
        source: useNew ? 'new' : 'legacy',
        output: {
            websiteHealthStatus: useNew ? db.new.websiteHealthStatus : null,
            websiteHealthScore: useNew
                ? (db.new.websiteHealthStatus === 'success' ? db.new.websiteHealthScore : null)
                : db.legacy.stalenessScore,
            websiteHealthLabel: useNew ? db.new.websiteHealthLabel : null,
            websiteHealthScannedAt: useNew ? db.new.websiteHealthScannedAt : db.legacy.lastAnalysedAt,
            // Legacy fallback for comparison
            legacyStalenessScore: db.legacy.stalenessScore,
            legacyLastAnalysedAt: db.legacy.lastAnalysedAt
        }
    };
}

// Simulate how Lead Board endpoint would serialize
function simulateLeadBoardSerializer(db: any) {
    const useNew = FEATURE_FLAGS.USE_NEW_WEBSITE_HEALTH_SCHEMA;

    // Lead Board uses signals.webHealth which should read from canonical
    const signalsWebHealth = {
        score: db.new.websiteHealthStatus === 'success'
            ? db.new.websiteHealthScore
            : null,
        label: db.new.websiteHealthStatus === 'success'
            ? db.new.websiteHealthLabel
            : (db.new.websiteHealthStatus === 'scanning' ? 'Scanning...' : 'Not Scanned'),
        updatedAt: db.new.websiteHealthScannedAt
    };

    return {
        source: useNew ? 'new (via signals.webHealth)' : 'legacy',
        output: {
            websiteHealthStatus: db.new.websiteHealthStatus,
            websiteHealthScore: db.new.websiteHealthScore,
            websiteHealthLabel: db.new.websiteHealthLabel,
            websiteHealthScannedAt: db.new.websiteHealthScannedAt,
            // Signals object
            signalsWebHealth,
            // Legacy for comparison
            legacyStalenessScore: db.legacy.stalenessScore,
            legacyLastAnalysedAt: db.legacy.lastAnalysedAt
        }
    };
}

// Simulate Company Overview
function simulateCompanyOverviewSerializer(db: any) {
    const useNew = FEATURE_FLAGS.USE_NEW_WEBSITE_HEALTH_SCHEMA;

    return {
        source: useNew ? 'new' : 'legacy',
        output: {
            websiteHealthStatus: useNew ? db.new.websiteHealthStatus : null,
            websiteHealthScore: useNew
                ? (db.new.websiteHealthStatus === 'success' ? db.new.websiteHealthScore : null)
                : db.legacy.stalenessScore,
            websiteHealthLabel: useNew ? db.new.websiteHealthLabel : null,
            report: db.storedReport.parsed
        }
    };
}

// Simulate Website Report
function simulateWebsiteReportSerializer(db: any) {
    return {
        source: 'stored report (webHealthData)',
        output: {
            score: db.storedReport.parsed?.score ?? null,
            label: db.storedReport.parsed?.statusLabel ?? null,
            factors: db.storedReport.parsed?.factors ?? [],
            baseScore: db.storedReport.parsed?.baseScore ?? null,
            // Also include canonical for comparison
            canonicalScore: db.new.websiteHealthScore,
            canonicalLabel: db.new.websiteHealthLabel
        }
    };
}
