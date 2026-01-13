export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { fetchOfficers, selectDecisionMakers, isCompaniesHouseEnabled } from '@/lib/services/companies-house';
import { detectPattern, generateSuggestions, EmailPattern } from '@/lib/services/email-suggestions';

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
    const requestId = `sug_${Date.now()}`;
    const headers = getHeaders(requestId);

    try {
        const body = await request.json();
        const { companyNumber, domain, foundEmails } = body;

        if (!companyNumber || !domain) {
            return NextResponse.json({
                success: false,
                error: 'companyNumber and domain required'
            }, { status: 400, headers });
        }

        // Check if we have a verified pattern
        const pattern = foundEmails?.length > 0
            ? detectPattern(foundEmails, domain)
            : null;

        if (!pattern || pattern.confidence === 'weak') {
            return NextResponse.json({
                success: true,
                requestId,
                suggestedContacts: [],
                pattern,
                canSuggest: false,
                reason: pattern
                    ? 'Pattern confidence too low (need 2+ verified emails)'
                    : 'No email pattern detected - find emails on site first'
            }, { headers });
        }

        // Fetch officers
        if (!isCompaniesHouseEnabled()) {
            return NextResponse.json({
                success: false,
                error: 'Companies House API not configured'
            }, { status: 503, headers });
        }

        const officersResult = await fetchOfficers(companyNumber);

        if (!officersResult) {
            return NextResponse.json({
                success: true,
                requestId,
                suggestedContacts: [],
                pattern,
                canSuggest: false,
                reason: 'Could not fetch officers from Companies House'
            }, { headers });
        }

        const decisionMakers = selectDecisionMakers(officersResult.officers);

        // Generate suggestions
        const result = generateSuggestions(decisionMakers, pattern, domain);

        return NextResponse.json({
            success: true,
            requestId,
            ...result
        }, { headers });

    } catch (error: any) {
        console.error('[Suggest] Error:', error);
        return NextResponse.json({
            success: false,
            error: 'Suggestion generation failed'
        }, { status: 500, headers });
    }
}
