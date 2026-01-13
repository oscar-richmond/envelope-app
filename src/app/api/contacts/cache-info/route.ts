export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getCacheInfo, getCachedDomain, planRescan } from '@/lib/services/domain-cache';

/**
 * Cache Info Endpoint
 * Returns cache status and rescan cost for a domain
 */

function getHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
    };
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: getHeaders() });
}

export async function GET(request: Request) {
    const headers = getHeaders();
    const url = new URL(request.url);
    const domain = url.searchParams.get('domain');

    if (!domain) {
        return NextResponse.json({
            success: false,
            error: 'domain query param required',
        }, { status: 400, headers });
    }

    const info = getCacheInfo(domain);

    // Get rescan plan if cached
    let rescanPlan = null;
    const entry = getCachedDomain(domain);
    if (entry) {
        rescanPlan = planRescan(entry);
    }

    return NextResponse.json({
        success: true,
        ...info,
        rescanPlan,
    }, { headers });
}
