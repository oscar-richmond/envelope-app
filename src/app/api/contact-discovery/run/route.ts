export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { discoverContactsV3, ContactDiscoveryV3Options } from '@/lib/services/contact-discovery-v3';

/**
 * Contact Discovery v3 API - Unified endpoint for extension and web app
 * People-first: Recommended → Other People → Department → Generic
 */

function getHeaders(requestId: string) {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json',
        'X-Request-Id': requestId,
    };
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: getHeaders('opt') });
}

export async function POST(request: Request) {
    const requestId = `cdv3_${Date.now()}`;
    const headers = getHeaders(requestId);
    const startTime = Date.now();

    try {
        const body = await request.json();
        const {
            domain,
            companyId,
            companyNumber,
            companyName,
            maxPeople = 30,
            verifyTopN = 10,
            includeWebsiteCrawl = true,
            includeCompaniesHouse = true,
        } = body;

        if (!domain) {
            return NextResponse.json({
                success: false,
                error: 'domain required',
            }, { status: 400, headers });
        }

        console.log(`[ContactDiscoveryV3] ${requestId} - Starting for ${domain}`);

        const options: ContactDiscoveryV3Options = {
            maxPeople,
            verifyTopN,
            includeWebsiteCrawl,
            includeCompaniesHouse,
            companyNumber,
            companyName,
        };

        const result = await discoverContactsV3(domain, options);

        // Build legacy-compatible response
        const allContacts = [
            ...result.recommendedRecipients.map(r => ({
                ...r.email,
                name: r.person.fullName,
                role: r.person.roleTitle,
                priorityScore: r.priorityScore,
                reason: r.reason,
                isRecommended: true,
            })),
            ...result.otherPeople.map(p => ({
                ...p.email,
                name: p.person.fullName,
                role: p.person.roleTitle,
                isRecommended: false,
            })),
            ...result.departmentEmails.map(e => ({
                ...e,
                name: null,
                role: null,
                isRecommended: false,
            })),
        ];

        console.log(`[ContactDiscoveryV3] ${requestId} - Complete: ${result.recommendedRecipients.length} recommended`);

        return NextResponse.json({
            success: true,
            requestId,
            domain: result.domain,

            // v3 structured output
            recommendedRecipients: result.recommendedRecipients,
            otherPeople: result.otherPeople,
            departmentEmails: result.departmentEmails,
            genericEmails: result.genericEmails,

            // Legacy compatibility
            bestContacts: allContacts.slice(0, 10),
            emails: allContacts,

            pattern: result.pattern,
            stats: {
                ...result.stats,
                recommendedCount: result.recommendedRecipients.length,
                totalPeople: result.recommendedRecipients.length + result.otherPeople.length,
                totalEmails: allContacts.length + result.genericEmails.length,
                requestDurationMs: Date.now() - startTime,
            },
        }, { headers });

    } catch (error: any) {
        console.error(`[ContactDiscoveryV3] ${requestId} - Error:`, error);
        return NextResponse.json({
            success: false,
            requestId,
            error: 'Discovery failed',
            message: error.message,
        }, { status: 500, headers });
    }
}

// GET for simple domain lookup
export async function GET(request: Request) {
    const requestId = `cdv3_${Date.now()}`;
    const headers = getHeaders(requestId);

    const url = new URL(request.url);
    const domain = url.searchParams.get('domain');

    if (!domain) {
        return NextResponse.json({
            success: false,
            error: 'domain query param required',
        }, { status: 400, headers });
    }

    try {
        const result = await discoverContactsV3(domain);

        return NextResponse.json({
            success: true,
            requestId,
            ...result,
        }, { headers });

    } catch (error: any) {
        return NextResponse.json({
            success: false,
            requestId,
            error: error.message,
        }, { status: 500, headers });
    }
}
