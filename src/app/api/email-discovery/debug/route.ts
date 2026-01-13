export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

/**
 * Email Discovery Debug Endpoint
 * Shows counts at each stage for diagnostics
 */

export async function GET(request: Request) {
    const url = new URL(request.url);
    const domain = url.searchParams.get('domain');

    if (!domain) {
        return NextResponse.json({
            success: false,
            error: 'domain query param required'
        }, { status: 400 });
    }

    const requestId = `debug_${Date.now()}`;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://envelope-app-sage.vercel.app';

    console.log(`[Debug] Running diagnostics for ${domain}`);

    const stages: any = {
        domain,
        requestId,
        timestamp: new Date().toISOString(),
    };

    try {
        // Call v3 discovery
        const startTime = Date.now();
        const res = await fetch(`${baseUrl}/api/email-discovery/v3`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain }),
        });

        const discoveryResult = await res.json();
        stages.discoveryDurationMs = Date.now() - startTime;

        if (!discoveryResult.success) {
            stages.error = discoveryResult.error;
            return NextResponse.json(stages);
        }

        // Extract counts
        stages.raw = {
            bestContacts: discoveryResult.bestContacts?.length || 0,
            emails: discoveryResult.emails?.length || 0,
            patterns: discoveryResult.patterns?.length || 0,
        };

        stages.stats = discoveryResult.stats || {};
        stages.meta = discoveryResult.meta || {};

        // Check for Hunter data
        stages.hunter = {
            resultsCount: discoveryResult.stats?.hunterResultsCount || 0,
            pagesScanned: discoveryResult.stats?.hunterPagesScanned || 0,
            pattern: discoveryResult.meta?.hunterPattern || null,
        };

        // Dedupe check
        stages.deduped = {
            uniqueEmails: discoveryResult.emails?.length || 0,
        };

        // Verification check
        const verified = discoveryResult.emails?.filter((e: any) =>
            e.verification?.status === 'valid' ||
            e.verificationStatus === 'verified'
        ) || [];

        stages.verification = {
            verified: verified.length,
            pending: (discoveryResult.emails?.length || 0) - verified.length,
        };

        // Sample data
        stages.samples = {
            firstBestContact: discoveryResult.bestContacts?.[0] || null,
            firstEmail: discoveryResult.emails?.[0] || null,
        };

        // Warnings
        stages.warnings = discoveryResult.warnings || [];

        return NextResponse.json({
            success: true,
            ...stages,
        });

    } catch (error: any) {
        console.error('[Debug] Error:', error);
        return NextResponse.json({
            success: false,
            ...stages,
            error: error.message,
        }, { status: 500 });
    }
}
