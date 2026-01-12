export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { contactDiscoveryProvider } from '@/lib/providers';

// Generate unique request ID
function generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Standard headers for all responses
function getHeaders(requestId: string) {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json; charset=utf-8',
        'X-Request-Id': requestId,
    };
}

// Handle CORS preflight
export async function OPTIONS() {
    const requestId = generateRequestId();
    return new NextResponse(null, { status: 204, headers: getHeaders(requestId) });
}

// Health check endpoint
export async function GET() {
    const requestId = generateRequestId();
    const headers = getHeaders(requestId);

    try {
        // Check if provider is configured
        const hunterKey = process.env.HUNTER_API_KEY;

        return NextResponse.json({
            ok: true,
            requestId,
            time: new Date().toISOString(),
            providerConfigured: !!hunterKey,
            providers: ['website-scrape', hunterKey ? 'hunter' : null].filter(Boolean)
        }, { headers });
    } catch (error: any) {
        console.error(`[Contacts Health] ${requestId} - Error:`, error);
        return NextResponse.json({
            ok: false,
            requestId,
            time: new Date().toISOString(),
            error: error.message
        }, { status: 500, headers });
    }
}

interface ContactsRequest {
    domain?: string;
    websiteUrl?: string;
    companyName?: string;
}

interface ContactResponse {
    name: string;
    role: string;
    email: string | undefined;
    confidence: 'verified' | 'likely' | 'unknown';
    source: string;
}

// Robust domain normalization
function normalizeDomain(input: string): { domain: string; apexDomain: string } {
    if (!input || typeof input !== 'string') {
        return { domain: '', apexDomain: '' };
    }

    let url = input.trim().toLowerCase();

    // Add scheme if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`;
    }

    let hostname: string;
    try {
        const parsed = new URL(url);
        hostname = parsed.hostname;
    } catch (e) {
        // Fallback: extract domain-like string
        hostname = url
            .replace(/^https?:\/\//, '')
            .split('/')[0]
            .split('?')[0]
            .split('#')[0];
    }

    // Remove www
    hostname = hostname.replace(/^www\./, '');

    // Compute apex domain (for subdomains)
    const parts = hostname.split('.');
    let apexDomain = hostname;

    if (parts.length > 2) {
        const lastTwo = parts.slice(-2).join('.');
        const commonSecondLevel = ['co.uk', 'com.au', 'co.nz', 'com.br', 'co.jp'];

        if (commonSecondLevel.includes(lastTwo)) {
            apexDomain = parts.slice(-3).join('.');
        } else {
            apexDomain = parts.slice(-2).join('.');
        }
    }

    return { domain: hostname, apexDomain };
}

// Generate heuristic emails for a domain
function generateHeuristicEmails(domain: string): ContactResponse[] {
    const commonPrefixes = ['info', 'hello', 'contact', 'enquiries', 'sales', 'support'];

    return commonPrefixes.map(prefix => ({
        name: prefix.charAt(0).toUpperCase() + prefix.slice(1),
        role: prefix === 'info' ? 'General' :
            prefix === 'sales' ? 'Sales' :
                prefix === 'support' ? 'Support' : 'General',
        email: `${prefix}@${domain}`,
        confidence: 'unknown' as const,
        source: 'heuristic'
    }));
}

