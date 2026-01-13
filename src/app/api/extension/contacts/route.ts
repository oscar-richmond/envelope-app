export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { enhancedEmailExtractor, EnhancedContact } from '@/lib/services/enhanced-email-extractor';

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
        return NextResponse.json({
            ok: true,
            requestId,
            time: new Date().toISOString(),
            version: '2.0',
            providers: ['enhanced-website-extractor']
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
    includeGuessed?: boolean;
}

// Robust domain normalization
function normalizeDomain(input: string): { domain: string; websiteUrl: string } {
    if (!input || typeof input !== 'string') {
        return { domain: '', websiteUrl: '' };
    }

    let url = input.trim().toLowerCase();

    // Add scheme if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`;
    }

    let hostname: string;
    let origin: string;
    try {
        const parsed = new URL(url);
        hostname = parsed.hostname.replace(/^www\./, '');
        origin = parsed.origin;
    } catch (e) {
        hostname = url
            .replace(/^https?:\/\//, '')
            .replace(/^www\./, '')
            .split('/')[0];
        origin = `https://${hostname}`;
    }

    return { domain: hostname, websiteUrl: origin };
}

export async function POST(request: Request) {
    const requestId = generateRequestId();
    const headers = getHeaders(requestId);

    console.log(`[Contacts API] ${requestId} - Request received`);

    try {
        // Parse request body
        let body: ContactsRequest;
        try {
            const text = await request.text();
            if (!text || text.length === 0) {
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

        const { domain: inputDomain, websiteUrl, includeGuessed } = body || {};

        // Get domain from either field
        const rawInput = inputDomain || websiteUrl;

        if (!rawInput) {
            return NextResponse.json({
                success: false,
                requestId,
                errorCode: 'MISSING_DOMAIN',
                message: 'Domain or websiteUrl required'
            }, { status: 400, headers });
        }

        // Normalize domain
        const { domain, websiteUrl: normalizedUrl } = normalizeDomain(rawInput);

        if (!domain) {
            return NextResponse.json({
                success: false,
                requestId,
                errorCode: 'INVALID_DOMAIN',
                message: 'Could not parse domain from input'
            }, { status: 400, headers });
        }

        // Reject LinkedIn/directory URLs
        if (domain.includes('linkedin.com') ||
            domain.includes('facebook.com') ||
            domain.includes('twitter.com')) {
            return NextResponse.json({
                success: false,
                requestId,
                errorCode: 'INVALID_DOMAIN',
                message: 'Please provide the company website, not a social media URL',
                domain
            }, { status: 400, headers });
        }

        console.log(`[Contacts API] ${requestId} - Extracting from: ${normalizedUrl}`);

        // Run enhanced extraction
        const result = await enhancedEmailExtractor.extract(normalizedUrl);

        console.log(`[Contacts API] ${requestId} - Found ${result.contacts.length} contacts`);

        // All contacts sorted by score (from extractor)
        const contactsToReturn = result.contacts;

        // Map to response format with isGeneric
        const contacts = contactsToReturn.map(c => ({
            email: c.email,
            name: c.name || '',
            role: c.role || '',
            type: c.type,
            confidence: c.confidence,
            source: c.source,
            evidence: c.evidence,
            score: c.score,
            isGeneric: c.isGeneric
        }));

        console.log(`[Contacts API] ${requestId} - Returning ${contacts.length} contacts`);

        return NextResponse.json({
            success: true,
            requestId,
            domain,
            contacts,
            meta: {
                domain: result.meta.domain,
                scannedPages: result.meta.scannedPages,
                scannedPdfs: result.meta.scannedPdfs,
                foundTotal: result.meta.foundTotal,
                foundNonGeneric: result.meta.foundNonGeneric,
                foundVerified: result.meta.foundVerified,
                foundGeneric: result.meta.foundGeneric,
                cached: result.meta.cached,
                timeTakenMs: result.meta.timeTakenMs
            }
        }, { headers });

    } catch (error: any) {
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
