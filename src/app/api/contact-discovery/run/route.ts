export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { verifyEmail, getConfiguredProvider } from '@/lib/services/email-verification';

/**
 * Unified Contact Discovery API
 * Single endpoint for both extension and web app
 */

// In-memory cache for discovery results (use DB in production)
const discoveryCache = new Map<string, {
    domain: string;
    contacts: any[];
    bestContacts: any[];
    verificationResults: Map<string, any>;
    patterns: any[];
    meta: any;
    discoveredAt: string;
    expiresAt: number;
}>();

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function getHeaders(requestId: string) {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
        'X-Request-Id': requestId,
    };
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: getHeaders('opt') });
}

// GET - Retrieve cached discovery results
export async function GET(request: Request) {
    const requestId = `disc_${Date.now()}`;
    const headers = getHeaders(requestId);

    const url = new URL(request.url);
    const domain = url.searchParams.get('domain');

    if (!domain) {
        return NextResponse.json({
            success: false,
            error: 'domain required'
        }, { status: 400, headers });
    }

    const cached = discoveryCache.get(domain.toLowerCase());

    if (!cached || Date.now() > cached.expiresAt) {
        return NextResponse.json({
            success: true,
            requestId,
            found: false,
            message: 'No cached results. Run discovery first.',
        }, { headers });
    }

    return NextResponse.json({
        success: true,
        requestId,
        found: true,
        domain: cached.domain,
        bestContacts: cached.bestContacts,
        contacts: cached.contacts,
        patterns: cached.patterns,
        meta: cached.meta,
        verificationResults: Object.fromEntries(cached.verificationResults),
        discoveredAt: cached.discoveredAt,
    }, { headers });
}

// POST - Run discovery
export async function POST(request: Request) {
    const requestId = `disc_${Date.now()}`;
    const headers = getHeaders(requestId);

    try {
        const body = await request.json();
        const {
            domain,
            seedUrl,
            source = 'web',
            forceRefresh = false,
            verifyCount = 8
        } = body;

        if (!domain) {
            return NextResponse.json({
                success: false,
                error: 'domain required'
            }, { status: 400, headers });
        }

        const domainKey = domain.toLowerCase();

        // Check cache if not forcing refresh
        if (!forceRefresh) {
            const cached = discoveryCache.get(domainKey);
            if (cached && Date.now() < cached.expiresAt) {
                console.log(`[Discovery] Cache hit for ${domain}`);
                return NextResponse.json({
                    success: true,
                    requestId,
                    cached: true,
                    domain: cached.domain,
                    bestContacts: cached.bestContacts,
                    contacts: cached.contacts,
                    patterns: cached.patterns,
                    meta: cached.meta,
                    verificationResults: Object.fromEntries(cached.verificationResults),
                    discoveredAt: cached.discoveredAt,
                }, { headers });
            }
        }

        console.log(`[Discovery] Running discovery for ${domain} (source: ${source})`);

        // Call email-discovery v3
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://envelope-app-sage.vercel.app';
        const discoveryRes = await fetch(`${baseUrl}/api/email-discovery/v3`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain, seedUrl }),
        });

        const discoveryData = await discoveryRes.json();

        if (!discoveryData.success) {
            return NextResponse.json({
                success: false,
                requestId,
                error: discoveryData.error || 'Discovery failed',
            }, { status: 500, headers });
        }

        const contacts = discoveryData.emails || [];
        const bestContacts = discoveryData.bestContacts || contacts.slice(0, 3);
        const patterns = discoveryData.patterns || [];
        const meta = {
            totalFound: discoveryData.meta?.totalFound || contacts.length,
            totalReturned: contacts.length,
            stats: discoveryData.stats,
            provider: getConfiguredProvider(),
        };

        // Verify top contacts
        const verificationResults = new Map<string, any>();
        const toVerify = contacts.slice(0, Math.min(verifyCount, contacts.length));
        let verifiedCount = 0;
        let verifyErrors = 0;

        for (const contact of toVerify) {
            if (!contact.email) continue;
            try {
                const result = await verifyEmail(contact.email);
                verificationResults.set(contact.email, result);
                if (result.status === 'valid') verifiedCount++;
            } catch (err) {
                verifyErrors++;
            }
        }

        meta.verificationAttempted = toVerify.length;
        meta.verifiedCount = verifiedCount;
        meta.verifyErrors = verifyErrors;

        // Cache results
        discoveryCache.set(domainKey, {
            domain,
            contacts,
            bestContacts,
            verificationResults,
            patterns,
            meta,
            discoveredAt: new Date().toISOString(),
            expiresAt: Date.now() + CACHE_TTL_MS,
        });

        console.log(`[Discovery] Completed for ${domain}: ${contacts.length} contacts, ${verifiedCount} verified`);

        return NextResponse.json({
            success: true,
            requestId,
            cached: false,
            domain,
            bestContacts,
            contacts,
            patterns,
            meta,
            verificationResults: Object.fromEntries(verificationResults),
            discoveredAt: new Date().toISOString(),
        }, { headers });

    } catch (error: any) {
        console.error('[Discovery] Error:', error);
        return NextResponse.json({
            success: false,
            requestId,
            error: 'Discovery failed',
            message: error.message,
        }, { status: 500, headers });
    }
}
