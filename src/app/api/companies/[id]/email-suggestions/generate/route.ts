import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { generateEmailFromPattern, patternRequiresLastName, PatternKey } from '@/lib/services/email-pattern';

/**
 * POST /api/companies/[id]/email-suggestions/generate
 * 
 * Generate suggested emails for name-only contacts
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

        console.log(`[EmailSuggestions] Generating suggestions for company ${companyId}...`);

        // Get prospect
        const prospect = await prisma.companyProspect.findUnique({
            where: { id: companyId },
            select: {
                id: true,
                emailPattern: true,
                manualContacts: true,
                enrichmentData: true
            }
        });

        if (!prospect) {
            return NextResponse.json({ error: 'Company not found' }, { status: 404 });
        }

        // Check for pattern
        let pattern: any = null;
        try {
            if (prospect.emailPattern) {
                pattern = typeof prospect.emailPattern === 'string'
                    ? JSON.parse(prospect.emailPattern)
                    : prospect.emailPattern;
            }
        } catch (e) {
            // Ignore
        }

        if (!pattern || !pattern.domain || !pattern.patternKey) {
            return NextResponse.json({
                error: 'No email pattern found. Add a manual contact first to learn the pattern.',
                noPattern: true
            }, { status: 400 });
        }

        console.log(`[EmailSuggestions] Using pattern: ${pattern.patternKey}@${pattern.domain}`);

        // Collect name-only contacts
        const nameOnlyContacts: any[] = [];
        const existingEmails = new Set<string>();

        // Parse manual contacts (to get existing emails)
        try {
            if (prospect.manualContacts) {
                const data = typeof prospect.manualContacts === 'string'
                    ? JSON.parse(prospect.manualContacts)
                    : prospect.manualContacts;
                if (Array.isArray(data)) {
                    for (const c of data) {
                        if (c.email) {
                            existingEmails.add(c.email.toLowerCase());
                        }
                    }
                }
            }
        } catch (e) { }

        // Parse scanned contacts (find name-only)
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
                    if (c.email) {
                        existingEmails.add(c.email.toLowerCase());
                        continue; // Skip if already has email
                    }

                    const firstName = c.firstName || (c.fullName || c.name || '').split(' ')[0];
                    if (firstName) {
                        nameOnlyContacts.push({
                            id: c.id,
                            firstName,
                            lastName: c.lastName || (c.fullName || c.name || '').split(' ').slice(1).join(' '),
                            fullName: c.fullName || c.name,
                            role: c.role
                        });
                    }
                }
            }
        } catch (e) {
            console.error('[EmailSuggestions] Error parsing contacts:', e);
        }

        console.log(`[EmailSuggestions] Found ${nameOnlyContacts.length} name-only contacts`);

        // Generate suggestions
        const suggestions: any[] = [];

        for (const contact of nameOnlyContacts) {
            const firstName = contact.firstName || '';
            const lastName = contact.lastName || '';

            if (!firstName) continue;

            // Calculate name completeness
            const nameFactor = lastName ? 1.0 : 0.7;

            // Check if pattern works with available data
            let patternKey = pattern.patternKey as PatternKey;
            let confidence = pattern.confidence * nameFactor;

            if (patternRequiresLastName(patternKey) && !lastName) {
                // Fall back to first-only pattern
                patternKey = 'first';
                confidence *= 0.6; // Lower confidence for fallback
            }

            // Generate email
            const suggestedEmail = generateEmailFromPattern(
                firstName,
                lastName,
                pattern.domain,
                patternKey
            );

            if (suggestedEmail && !existingEmails.has(suggestedEmail.toLowerCase())) {
                suggestions.push({
                    contactId: contact.id,
                    firstName,
                    lastName,
                    fullName: contact.fullName || `${firstName} ${lastName}`.trim(),
                    role: contact.role,
                    suggestedEmail,
                    confidence,
                    patternKey,
                    status: 'suggested'
                });
            }
        }

        console.log(`[EmailSuggestions] Generated ${suggestions.length} suggestions`);

        // Store suggestions in enrichment data
        try {
            const data = prospect.enrichmentData
                ? (typeof prospect.enrichmentData === 'string'
                    ? JSON.parse(prospect.enrichmentData)
                    : prospect.enrichmentData)
                : {};

            data.emailSuggestions = suggestions;
            data.suggestionsGeneratedAt = new Date().toISOString();

            await prisma.companyProspect.update({
                where: { id: companyId },
                data: {
                    enrichmentData: JSON.stringify(data)
                }
            });
        } catch (e) {
            console.error('[EmailSuggestions] Error saving suggestions:', e);
        }

        return NextResponse.json({
            success: true,
            domain: pattern.domain,
            patternKey: pattern.patternKey,
            patternConfidence: pattern.confidence,
            suggestions,
            count: suggestions.length
        });

    } catch (error: any) {
        console.error('[EmailSuggestions] Error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to generate email suggestions'
        }, { status: 500 });
    }
}

/**
 * GET /api/companies/[id]/email-suggestions
 * 
 * Get existing suggestions
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
                enrichmentData: true,
                emailPattern: true
            }
        });

        if (!prospect) {
            return NextResponse.json({ error: 'Company not found' }, { status: 404 });
        }

        // Parse suggestions
        let suggestions: any[] = [];
        let pattern = null;

        try {
            if (prospect.enrichmentData) {
                const data = typeof prospect.enrichmentData === 'string'
                    ? JSON.parse(prospect.enrichmentData)
                    : prospect.enrichmentData;
                suggestions = data.emailSuggestions || [];
            }
        } catch (e) { }

        try {
            if (prospect.emailPattern) {
                pattern = typeof prospect.emailPattern === 'string'
                    ? JSON.parse(prospect.emailPattern)
                    : prospect.emailPattern;
            }
        } catch (e) { }

        return NextResponse.json({
            hasPattern: !!pattern,
            pattern,
            suggestions,
            count: suggestions.length
        });

    } catch (error: any) {
        console.error('[EmailSuggestions] GET error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to get email suggestions'
        }, { status: 500 });
    }
}
