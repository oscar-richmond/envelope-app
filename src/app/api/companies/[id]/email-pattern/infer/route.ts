import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { inferEmailPattern, generateSuggestedEmails, PatternKey } from '@/lib/services/email-pattern';

/**
 * POST /api/companies/[id]/email-pattern/infer
 * 
 * Infer email pattern from manual/verified contacts
 */
export async function POST(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const companyId = parseInt(params.id);
        if (isNaN(companyId)) {
            return NextResponse.json({ error: 'Invalid company ID' }, { status: 400 });
        }

        console.log(`[EmailPattern] Inferring pattern for company ${companyId}...`);

        // Get prospect with all contacts
        const prospect = await prisma.companyProspect.findUnique({
            where: { id: companyId },
            select: {
                id: true,
                websiteDomain: true,
                websiteUrl: true,
                manualContacts: true,
                enrichmentData: true,
                emailPattern: true
            }
        });

        if (!prospect) {
            return NextResponse.json({ error: 'Company not found' }, { status: 404 });
        }

        // Get domain
        let preferredDomain = prospect.websiteDomain || '';
        if (!preferredDomain && prospect.websiteUrl) {
            preferredDomain = prospect.websiteUrl
                .replace(/^https?:\/\//, '')
                .replace(/^www\./, '')
                .split('/')[0];
        }

        // Collect all contacts
        const allContacts: any[] = [];

        // Parse manual contacts
        try {
            if (prospect.manualContacts) {
                const data = typeof prospect.manualContacts === 'string'
                    ? JSON.parse(prospect.manualContacts)
                    : prospect.manualContacts;
                if (Array.isArray(data)) {
                    for (const c of data) {
                        allContacts.push({
                            email: c.email,
                            firstName: c.firstName,
                            lastName: c.lastName,
                            fullName: c.fullName,
                            source: 'manual',
                            verified: c.verified,
                            confidence: c.confidence ?? 1.0
                        });
                    }
                }
            }
        } catch (e) {
            console.error('[EmailPattern] Error parsing manual contacts:', e);
        }

        // Parse scanned contacts
        try {
            if (prospect.enrichmentData) {
                const data = typeof prospect.enrichmentData === 'string'
                    ? JSON.parse(prospect.enrichmentData)
                    : prospect.enrichmentData;

                const scanned = [
                    ...(data.contacts || []),
                    ...(data.bestContacts || []),
                    ...(data.moreContacts || []),
                    ...(data.genericContacts || [])
                ];

                for (const c of scanned) {
                    allContacts.push({
                        email: c.email,
                        firstName: c.firstName,
                        lastName: c.lastName,
                        fullName: c.name || c.fullName,
                        source: c.source,
                        verified: c.deliverability === 'high' || c.verified,
                        confidence: c.confidence ?? 0.5
                    });
                }
            }
        } catch (e) {
            console.error('[EmailPattern] Error parsing scanned contacts:', e);
        }

        console.log(`[EmailPattern] Found ${allContacts.length} contacts for pattern inference`);

        // Run inference
        const result = inferEmailPattern(allContacts, preferredDomain);

        console.log(`[EmailPattern] Inference result:`, {
            success: result.success,
            domain: result.domain,
            primaryPattern: result.primaryPattern?.patternKey,
            confidence: result.primaryPattern?.confidence,
            evidenceCount: result.evidenceCount
        });

        // Save pattern to database
        if (result.success && result.primaryPattern) {
            const patternData = {
                domain: result.domain,
                patternKey: result.primaryPattern.patternKey,
                confidence: result.primaryPattern.confidence,
                evidenceCount: result.evidenceCount,
                evidenceEmails: result.primaryPattern.evidenceEmails,
                inferredAt: new Date().toISOString()
            };

            await prisma.companyProspect.update({
                where: { id: companyId },
                data: {
                    emailPattern: JSON.stringify(patternData),
                    websiteDomain: result.domain || undefined
                }
            });

            console.log(`[EmailPattern] Saved pattern for company ${companyId}: ${result.primaryPattern.patternKey}@${result.domain}`);
        }

        return NextResponse.json({
            success: result.success,
            domain: result.domain,
            primaryPattern: result.primaryPattern ? {
                patternKey: result.primaryPattern.patternKey,
                confidence: result.primaryPattern.confidence,
                evidenceCount: result.primaryPattern.evidenceCount
            } : null,
            allPatterns: result.patterns.map(p => ({
                patternKey: p.patternKey,
                confidence: p.confidence,
                evidenceCount: p.evidenceCount,
                isPrimary: p.isPrimary
            })),
            evidenceCount: result.evidenceCount
        });

    } catch (error: any) {
        console.error('[EmailPattern] Error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to infer email pattern'
        }, { status: 500 });
    }
}

/**
 * GET /api/companies/[id]/email-pattern
 * 
 * Get current email pattern
 */
export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const companyId = parseInt(params.id);
        if (isNaN(companyId)) {
            return NextResponse.json({ error: 'Invalid company ID' }, { status: 400 });
        }

        const prospect = await prisma.companyProspect.findUnique({
            where: { id: companyId },
            select: {
                emailPattern: true,
                websiteDomain: true
            }
        });

        if (!prospect) {
            return NextResponse.json({ error: 'Company not found' }, { status: 404 });
        }

        // Parse pattern
        let pattern = null;
        try {
            if (prospect.emailPattern) {
                pattern = typeof prospect.emailPattern === 'string'
                    ? JSON.parse(prospect.emailPattern)
                    : prospect.emailPattern;
            }
        } catch (e) {
            // Ignore
        }

        return NextResponse.json({
            hasPattern: !!pattern,
            pattern,
            domain: prospect.websiteDomain
        });

    } catch (error: any) {
        console.error('[EmailPattern] GET error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to get email pattern'
        }, { status: 500 });
    }
}
