export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { fetchOfficers, selectDecisionMakers, isCompaniesHouseEnabled } from '@/lib/services/companies-house';

function getHeaders(requestId: string) {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
        'X-Request-Id': requestId,
    };
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: getHeaders('opt') });
}

export async function POST(request: Request) {
    const requestId = `off_${Date.now()}`;
    const headers = getHeaders(requestId);

    try {
        const body = await request.json();
        const { companyNumber } = body;

        if (!companyNumber) {
            return NextResponse.json({
                success: false,
                error: 'companyNumber required'
            }, { status: 400, headers });
        }

        if (!isCompaniesHouseEnabled()) {
            return NextResponse.json({
                success: false,
                error: 'Companies House API not configured'
            }, { status: 503, headers });
        }

        const result = await fetchOfficers(companyNumber);

        if (!result) {
            return NextResponse.json({
                success: false,
                error: 'Could not fetch officers'
            }, { status: 404, headers });
        }

        const decisionMakers = selectDecisionMakers(result.officers);

        return NextResponse.json({
            success: true,
            requestId,
            companyNumber: result.companyNumber,
            companyName: result.companyName,
            officers: result.officers,
            decisionMakers,
            totalOfficers: result.totalResults,
            fetchedAt: result.fetchedAt
        }, { headers });

    } catch (error: any) {
        console.error('[CH Officers] Error:', error);
        return NextResponse.json({
            success: false,
            error: 'Officers fetch failed'
        }, { status: 500, headers });
    }
}
