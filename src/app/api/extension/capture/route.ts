export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

// CORS headers for extension requests
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Handle preflight requests
export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: corsHeaders });
}

interface ContactPayload {
    name?: string;
    role?: string;
    email?: string | null;
    confidence?: string;
    source?: string;
}

interface CapturePayload {
    type: 'linkedin_person' | 'linkedin_company' | 'website';
    sourceUrl: string;
    data: {
        companyName: string;
        website?: string;
        contactName?: string;
        jobTitle?: string;
        email?: string;
        linkedinUrl?: string;
        companyLinkedIn?: string;
        location?: string;
        industry?: string;
    };
    contacts?: ContactPayload[];
}

// Validate auth - check session OR extension token with DB verification
async function validateAuth(request: Request): Promise<{ email: string | null; userId?: string; error?: string; status?: number }> {
    // First try session auth (most reliable)
    const session = await auth();
    if (session?.user?.email) {
        console.log('[Capture API] Auth via session:', session.user.email);
        return { email: session.user.email, userId: session.user.id };
    }

    // If no session, try extension token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
        return { email: null, error: 'No authorization provided', status: 401 };
    }

    if (!authHeader.startsWith('Bearer ')) {
        return { email: null, error: 'Invalid authorization format', status: 401 };
    }

    const token = authHeader.slice(7);
    try {
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString());

        // Check token expiry
        if (!decoded.exp || decoded.exp <= Date.now()) {
            console.log('[Capture API] Token expired');
            return { email: null, error: 'Session expired - please sign in again', status: 401 };
        }

        if (!decoded.email) {
            return { email: null, error: 'Invalid token format', status: 401 };
        }

        // CRITICAL: Verify user exists in database and is approved
        const user = await prisma.user.findUnique({
            where: { email: decoded.email },
            select: { id: true, email: true, accessStatus: true }
        });

        if (!user) {
            console.log('[Capture API] Token email not found in DB:', decoded.email);
            return { email: null, error: 'User not found - please sign in again', status: 401 };
        }

        if (user.accessStatus !== 'approved') {
            console.log('[Capture API] User not approved:', decoded.email, user.accessStatus);
            return { email: null, error: 'Account pending approval', status: 403 };
        }

        console.log('[Capture API] Auth via token (DB verified):', user.email);
        return { email: user.email!, userId: user.id };
    } catch (e) {
        console.error('[Capture API] Token parse error:', e);
        return { email: null, error: 'Invalid token', status: 401 };
    }
}

