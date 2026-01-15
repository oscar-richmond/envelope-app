import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { resolveCompanyIdentityOrError } from '@/lib/resolveCompanyIdentity';

/**
 * GET /api/companies/[id]/contacts
 * 
 * Returns contacts for a company with scan status
 */
export async function GET(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;

        // Use resolver for flexible company identification
        const resolved = await resolveCompanyIdentityOrError({
            companyId: !isNaN(parseInt(id)) ? parseInt(id) : undefined,
            companiesHouseNumber: isNaN(parseInt(id)) ? id : undefined
        });

        if (!resolved.success) {
            console.warn(`[Contacts GET] Company resolution failed for: ${id}`);
            return NextResponse.json({
                error: resolved.error,
                errorCode: resolved.errorCode,
                hint: resolved.hint
            }, { status: 400 });
        }

        const companyId = resolved.companyId;
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
                enrichmentData: true,
                manualContacts: true
            }
        });

        if (!prospect) {
            return NextResponse.json({
                error: 'Company not found',
                errorCode: 'COMPANY_NOT_FOUND'
            }, { status: 404 });
        }

        // Parse enrichment data for scanned contacts
        let scannedContacts: any[] = [];
        // Compute status: never_scanned | success | stale
        let scanStatus: 'never_scanned' | 'success' | 'stale' | 'failed' = 'never_scanned';

        if (prospect.contactsLastScannedAt) {
            const daysSinceScan = (Date.now() - new Date(prospect.contactsLastScannedAt).getTime()) / (1000 * 60 * 60 * 24);
            scanStatus = daysSinceScan > 30 ? 'stale' : 'success';
        }

        try {
            if (prospect.enrichmentData) {
                const data = typeof prospect.enrichmentData === 'string'
                    ? JSON.parse(prospect.enrichmentData)
                    : prospect.enrichmentData;

                // Extract contacts from enrichment data
                if (data.bestContacts) scannedContacts.push(...data.bestContacts);
                if (data.moreContacts) scannedContacts.push(...data.moreContacts);
                if (data.genericContacts) scannedContacts.push(...data.genericContacts);

                // Also check for flat contacts array
                if (Array.isArray(data.contacts)) {
                    scannedContacts = data.contacts;
                }
            }
        } catch (e) {
            console.error('[Contacts GET] Error parsing enrichment data:', e);
        }

        // Parse manual contacts
        let manualContacts: any[] = [];
        try {
            if (prospect.manualContacts) {
                const data = typeof prospect.manualContacts === 'string'
                    ? JSON.parse(prospect.manualContacts)
                    : prospect.manualContacts;
                if (Array.isArray(data)) {
                    manualContacts = data;
                }
            }
        } catch (e) {
            console.error('[Contacts GET] Error parsing manual contacts:', e);
        }

        // Merge and deduplicate by email (manual takes priority)
        const seenEmails = new Set<string>();
        const allContacts: any[] = [];

        // Add manual contacts first (priority)
        for (const c of manualContacts) {
            const emailLower = (c.email || '').toLowerCase().trim();
            if (emailLower && !seenEmails.has(emailLower)) {
                seenEmails.add(emailLower);
                allContacts.push({
                    id: c.id || `manual-${companyId}-${emailLower}`,
                    fullName: c.fullName || `${c.firstName || ''} ${c.lastName || ''}`.trim(),
                    firstName: c.firstName || '',
                    lastName: c.lastName || '',
                    role: c.roleTitle || c.role || 'Unknown role',
                    roleTitle: c.roleTitle || c.role || 'Unknown role',
                    email: c.email,
                    confidence: c.confidence ?? 1.0,
                    source: 'manual',
                    verified: c.verified ?? false,
                    lastVerifiedAt: c.verifiedAt || null,
                    type: 'personal',
                    isManual: true,
                    createdAt: c.createdAt
                });
            }
        }

        // Add scanned contacts (skip duplicates)
        for (const c of scannedContacts) {
            const emailLower = (c.email || '').toLowerCase().trim();
            if (emailLower && !seenEmails.has(emailLower)) {
                seenEmails.add(emailLower);
                allContacts.push({
                    id: c.id || `contact-${companyId}-${emailLower}`,
                    fullName: c.name || c.fullName || '',
                    role: c.role || c.roleTitle || c.title || 'Unknown role',
                    roleTitle: c.role || c.roleTitle || c.title || 'Unknown role',
                    email: c.email || '',
                    confidence: c.confidence ?? c.score ?? 0.5,
                    source: c.source || 'unknown',
                    verified: c.deliverability === 'high' || c.verified === true,
                    lastVerifiedAt: c.lastVerifiedAt || null,
                    type: c.type || 'personal',
                    isManual: false
                });
            }
        }

        // Sort: verified first, then by confidence, then manual
        allContacts.sort((a, b) => {
            if (a.verified !== b.verified) return b.verified ? 1 : -1;
            if (a.isManual !== b.isManual) return a.isManual ? -1 : 1;
            return (b.confidence || 0) - (a.confidence || 0);
        });

        console.log(`[Contacts GET] Found ${allContacts.length} contacts for company ${companyId} (${manualContacts.length} manual, ${scannedContacts.length} scanned)`);

        return NextResponse.json({
            contacts: allContacts,
            lastScannedAt: prospect.contactsLastScannedAt?.toISOString() || null,
            scanStatus,
            companyId,
            domain: prospect.websiteDomain || prospect.websiteUrl,
            manualCount: manualContacts.length,
            scannedCount: scannedContacts.length
        });

    } catch (error: any) {
        console.error('[Contacts GET] Error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to fetch contacts'
        }, { status: 500 });
    }
}

