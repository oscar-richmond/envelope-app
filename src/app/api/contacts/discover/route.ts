export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { discoverContacts, ContactDiscoveryOptions } from '@/lib/services/contact-discovery-service';

/**
 * Unified Contact Discovery Endpoint
 * Used by both extension and web app
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
    const requestId = `disc_${Date.now()}`;
    const headers = getHeaders(requestId);
    const startTime = Date.now();

    try {
        const body = await request.json();
        const {
            domain,
            companyId,
            maxContacts = 30,
            verifyInferred = 5,
            crawlSite = true,
            useHunter = true,
            usePatternInference = true,
            seedNames = [],
        } = body;

        if (!domain) {
            return NextResponse.json({
                success: false,
                error: 'domain required',
            }, { status: 400, headers });
        }

        console.log(`[ContactsDiscover] ${requestId} - Starting for ${domain}`);

        const options: ContactDiscoveryOptions = {
            maxContacts,
            verifyInferred,
            crawlSite,
            useHunter,
            usePatternInference,
            seedNames,
        };

        const result = await discoverContacts(domain, options);

        // Split contacts into people and generic
        const people = result.contacts.filter(c => c.type === 'person');
        const generic = result.contacts.filter(c => c.type === 'generic');

        console.log(`[ContactsDiscover] ${requestId} - Found ${people.length} people, ${generic.length} generic`);

        return NextResponse.json({
            success: true,
            requestId,
            domain: result.domain,
            pattern: result.pattern,
            people,
            generic,
            allContacts: result.contacts,
            stats: {
                ...result.stats,
                peopleCount: people.length,
                genericCount: generic.length,
                requestDurationMs: Date.now() - startTime,
            },
        }, { headers });

    } catch (error: any) {
        console.error(`[ContactsDiscover] ${requestId} - Error:`, error);
        return NextResponse.json({
            success: false,
            requestId,
            error: 'Discovery failed',
            message: error.message,
        }, { status: 500, headers });
    }
}

// GET endpoint to retrieve cached results (optional)
export async function GET(request: Request) {
    const requestId = `disc_${Date.now()}`;
    const headers = getHeaders(requestId);

    const url = new URL(request.url);
    const domain = url.searchParams.get('domain');

    if (!domain) {
        return NextResponse.json({
            success: false,
            error: 'domain query param required',
        }, { status: 400, headers });
    }

    // For now, run fresh discovery
    // In future, check cache/DB first
    try {
        const result = await discoverContacts(domain, {
            maxContacts: 30,
            crawlSite: true,
            useHunter: true,
        });

        const people = result.contacts.filter(c => c.type === 'person');
        const generic = result.contacts.filter(c => c.type === 'generic');

        return NextResponse.json({
            success: true,
            requestId,
            domain: result.domain,
            pattern: result.pattern,
            people,
            generic,
            stats: result.stats,
        }, { headers });

    } catch (error: any) {
        return NextResponse.json({
            success: false,
            requestId,
            error: error.message,
        }, { status: 500, headers });
    }
}
