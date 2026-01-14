import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

/**
 * POST /api/companies/[id]/contacts/rescan
 * 
 * Triggers a contact discovery rescan for a company.
 * This fetches contacts from Hunter, website scraping, etc.
 */
export async function POST(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const companyId = parseInt(id);
        if (isNaN(companyId)) {
            return NextResponse.json({ error: 'Invalid company ID' }, { status: 400 });
        }

        // Auth check
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log(`[Contacts Rescan] Starting rescan for company ${companyId}`);

        // Get company for domain
        const company = await prisma.companyProspect.findUnique({
            where: { id: companyId },
            select: {
                id: true,
                websiteDomain: true,
                websiteUrl: true,
                enrichmentData: true
            }
        });

        if (!company) {
            return NextResponse.json({ error: 'Company not found' }, { status: 404 });
        }

        const domain = company.websiteDomain ||
            company.websiteUrl?.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];

        if (!domain) {
            return NextResponse.json({
                error: 'No domain available for contact discovery',
                needsDomain: true
            }, { status: 400 });
        }

        console.log(`[Contacts Rescan] Scanning domain: ${domain}`);

        // Try Hunter API if available
        let hunterContacts: any[] = [];
        try {
            const hunterKey = process.env.HUNTER_API_KEY;
            if (hunterKey) {
                const hunterRes = await fetch(
                    `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${hunterKey}&limit=50`
                );

                if (hunterRes.ok) {
                    const hunterData = await hunterRes.json();
                    hunterContacts = (hunterData.data?.emails || []).map((e: any) => ({
                        email: e.value,
                        firstName: e.first_name || '',
                        lastName: e.last_name || '',
                        fullName: e.first_name && e.last_name ? `${e.first_name} ${e.last_name}` : '',
                        role: e.position || e.department || '',
                        roleTitle: e.position || e.department || '',
                        confidence: (e.confidence || 50) / 100,
                        source: 'hunter',
                        type: e.type === 'generic' ? 'generic' : 'personal'
                    }));
                    console.log(`[Contacts Rescan] Hunter found ${hunterContacts.length} contacts`);
                }
            }
        } catch (e) {
            console.error('[Contacts Rescan] Hunter API error:', e);
        }

        // Merge with existing enrichmentData
        let existingData: any = {};
        try {
            if (company.enrichmentData) {
                existingData = typeof company.enrichmentData === 'string'
                    ? JSON.parse(company.enrichmentData)
                    : company.enrichmentData;
            }
        } catch (e) {
            existingData = {};
        }

        // Dedupe: add new contacts that don't exist
        const existingEmails = new Set<string>();
        const allExisting = [
            ...(existingData.contacts || []),
            ...(existingData.bestContacts || []),
            ...(existingData.moreContacts || [])
        ];
        allExisting.forEach((c: any) => {
            if (c.email) existingEmails.add(c.email.toLowerCase());
        });

        const newContacts = hunterContacts.filter(c =>
            c.email && !existingEmails.has(c.email.toLowerCase())
        );

        // Update enrichmentData with merged contacts
        const updatedEnrichment = {
            ...existingData,
            contacts: [...allExisting, ...newContacts],
            lastContactScanAt: new Date().toISOString()
        };

        await prisma.companyProspect.update({
            where: { id: companyId },
            data: {
                enrichmentData: JSON.stringify(updatedEnrichment),
                contactsLastScannedAt: new Date()
            }
        });

        console.log(`[Contacts Rescan] Added ${newContacts.length} new contacts for company ${companyId}`);

        return NextResponse.json({
            success: true,
            newContactsCount: newContacts.length,
            totalContacts: allExisting.length + newContacts.length,
            scannedAt: new Date().toISOString()
        });

    } catch (error: any) {
        console.error('[Contacts Rescan] Error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to rescan contacts'
        }, { status: 500 });
    }
}
