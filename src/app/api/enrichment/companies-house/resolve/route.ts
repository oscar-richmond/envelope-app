export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { resolveCompany, isCompaniesHouseEnabled } from '@/lib/services/companies-house';

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
    const requestId = `ch_${Date.now()}`;
    const headers = getHeaders(requestId);

    try {
        const body = await request.json();
        const { companyName, postcode, city, companyNumber } = body;

        if (!companyName && !companyNumber) {
            return NextResponse.json({
                success: false,
                error: 'companyName or companyNumber required'
            }, { status: 400, headers });
        }

        if (!isCompaniesHouseEnabled()) {
            return NextResponse.json({
                success: false,
                error: 'Companies House API not configured',
                hint: 'Add COMPANIES_HOUSE_API_KEY to environment'
            }, { status: 503, headers });
        }

        const result = await resolveCompany(companyName, {
            postcode,
            city,
            companyNumber
        });

        return NextResponse.json({
            success: true,
            requestId,
            ...result
        }, { headers });

    } catch (error: any) {
        console.error('[CH Resolve] Error:', error);
        return NextResponse.json({
            success: false,
            error: 'Resolution failed'
        }, { status: 500, headers });
    }
}
