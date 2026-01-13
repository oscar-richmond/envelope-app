export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { enrichDirectorsWithEmails, DirectorEnrichmentOptions } from '@/lib/services/director-enrichment';
import { resolveCompany } from '@/lib/services/companies-house';

/**
 * Director Email Enrichment Endpoint
 * Fetches directors from Companies House and generates/verifies emails
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
    const requestId = `dir_${Date.now()}`;
    const headers = getHeaders(requestId);

    try {
        const body = await request.json();
        const {
            companyNumber,
            companyName,
            domain,
            pattern,
            verifyCount = 3,
            inferPattern = true,
            useHunter = true,
        } = body;

        if (!domain) {
            return NextResponse.json({
                success: false,
                error: 'domain required',
            }, { status: 400, headers });
        }

        // Resolve company number if not provided
        let resolvedCompanyNumber = companyNumber;
        let resolvedCompanyName = companyName;

        if (!resolvedCompanyNumber && companyName) {
            const resolved = await resolveCompany(companyName);
            if (resolved.status === 'matched' && resolved.companyNumber) {
                resolvedCompanyNumber = resolved.companyNumber;
                resolvedCompanyName = resolved.companyName || companyName;
            } else {
                return NextResponse.json({
                    success: false,
                    error: 'Could not resolve company number',
                    resolved,
                }, { status: 400, headers });
            }
        }

        if (!resolvedCompanyNumber) {
            return NextResponse.json({
                success: false,
                error: 'companyNumber or companyName required',
            }, { status: 400, headers });
        }

        console.log(`[EnrichDirectors] ${requestId} - ${resolvedCompanyNumber}, domain: ${domain}`);

        const options: DirectorEnrichmentOptions = {
            verifyCount,
            inferPattern,
            useHunter,
        };

        const result = await enrichDirectorsWithEmails(resolvedCompanyNumber, domain, options);

        if (!result) {
            return NextResponse.json({
                success: false,
                error: 'Director enrichment failed',
            }, { status: 500, headers });
        }

        // Split directors by email status
        const verified = result.directors.filter(d => d.emailStatus === 'verified');
        const inferred = result.directors.filter(d => d.emailStatus === 'inferred' || d.emailStatus === 'risky');
        const noEmail = result.directors.filter(d => d.emailStatus === 'none' || d.emailStatus === 'invalid');

        return NextResponse.json({
            success: true,
            requestId,
            ...result,
            verified,
            inferred,
            noEmail,
        }, { headers });

    } catch (error: any) {
        console.error(`[EnrichDirectors] ${requestId} - Error:`, error);
        return NextResponse.json({
            success: false,
            requestId,
            error: 'Enrichment failed',
            message: error.message,
        }, { status: 500, headers });
    }
}
