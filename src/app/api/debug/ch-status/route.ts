import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    const apiKey = process.env.COMPANIES_HOUSE_API_KEY;

    // Check 1: Key Existence
    const keyStatus = apiKey ? `Present (Length: ${apiKey.length})` : 'MISSING';

    // Check 2: Connectivity
    let apiStatus = 'Untested';
    let apiData = null;
    let apiError = null;

    if (apiKey) {
        try {
            const auth = Buffer.from(apiKey + ':').toString('base64');
            const res = await fetch('https://api.companieshouse.gov.uk/search/companies?q=tesla&items_per_page=1', {
                headers: { 'Authorization': `Basic ${auth}` }
            });
            apiStatus = `HTTP ${res.status} ${res.statusText}`;
            if (res.ok) {
                const json = await res.json();
                apiData = {
                    total_results: json.total_results,
                    first_item: json.items?.[0]?.title
                };
            } else {
                apiData = await res.text();
            }
        } catch (e: any) {
            apiStatus = 'FAILED';
            apiError = e.toString();
        }
    }

    return NextResponse.json({
        env: {
            NODE_ENV: process.env.NODE_ENV,
            KEY_STATUS: keyStatus,
        },
        api_test: {
            status: apiStatus,
            data: apiData,
            error: apiError
        }
    }, { status: 200 });
}
