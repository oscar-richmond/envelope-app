export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { runTestSuite, runSingleCompanyTest } from '@/lib/qa/test-runner';
import { TEST_COMPANIES } from '@/lib/qa/test-fixtures';

const API_BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://envelope-app-sage.vercel.app';

function getHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
    };
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: getHeaders() });
}

// GET /api/admin/qa - Get available tests
export async function GET() {
    return NextResponse.json({
        success: true,
        companies: TEST_COMPANIES.map(c => ({
            id: c.id,
            name: c.name,
            domain: c.domain,
            type: c.type,
            expectations: c.expectations,
        })),
        endpoints: [
            'POST /api/admin/qa - Run all tests',
            'POST /api/admin/qa?company=id - Run single company test',
        ]
    }, { headers: getHeaders() });
}

// POST /api/admin/qa - Run tests
export async function POST(request: Request) {
    const headers = getHeaders();

    try {
        const url = new URL(request.url);
        const companyId = url.searchParams.get('company');

        if (companyId) {
            // Run single company test
            console.log(`[QA] Running tests for: ${companyId}`);
            const results = await runSingleCompanyTest(companyId, API_BASE);

            return NextResponse.json({
                success: true,
                companyId,
                totalTests: results.length,
                passed: results.filter(r => r.passed).length,
                failed: results.filter(r => !r.passed).length,
                results,
            }, { headers });
        }

        // Run full test suite
        console.log('[QA] Running full test suite');
        const suite = await runTestSuite(API_BASE);

        return NextResponse.json({
            success: true,
            ...suite,
        }, { headers });

    } catch (error: any) {
        console.error('[QA] Error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Test suite failed',
        }, { status: 500, headers });
    }
}
