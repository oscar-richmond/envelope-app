import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * POST /api/companies/[id]/contacts/bulk
 * 
 * Bulk import contacts for a company (used by extension)
 * Dedupes by email, merges role data if better
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

        const body = await request.json();
        const { contacts: inputContacts } = body;

        if (!Array.isArray(inputContacts) || inputContacts.length === 0) {
            return NextResponse.json({ error: 'contacts array required' }, { status: 400 });
        }

        console.log(`[Contacts Bulk] Importing ${inputContacts.length} contacts for company ${companyId}`);

        // Get existing company data
        const prospect = await prisma.companyProspect.findUnique({
            where: { id: companyId },
            select: {
                id: true,
                manualContacts: true,
                enrichmentData: true
            }
        });

        if (!prospect) {
            return NextResponse.json({ error: 'Company not found' }, { status: 404 });
        }

        // Parse existing scanned contacts
        let existingScanned: any[] = [];
        try {
            if (prospect.enrichmentData) {
                const data = typeof prospect.enrichmentData === 'string'
                    ? JSON.parse(prospect.enrichmentData)
                    : prospect.enrichmentData;

                if (Array.isArray(data.contacts)) {
                    existingScanned = data.contacts;
                } else {
                    existingScanned = [
                        ...(data.bestContacts || []),
                        ...(data.moreContacts || []),
                        ...(data.genericContacts || [])
                    ];
                }
            }
        } catch (e) {
            console.error('[Contacts Bulk] Error parsing enrichmentData:', e);
        }

        // Parse existing manual contacts
        let existingManual: any[] = [];
        try {
            if (prospect.manualContacts) {
                const data = typeof prospect.manualContacts === 'string'
                    ? JSON.parse(prospect.manualContacts)
                    : prospect.manualContacts;
                if (Array.isArray(data)) {
                    existingManual = data;
                }
            }
        } catch (e) {
            console.error('[Contacts Bulk] Error parsing manualContacts:', e);
        }

        // Build set of existing email lowers
        const existingEmailSet = new Set<string>();
        [...existingScanned, ...existingManual].forEach(c => {
            if (c.email) {
                existingEmailSet.add(c.email.toLowerCase().trim());
            }
        });

        // Process new contacts
        const newContacts: any[] = [];
        let imported = 0;
        let duplicates = 0;
        let merged = 0;

        for (const c of inputContacts) {
            if (!c.email?.trim()) continue;

            const emailLower = c.email.toLowerCase().trim();

            // Check for duplicate
            if (existingEmailSet.has(emailLower)) {
                // Try to merge if we have better role data
                const existingIdx = existingScanned.findIndex(
                    ec => (ec.email || '').toLowerCase().trim() === emailLower
                );

                if (existingIdx >= 0 && c.roleTitle && !existingScanned[existingIdx].role) {
                    // Merge role into existing
                    existingScanned[existingIdx].role = c.roleTitle;
                    existingScanned[existingIdx].roleTitle = c.roleTitle;
                    merged++;
                } else {
                    duplicates++;
                }
                continue;
            }

            // Add new contact
            existingEmailSet.add(emailLower);
            newContacts.push({
                id: `import-${companyId}-${Date.now()}-${imported}`,
                firstName: c.firstName?.trim() || '',
                lastName: c.lastName?.trim() || '',
                fullName: c.fullName?.trim() || `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email.split('@')[0],
                name: c.fullName?.trim() || `${c.firstName || ''} ${c.lastName || ''}`.trim(),
                roleTitle: c.roleTitle?.trim() || '',
                role: c.roleTitle?.trim() || '',
                email: c.email.trim(),
                emailLower,
                source: c.source || 'extension',
                confidence: typeof c.confidence === 'number' ? c.confidence : 0.7,
                type: c.type || 'personal',
                verified: false,
                createdAt: new Date().toISOString()
            });
            imported++;
        }

        // Combine and update enrichment data
        const updatedContacts = [...existingScanned, ...newContacts];
        const enrichmentData = prospect.enrichmentData
            ? (typeof prospect.enrichmentData === 'string'
                ? JSON.parse(prospect.enrichmentData)
                : prospect.enrichmentData)
            : {};

        enrichmentData.contacts = updatedContacts;

        // Save to database
        await prisma.companyProspect.update({
            where: { id: companyId },
            data: {
                enrichmentData: JSON.stringify(enrichmentData),
                contactsLastScannedAt: new Date()
            }
        });

        console.log(`[Contacts Bulk] Complete: ${imported} imported, ${duplicates} duplicates, ${merged} merged`);

        return NextResponse.json({
            success: true,
            imported,
            duplicates,
            merged,
            total: updatedContacts.length + existingManual.length,
            companyId
        }, { status: 201 });

    } catch (error: any) {
        console.error('[Contacts Bulk] Error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to import contacts'
        }, { status: 500 });
    }
}