export async function POST(request: Request) {
    const requestId = generateRequestId();
    const headers = getHeaders(requestId);

    console.log(`[Contacts API] ${requestId} - Request received`);

    // Wrap EVERYTHING in try-catch to guarantee JSON response
    try {
        // Parse request body
        let body: ContactsRequest;
        try {
            const text = await request.text();
            if (!text || text.length === 0) {
                console.log(`[Contacts API] ${requestId} - Empty request body`);
                return NextResponse.json({
                    success: false,
                    requestId,
                    errorCode: 'INVALID_BODY',
                    message: 'Request body is empty'
                }, { status: 400, headers });
            }
            body = JSON.parse(text);
        } catch (e: any) {
            console.log(`[Contacts API] ${requestId} - Invalid JSON body:`, e.message);
            return NextResponse.json({
                success: false,
                requestId,
                errorCode: 'INVALID_BODY',
                message: 'Invalid JSON in request body'
            }, { status: 400, headers });
        }

        const { domain: inputDomain, websiteUrl } = body || {};

        // Get domain from either field
        const rawDomain = inputDomain || websiteUrl;

        if (!rawDomain) {
            console.log(`[Contacts API] ${requestId} - No domain provided`);
            return NextResponse.json({
                success: false,
                requestId,
                errorCode: 'MISSING_DOMAIN',
                message: 'Domain or websiteUrl required'
            }, { status: 400, headers });
        }

        // Normalize domain
        const { domain: cleanDomain, apexDomain } = normalizeDomain(rawDomain);

        if (!cleanDomain) {
            console.log(`[Contacts API] ${requestId} - Invalid domain: ${rawDomain}`);
            return NextResponse.json({
                success: false,
                requestId,
                errorCode: 'INVALID_DOMAIN',
                message: 'Could not parse domain from input'
            }, { status: 400, headers });
        }

        // Reject LinkedIn/directory URLs
        if (cleanDomain.includes('linkedin.com') ||
            cleanDomain.includes('facebook.com') ||
            cleanDomain.includes('twitter.com')) {
            console.log(`[Contacts API] ${requestId} - Rejected directory URL: ${cleanDomain}`);
            return NextResponse.json({
                success: false,
                requestId,
                errorCode: 'INVALID_DOMAIN',
                message: 'Please provide the company website, not a social media URL',
                domain: cleanDomain
            }, { status: 400, headers });
        }

        console.log(`[Contacts API] ${requestId} - Domain: ${cleanDomain}, Apex: ${apexDomain}`);

        // Track what we tried
        const meta = {
            providersAttempted: [] as string[],
            providerResults: {} as Record<string, number>,
            heuristicUsed: false,
            cached: false
        };

        let contacts: ContactResponse[] = [];
        let providerError: string | null = null;

        // Try apex domain first (often more results)
        const domainsToTry = apexDomain !== cleanDomain
            ? [apexDomain, cleanDomain]
            : [cleanDomain];

        for (const domainToTry of domainsToTry) {
            if (contacts.length > 0) break;

            console.log(`[Contacts API] ${requestId} - Trying domain: ${domainToTry}`);
            meta.providersAttempted.push(`orchestrator(${domainToTry})`);

            try {
                // Call provider with timeout
                const timeoutMs = 15000;
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

                try {
                    const results = await Promise.race([
                        contactDiscoveryProvider.find(domainToTry),
                        new Promise<never>((_, reject) =>
                            setTimeout(() => reject(new Error('Provider timeout')), timeoutMs)
                        )
                    ]);

                    clearTimeout(timeoutId);

                    // Ensure results is an array
                    const safeResults = Array.isArray(results) ? results : [];

                    console.log(`[Contacts API] ${requestId} - Orchestrator returned: ${safeResults.length} contacts`);
                    meta.providerResults[domainToTry] = safeResults.length;

                    if (safeResults.length > 0) {
                        contacts = safeResults.map(c => ({
                            name: [c?.firstName, c?.lastName].filter(Boolean).join(' ') ||
                                (c?.email ? c.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Unknown'),
                            role: c?.title || '',
                            email: c?.email || undefined,
                            confidence: (c?.verificationStatus as 'verified' | 'likely' | 'unknown') || 'unknown',
                            source: c?.source || 'unknown'
                        }));
                    }
                } catch (timeoutErr: any) {
                    clearTimeout(timeoutId);
                    throw timeoutErr;
                }
            } catch (err: any) {
                console.error(`[Contacts API] ${requestId} - Provider error for ${domainToTry}:`, err.message);
                providerError = err.message || 'Provider error';
                meta.providerResults[domainToTry] = 0;

                if (err.message?.includes('rate') || err.message?.includes('429')) {
                    return NextResponse.json({
                        success: false,
                        requestId,
                        errorCode: 'RATE_LIMIT',
                        message: 'Contact lookup temporarily limited. Try again later.',
                        domain: cleanDomain,
                        meta
                    }, { status: 429, headers });
                }

                if (err.message?.includes('timeout') || err.message?.includes('Timeout')) {
                    return NextResponse.json({
                        success: false,
                        requestId,
                        errorCode: 'TIMEOUT',
                        message: 'Contact lookup timed out. Try again.',
                        domain: cleanDomain,
                        meta
                    }, { status: 504, headers });
                }
            }
        }

        // If no results, add heuristic emails
        if (contacts.length === 0) {
            console.log(`[Contacts API] ${requestId} - No contacts found, adding heuristic emails`);
            meta.heuristicUsed = true;
            contacts = generateHeuristicEmails(apexDomain);
        }

        console.log(`[Contacts API] ${requestId} - Returning ${contacts.length} contacts`);

        return NextResponse.json({
            success: true,
            requestId,
            domain: cleanDomain,
            apexDomain,
            provider: meta.heuristicUsed ? 'heuristic' : 'orchestrator',
            contacts,
            meta: {
                counts: {
                    contacts: contacts.length,
                    emails: contacts.filter(c => c.email).length
                },
                ...meta
            }
        }, { headers });

    } catch (error: any) {
        // This catches ANY error including import errors
        console.error(`[Contacts API] ${requestId} - Unexpected error:`, error);
        console.error(`[Contacts API] ${requestId} - Stack:`, error.stack);

        return NextResponse.json({
            success: false,
            requestId,
            errorCode: 'SERVER_ERROR',
            message: 'An unexpected error occurred. Please try again.',
            details: process.env.NODE_ENV === 'development' ? { error: error.message } : undefined
        }, { status: 500, headers });
    }
}
