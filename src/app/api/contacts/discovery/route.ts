export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { contactDiscoveryProvider } from '@/lib/providers';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const { prospectId, leadId } = await request.json();

        // Support both prospectId and leadId for backwards compatibility
        let companyProspect;
        let lead;

        if (prospectId) {
            companyProspect = await prisma.companyProspect.findUnique({
                where: { id: prospectId }
            });
            if (!companyProspect) {
                return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });
            }
        } else if (leadId) {
            lead = await prisma.lead.findUnique({
                where: { id: leadId },
                include: { companyProspect: true }
            });
            if (!lead) {
                return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
            }
            companyProspect = lead.companyProspect;
        } else {
            return NextResponse.json({ error: 'prospectId or leadId required' }, { status: 400 });
        }

        // Get domain from website URL
        let domain = '';
        if (companyProspect?.websiteUrl) {
            try {
                domain = new URL(companyProspect.websiteUrl).hostname;
            } catch (e) {
                domain = companyProspect.websiteUrl;
            }
        } else if (companyProspect?.websiteDomain) {
            domain = companyProspect.websiteDomain;
        }

        if (!domain) {
            return NextResponse.json({ error: 'No website domain found' }, { status: 400 });
        }

        console.log(`[ContactDiscovery] Starting discovery for domain: ${domain}`);

        // Run discovery orchestrator
        const results = await contactDiscoveryProvider.find(domain);

        console.log(`[ContactDiscovery] Found ${results.length} contacts`);

        // Save to ProspectEmail (deduping by email)
        const savedEmails = [];
        for (const contact of results) {
            if (!contact.email) continue;

            // Check if exists
            const existing = await prisma.prospectEmail.findFirst({
                where: {
                    companyProspectId: companyProspect!.id,
                    email: contact.email
                }
            });

            if (existing) {
                // Update if new source has better verification
                const statusOrder = { 'verified': 0, 'likely': 1, 'unknown': 2 };
                const existingStatus = (existing.confidence === 'HIGH' ? 'verified' :
                    existing.confidence === 'MEDIUM' ? 'likely' : 'unknown');

                if (statusOrder[contact.verificationStatus] < statusOrder[existingStatus]) {
                    const updated = await prisma.prospectEmail.update({
                        where: { id: existing.id },
                        data: {
                            confidence: contact.verificationStatus === 'verified' ? 'HIGH' :
                                contact.verificationStatus === 'likely' ? 'MEDIUM' : 'LOW',
                            name: contact.firstName && contact.lastName
                                ? `${contact.firstName} ${contact.lastName}`.trim()
                                : existing.name,
                            roleTitle: contact.title || existing.roleTitle,
                            roleSource: contact.source
                        }
                    });
                    savedEmails.push(updated);
                } else {
                    savedEmails.push(existing);
                }
            } else {
                // Create new
                const created = await prisma.prospectEmail.create({
                    data: {
                        companyProspectId: companyProspect!.id,
                        email: contact.email,
                        type: contact.roleCategory === 'DECISION_MAKER' ? 'PERSONAL' :
                            contact.roleCategory === 'MARKETING' ? 'SALES' : 'GENERAL',
                        confidence: contact.verificationStatus === 'verified' ? 'HIGH' :
                            contact.verificationStatus === 'likely' ? 'MEDIUM' : 'LOW',
                        name: contact.firstName && contact.lastName
                            ? `${contact.firstName} ${contact.lastName}`.trim()
                            : null,
                        roleTitle: contact.title || null,
                        roleSource: contact.source,
                        roleConfidence: contact.verificationStatus === 'verified' ? 'HIGH' :
                            contact.verificationStatus === 'likely' ? 'MEDIUM' : 'LOW'
                    }
                });
                savedEmails.push(created);
            }
        }

        // Also create Contact records for leads (backwards compatibility)
        if (lead) {
            for (const contact of results) {
                if (!contact.email) continue;

                const existing = await prisma.contact.findFirst({
                    where: { leadId: lead.id, email: contact.email }
                });

                if (!existing) {
                    await prisma.contact.create({
                        data: {
                            leadId: lead.id,
                            firstName: contact.firstName || null,
                            lastName: contact.lastName || null,
                            title: contact.title || null,
                            email: contact.email,
                            confidence: contact.confidence,
                            roleCategory: contact.roleCategory,
                            source: contact.source
                        }
                    });
                }
            }
        }

        return NextResponse.json({
            success: true,
            count: savedEmails.length,
            emails: savedEmails.map(e => ({
                id: e.id,
                email: e.email,
                name: e.name,
                roleTitle: e.roleTitle,
                confidence: e.confidence,
                source: e.roleSource
            }))
        });

    } catch (error) {
        console.error("[ContactDiscovery] Failed:", error);
        return NextResponse.json({ error: 'Discovery failed' }, { status: 500 });
    }
}
