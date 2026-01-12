export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

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
}

export async function POST(request: Request) {
    try {
        // Validate auth - check session
        const session = await auth();

        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body: CapturePayload = await request.json();
        const { type, sourceUrl, data } = body;

        // Validation
        if (!data.companyName) {
            return NextResponse.json({ error: 'Company name required' }, { status: 400 });
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

        // Check for existing company by website domain
        let existingProspect = null;

        if (domain) {
            existingProspect = await prisma.companyProspect.findFirst({
                where: {
                    OR: [
                        { websiteUrl: { contains: domain } },
                        { websiteDomain: domain }
                    ]
                }
            });
        }

        // If no match by domain, try by exact company name
        if (!existingProspect) {
            existingProspect = await prisma.companyProspect.findFirst({
                where: { companyName: data.companyName }
            });
        }

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
                    registeredLocation: existingProspect.registeredLocation || data.location || null
                }
            });
        } else {
            // Create new prospect
            // Generate a unique company number for extension captures
            const uniqueId = `EXT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

            prospect = await prisma.companyProspect.create({
                data: {
                    companyName: data.companyName,
                    companyNumber: uniqueId,
                    websiteBrandName: data.companyName,
                    websiteUrl: websiteUrl || null,
                    websiteDomain: domain || null,
                    industry: data.industry || null,
                    registeredLocation: data.location || null,
                    source: `extension_${type}`,
                    status: 'ADDED'
                }
            });
        }

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
            const leadWebsiteUrl = websiteUrl || `https://${domain || data.companyName.toLowerCase().replace(/\s+/g, '-')}.extension-capture`;

            lead = await prisma.lead.create({
                data: {
                    companyName: data.companyName,
                    websiteUrl: leadWebsiteUrl,
                    industry: data.industry || null,
                    location: data.location || null,
                    emailStatus: 'NEW',
                    companyProspectId: prospect.id
                }
            });
        }

        // Create contact if person data provided
        let contact = null;
        if (data.contactName && type === 'linkedin_person') {
            const nameParts = data.contactName.split(' ');
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';

            // Check for existing contact
            const existingContact = await prisma.contact.findFirst({
                where: {
                    leadId: lead.id,
                    OR: [
                        { email: data.email || undefined },
                        {
                            AND: [
                                { firstName },
                                { lastName }
                            ]
                        }
                    ]
                }
            });

            if (!existingContact) {
                contact = await prisma.contact.create({
                    data: {
                        firstName,
                        lastName,
                        email: data.email || null,
                        jobTitle: data.jobTitle || null,
                        linkedInUrl: data.linkedinUrl || null,
                        leadId: lead.id,
                        source: type
                    }
                });
            } else {
                contact = existingContact;
            }
        } else if (data.email) {
            // Check if contact with this email exists
            const existingContact = await prisma.contact.findFirst({
                where: { email: data.email, leadId: lead.id }
            });

            if (!existingContact) {
                contact = await prisma.contact.create({
                    data: {
                        firstName: '',
                        lastName: '',
                        email: data.email,
                        leadId: lead.id,
                        source: type
                    }
                });
            }
        }

        return NextResponse.json({
            success: true,
            leadId: lead.id,
            prospectId: prospect.id,
            contactId: contact?.id,
            isNew: !existingProspect,
            isDuplicateLead: !!existingLead,
            message: existingLead
                ? `${data.companyName} already exists`
                : `Added ${data.companyName}`
        });

    } catch (error: any) {
        console.error('[Extension Capture Error]', error);
        return NextResponse.json(
            { error: 'Capture failed', details: error.message },
            { status: 500 }
        );
    }
}