/**
 * POST /api/companies/[id]/contacts
 * 
 * Create a manual contact
 */
export async function POST(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;

        // Use resolver for flexible company identification
        const resolved = await resolveCompanyIdentityOrError({
            companyId: !isNaN(parseInt(id)) ? parseInt(id) : undefined,
            companiesHouseNumber: isNaN(parseInt(id)) ? id : undefined
        });

        if (!resolved.success) {
            console.warn(`[Contacts POST] Company resolution failed for: ${id}`);
            return NextResponse.json({
                error: resolved.error,
                errorCode: resolved.errorCode,
                hint: resolved.hint
            }, { status: 400 });
        }

        const companyId = resolved.companyId;

        const body = await request.json();
        const { firstName, lastName, roleTitle, email } = body;

        // Validate required fields
        if (!firstName?.trim()) {
            return NextResponse.json({ error: 'First name is required' }, { status: 400 });
        }
        if (!lastName?.trim()) {
            return NextResponse.json({ error: 'Last name is required' }, { status: 400 });
        }
        if (!email?.trim()) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
        }

        const emailLower = email.trim().toLowerCase();

        console.log(`[Contacts POST] Creating manual contact for company ${companyId}: ${emailLower}`);

        // Get prospect
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

        // Parse existing manual contacts
        let manualContacts: any[] = [];
        try {
            if (prospect.manualContacts) {
                const data = typeof prospect.manualContacts === 'string'
                    ? JSON.parse(prospect.manualContacts)
                    : prospect.manualContacts;
                if (Array.isArray(data)) {
                    manualContacts = data;
                }
            }
        } catch (e) {
            console.error('[Contacts POST] Error parsing manual contacts:', e);
        }

        // Check for duplicate
        const existingManual = manualContacts.find(c =>
            (c.email || '').toLowerCase().trim() === emailLower
        );
        if (existingManual) {
            return NextResponse.json({
                error: 'This email is already saved for this company',
                existingContactId: existingManual.id,
                duplicate: true
            }, { status: 409 });
        }

        // Also check scanned contacts
        try {
            if (prospect.enrichmentData) {
                const data = typeof prospect.enrichmentData === 'string'
                    ? JSON.parse(prospect.enrichmentData)
                    : prospect.enrichmentData;

                const allScanned = [
                    ...(data.contacts || []),
                    ...(data.bestContacts || []),
                    ...(data.moreContacts || []),
                    ...(data.genericContacts || [])
                ];

                const existingScanned = allScanned.find(c =>
                    (c.email || '').toLowerCase().trim() === emailLower
                );

                if (existingScanned) {
                    return NextResponse.json({
                        error: 'This email was already found during scanning',
                        existingContactId: existingScanned.id,
                        duplicate: true
                    }, { status: 409 });
                }
            }
        } catch (e) {
            // Ignore parsing errors
        }

        // Create new contact
        const newContact = {
            id: `manual-${companyId}-${Date.now()}`,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            fullName: `${firstName.trim()} ${lastName.trim()}`,
            roleTitle: roleTitle?.trim() || '',
            email: email.trim(),
            emailLower,
            source: 'manual',
            confidence: 1.0,
            verified: false,
            isArchived: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Add to array
        manualContacts.push(newContact);

        // Save to database
        await prisma.companyProspect.update({
            where: { id: companyId },
            data: {
                manualContacts: JSON.stringify(manualContacts)
            }
        });

        console.log(`[Contacts POST] Created manual contact ${newContact.id} for company ${companyId}`);

        // Auto-infer email pattern in background
        try {
            // Trigger pattern inference asynchronously (don't await)
            fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/companies/${companyId}/email-pattern/infer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            }).catch(e => console.error('[Contacts POST] Pattern inference failed:', e));

            console.log(`[Contacts POST] Triggered pattern inference for company ${companyId}`);
        } catch (e) {
            // Non-blocking
        }

        return NextResponse.json({
            success: true,
            contact: {
                id: newContact.id,
                fullName: newContact.fullName,
                firstName: newContact.firstName,
                lastName: newContact.lastName,
                role: newContact.roleTitle,
                email: newContact.email,
                source: 'manual',
                confidence: 1.0,
                verified: false,
                isManual: true,
                createdAt: newContact.createdAt
            },
            patternInferenceQueued: true
        }, { status: 201 });

    } catch (error: any) {
        console.error('[Contacts POST] Error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to create contact'
        }, { status: 500 });
    }
}