export async function POST(request: Request) {
    console.log('[Capture API] Request received');

    try {
        // Validate auth
        const authResult = await validateAuth(request);

        if (!authResult.email) {
            console.log('[Capture API] Auth failed:', authResult.error);
            return NextResponse.json(
                {
                    error: authResult.error || 'Sign in required',
                    code: 'AUTH_REQUIRED'
                },
                { status: authResult.status || 401, headers: corsHeaders }
            );
        }

        console.log('[Capture API] Auth valid for:', authResult.email);

        // Parse body
        let body: CapturePayload;
        try {
            body = await request.json();
        } catch (e) {
            console.log('[Capture API] Invalid JSON body');
            return NextResponse.json(
                { error: 'Invalid request body', code: 'INVALID_BODY' },
                { status: 400, headers: corsHeaders }
            );
        }

        const { type, sourceUrl, data } = body;

        console.log('[Capture API] Payload:', { type, sourceUrl, companyName: data?.companyName });

        // Validation
        if (!data?.companyName || data.companyName.trim().length === 0) {
            console.log('[Capture API] Missing company name');
            return NextResponse.json(
                {
                    error: 'Company name is required',
                    code: 'MISSING_COMPANY_NAME',
                    hint: 'Could not detect company on this page'
                },
                { status: 422, headers: corsHeaders }
            );
        }

        // Extract domain from website
        let domain = '';
        let websiteUrl = data.website || '';

        if (websiteUrl) {
            try {
                const parsed = new URL(websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`);
                domain = parsed.hostname.replace(/^www\./, '');
                websiteUrl = parsed.origin;
            } catch (e) {
                domain = websiteUrl.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
            }
        }

        // Also try to extract domain from LinkedIn URL
        let linkedinCompanyUrl = data.companyLinkedIn || '';
        if (!linkedinCompanyUrl && type === 'linkedin_company' && data.linkedinUrl) {
            linkedinCompanyUrl = data.linkedinUrl;
        }

        console.log('[Capture API] Extracted domain:', domain, 'LinkedIn:', linkedinCompanyUrl);

        // Idempotent upsert - find existing by multiple criteria
        let existingProspect = null;

        // 1. Try LinkedIn URL first (most unique)
        if (linkedinCompanyUrl) {
            existingProspect = await prisma.companyProspect.findFirst({
                where: {
                    OR: [
                        { placesMapsUrl: { contains: 'linkedin.com/company/' } },
                        // Check if any field contains the LinkedIn URL
                    ]
                }
            });
        }

        // 2. Try website domain
        if (!existingProspect && domain) {
            existingProspect = await prisma.companyProspect.findFirst({
                where: {
                    OR: [
                        { websiteUrl: { contains: domain } },
                        { websiteDomain: domain }
                    ]
                }
            });
        }

        // 3. Try exact company name
        if (!existingProspect) {
            existingProspect = await prisma.companyProspect.findFirst({
                where: { companyName: data.companyName.trim() }
            });
        }

        console.log('[Capture API] Existing prospect:', existingProspect?.id || 'none');

        // Create or update company prospect
        let prospect;

        if (existingProspect) {
            // Update existing - only fill in missing fields
            prospect = await prisma.companyProspect.update({
                where: { id: existingProspect.id },
                data: {
                    websiteUrl: existingProspect.websiteUrl || websiteUrl || null,
                    websiteDomain: existingProspect.websiteDomain || domain || null,
                    industry: existingProspect.industry || data.industry || null,
                    registeredLocation: existingProspect.registeredLocation || data.location || null,
                    updatedAt: new Date()
                }
            });
        } else {
            // Create new prospect
            const uniqueId = `EXT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

            prospect = await prisma.companyProspect.create({
                data: {
                    companyName: data.companyName.trim(),
                    companyNumber: uniqueId,
                    websiteBrandName: data.companyName.trim(),
                    websiteUrl: websiteUrl || null,
                    websiteDomain: domain || null,
                    industry: data.industry || null,
                    registeredLocation: data.location || null,
                    source: `extension_${type}`,
                    status: 'ADDED'
                }
            });
        }

        console.log('[Capture API] Prospect ID:', prospect.id);

        // Check for existing lead with same website
        let existingLead = null;
        if (websiteUrl) {
            existingLead = await prisma.lead.findFirst({
                where: { websiteUrl }
            });
        }

        // Create lead if doesn't exist
        let lead;
        if (existingLead) {
            lead = existingLead;
        } else {
            // Generate unique websiteUrl if needed
            const leadWebsiteUrl = websiteUrl ||
                `https://${domain || data.companyName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}.extension-capture`;

            try {
                lead = await prisma.lead.create({
                    data: {
                        companyName: data.companyName.trim(),
                        websiteUrl: leadWebsiteUrl,
                        industry: data.industry || null,
                        location: data.location || null,
                        emailStatus: 'NEW',
                        companyProspectId: prospect.id
                    }
                });
            } catch (e: any) {
                // Handle unique constraint violation
                if (e.code === 'P2002') {
                    lead = await prisma.lead.findFirst({
                        where: { websiteUrl: leadWebsiteUrl }
                    });
                    if (!lead) throw e;
                } else {
                    throw e;
                }
            }
        }

        console.log('[Capture API] Lead ID:', lead?.id);

        // Create contact if person data provided
        let contact = null;
        if (data.contactName && type === 'linkedin_person') {
            const nameParts = data.contactName.trim().split(' ');
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';

            // Check for existing contact by LinkedIn URL or name
            const existingContact = await prisma.contact.findFirst({
                where: {
                    leadId: lead!.id,
                    OR: [
                        { linkedInUrl: data.linkedinUrl },
                        { email: data.email || undefined },
                        {
                            AND: [
                                { firstName },
                                { lastName }
                            ]
                        }
                    ].filter(Boolean)
                }
            });

            if (!existingContact) {
                contact = await prisma.contact.create({
                    data: {
                        firstName,
                        lastName,
                        email: data.email || null,
                        title: data.jobTitle || null,
                        linkedInUrl: data.linkedinUrl || null,
                        leadId: lead!.id,
                        source: type
                    }
                });
            } else {
                // Update existing contact with any new info
                contact = await prisma.contact.update({
                    where: { id: existingContact.id },
                    data: {
                        email: existingContact.email || data.email || null,
                        title: existingContact.title || data.jobTitle || null,
                        linkedInUrl: existingContact.linkedInUrl || data.linkedinUrl || null
                    }
                });
            }
        } else if (data.email) {
            // Check if contact with this email exists
            const existingContact = await prisma.contact.findFirst({
                where: { email: data.email, leadId: lead!.id }
            });

            if (!existingContact) {
                contact = await prisma.contact.create({
                    data: {
                        firstName: '',
                        lastName: '',
                        email: data.email,
                        leadId: lead!.id,
                        source: type
                    }
                });
            }
        }

        // Process contacts array if provided
        const contactIds: number[] = [];
        let createdContactsCount = 0;

        if (body.contacts && body.contacts.length > 0 && lead) {
            console.log('[Capture API] Processing', body.contacts.length, 'contacts');

            for (const c of body.contacts) {
                if (!c.name && !c.email) continue; // Skip empty contacts

                const nameParts = (c.name || '').trim().split(' ');
                const firstName = nameParts[0] || '';
                const lastName = nameParts.slice(1).join(' ') || '';

                // Check for existing contact by email or name
                let existingContact = null;
                if (c.email) {
                    existingContact = await prisma.contact.findFirst({
                        where: { email: c.email, leadId: lead.id }
                    });
                }
                if (!existingContact && firstName) {
                    existingContact = await prisma.contact.findFirst({
                        where: {
                            leadId: lead.id,
                            firstName,
                            lastName
                        }
                    });
                }

                if (existingContact) {
                    // Update existing
                    const updated = await prisma.contact.update({
                        where: { id: existingContact.id },
                        data: {
                            email: existingContact.email || c.email || null,
                            title: existingContact.title || c.role || null,
                            source: existingContact.source || c.source || type
                        }
                    });
                    contactIds.push(updated.id);
                } else {
                    // Create new
                    const created = await prisma.contact.create({
                        data: {
                            firstName,
                            lastName,
                            email: c.email || null,
                            title: c.role || null,
                            leadId: lead.id,
                            source: c.source || type,
                            confidence: c.confidence === 'verified' ? 90 :
                                c.confidence === 'likely' ? 60 : 30
                        }
                    });
                    contactIds.push(created.id);
                    createdContactsCount++;
                }
            }
        }

        console.log('[Capture API] Success - Lead:', lead?.id, 'Prospect:', prospect.id, 'Contacts:', contactIds.length);

        return NextResponse.json({
            success: true,
            leadId: lead?.id,
            prospectId: prospect.id,
            contactId: contact?.id,
            contactIds,
            createdContactsCount,
            isNew: !existingProspect,
            isDuplicate: !!existingProspect || !!existingLead,
            message: existingProspect
                ? `${data.companyName} already saved`
                : `Added ${data.companyName}`
        }, { headers: corsHeaders });

    } catch (error: any) {
        console.error('[Capture API] Error:', error);

        // Provide specific error info
        let errorMessage = 'Server error - please try again';
        let errorCode = 'SERVER_ERROR';

        if (error.code === 'P2002') {
            errorMessage = 'This company already exists';
            errorCode = 'DUPLICATE';
        } else if (error.code === 'P2003') {
            errorMessage = 'Database constraint error';
            errorCode = 'DB_CONSTRAINT';
        }

        return NextResponse.json(
            {
                error: errorMessage,
                code: errorCode,
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            },
            { status: 500, headers: corsHeaders }
        );
    }
}
