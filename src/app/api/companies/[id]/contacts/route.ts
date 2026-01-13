import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/companies/[id]/contacts
 * 
 * Returns contacts for a company with scan status
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

        console.log(`[Contacts GET] Fetching contacts for company ${companyId}`);

        // Get company prospect with contacts
        const prospect = await prisma.companyProspect.findUnique({
            where: { id: companyId },
            select: {
                id: true,
                companyName: true,
                websiteDomain: true,
                websiteUrl: true,
                contactsLastScannedAt: true,
                enrichmentData: true
            }
        });

        if (!prospect) {
            return NextResponse.json({ error: 'Company not found' }, { status: 404 });
        }

        // Parse enrichment data for contacts
        let contacts: any[] = [];
        let scanStatus = 'idle';

        try {
            if (prospect.enrichmentData) {
                const data = typeof prospect.enrichmentData === 'string'
                    ? JSON.parse(prospect.enrichmentData)
                    : prospect.enrichmentData;

                // Extract contacts from enrichment data
                if (data.bestContacts) contacts.push(...data.bestContacts);
                if (data.moreContacts) contacts.push(...data.moreContacts);
                if (data.genericContacts) contacts.push(...data.genericContacts);

                // Also check for flat contacts array
                if (Array.isArray(data.contacts)) {
                    contacts = data.contacts;
                }
            }
        } catch (e) {
            console.error('[Contacts GET] Error parsing enrichment data:', e);
        }

        // Normalize contact format
        const normalizedContacts = contacts.map((c, idx) => ({
            id: c.id || `contact-${companyId}-${idx}`,
            fullName: c.name || c.fullName || '',
            role: c.role || c.title || '',
            email: c.email || '',
            confidence: c.confidence ?? c.score ?? 0.5,
            source: c.source || 'unknown',
            verified: c.deliverability === 'high' || c.verified === true,
            lastVerifiedAt: c.lastVerifiedAt || null,
            type: c.type || 'personal'
        }));

        console.log(`[Contacts GET] Found ${normalizedContacts.length} contacts for company ${companyId}`);

        return NextResponse.json({
            contacts: normalizedContacts,
            lastScannedAt: prospect.contactsLastScannedAt?.toISOString() || null,
            scanStatus,
            companyId,
            domain: prospect.websiteDomain || prospect.websiteUrl
        });

    } catch (error: any) {
        console.error('[Contacts GET] Error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to fetch contacts'
        }, { status: 500 });
    }
}
