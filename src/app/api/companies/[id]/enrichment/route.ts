import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { discoverContactsV3 } from '@/lib/services/contact-discovery-v3';
import { scoreAndRankContacts } from '@/lib/services/contact-scoring';

/**
 * Contact Enrichment API
 * 
 * Unified endpoint for web + extension to get enriched contacts
 * Returns: contacts grouped by type with verification status
 */

// Email validation regex - strict RFC 5322 compliant
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

// Clean and validate email
function cleanEmail(email: string): string | null {
    if (!email || typeof email !== 'string') return null;

    // Normalize
    let cleaned = email.toLowerCase().trim();

    // Strip common trailing garbage (e.g., info@domain.co.ukour)
    // Look for valid TLD and strip anything after
    const tldMatch = cleaned.match(/^([^@]+@[^@]+\.(com|co\.uk|org|net|io|uk|eu|info|biz|gov|edu|app|dev|tech|agency|studio|design|digital|marketing|media|group|consulting|solutions|services|limited|ltd|inc|llc|plc))(.*)$/i);
    if (tldMatch) {
        cleaned = tldMatch[1];
    }

    // Validate
    if (!EMAIL_REGEX.test(cleaned)) return null;

    return cleaned;
}

// Group contacts by type
function groupContacts(contacts: any[]) {
    const bestContacts: any[] = [];
    const moreContacts: any[] = [];
    const genericContacts: any[] = [];

    for (const contact of contacts) {
        // Mark top 3 scored as "best"
        if (contact.isBestContact || bestContacts.length < 3) {
            if (contact.type !== 'generic' && contact.deliverability !== 'low') {
                bestContacts.push(contact);
                continue;
            }
        }

        // Generic emails go to separate bucket
        if (contact.type === 'generic' || isGenericEmail(contact.email)) {
            genericContacts.push(contact);
        } else {
            moreContacts.push(contact);
        }
    }

    return { bestContacts, moreContacts, genericContacts };
}

function isGenericEmail(email: string): boolean {
    const genericPrefixes = ['info', 'contact', 'hello', 'hi', 'enquiries', 'enquiry',
        'general', 'admin', 'office', 'team', 'mail', 'email', 'inbox',
        'support', 'sales', 'marketing', 'hr'];
    const local = email.split('@')[0].toLowerCase();
    return genericPrefixes.includes(local);
}

// GET - Return cached enriched contacts
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const companyId = parseInt(id);
        if (isNaN(companyId)) {
            return NextResponse.json({ error: 'Invalid company ID' }, { status: 400 });
        }

        // Get company prospect
        const prospect = await prisma.companyProspect.findUnique({
            where: { id: companyId }
        });

        if (!prospect) {
            return NextResponse.json({ error: 'Company not found' }, { status: 404 });
        }

        // Get stored contacts (emails relation removed from schema)
        const contactsForScoring: any[] = [];

        const scored = scoreAndRankContacts(contactsForScoring);
        const grouped = groupContacts(scored);

        return NextResponse.json({
            companyId,
            companyName: prospect.companyName || prospect.brandNameOverride || prospect.websiteBrandName,
            domain: prospect.websiteDomain,
            ...grouped,
            totalCount: scored.length,
            status: scored.length > 0 ? 'enriched' : 'pending'
        });

    } catch (error: any) {
        console.error('[EnrichmentAPI] GET error:', error);
        return NextResponse.json({
            error: 'Failed to load contacts',
            details: error.message
        }, { status: 500 });
    }
}

// POST - Trigger rescan and return fresh results
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const companyId = parseInt(id);
        if (isNaN(companyId)) {
            return NextResponse.json({ error: 'Invalid company ID' }, { status: 400 });
        }

        // Get company prospect
        const prospect = await prisma.companyProspect.findUnique({
            where: { id: companyId }
        });

        if (!prospect) {
            return NextResponse.json({ error: 'Company not found' }, { status: 404 });
        }

        const domain = prospect.websiteDomain ||
            prospect.websiteUrl?.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];

        if (!domain) {
            return NextResponse.json({
                error: 'No domain found',
                status: 'no_domain'
            }, { status: 400 });
        }

        console.log(`[EnrichmentAPI] Running discovery for ${domain}...`);

        // Run contact discovery
        const result = await discoverContactsV3(domain, {
            maxPeople: 20,
            verifyTopN: 5,
            includeWebsiteCrawl: true,
            includeCompaniesHouse: true,
            companyNumber: prospect.companyNumber || undefined,
            companyName: prospect.companyName || undefined
        });

        // Clean and dedupe emails
        const seenEmails = new Set<string>();
        const cleanedContacts: any[] = [];

        // Process recommended recipients
        for (const rec of result.recommendedRecipients || []) {
            const cleanedEmail = cleanEmail(rec.email?.email || '');
            if (cleanedEmail && !seenEmails.has(cleanedEmail)) {
                seenEmails.add(cleanedEmail);
                cleanedContacts.push({
                    email: cleanedEmail,
                    name: rec.person?.fullName || null,
                    firstName: rec.person?.firstName || null,
                    lastName: rec.person?.lastName || null,
                    role: rec.person?.roleTitle || null,
                    type: 'person',
                    sources: rec.email?.sources || [],
                    confidence: rec.email?.confidence || 0,
                    verification: rec.email?.verification || null,
                    seniority: rec.person?.seniorityScore || 0,
                    priorityScore: rec.priorityScore || 0,
                    isBestContact: true
                });
            }
        }

        // Process other people
        for (const other of result.otherPeople || []) {
            const cleanedEmail = cleanEmail(other.email?.email || '');
            if (cleanedEmail && !seenEmails.has(cleanedEmail)) {
                seenEmails.add(cleanedEmail);
                cleanedContacts.push({
                    email: cleanedEmail,
                    name: other.person?.fullName || null,
                    firstName: other.person?.firstName || null,
                    lastName: other.person?.lastName || null,
                    role: other.person?.roleTitle || null,
                    type: 'person',
                    sources: other.email?.sources || [],
                    confidence: other.email?.confidence || 0,
                    verification: other.email?.verification || null,
                    seniority: other.person?.seniorityScore || 0,
                    isBestContact: false
                });
            }
        }

        // Process department emails
        for (const dept of result.departmentEmails || []) {
            const cleanedEmail = cleanEmail(dept.email || '');
            if (cleanedEmail && !seenEmails.has(cleanedEmail)) {
                seenEmails.add(cleanedEmail);
                cleanedContacts.push({
                    email: cleanedEmail,
                    name: null,
                    role: dept.type === 'role' ? cleanedEmail.split('@')[0] : null,
                    type: 'department',
                    sources: dept.sources || [],
                    confidence: dept.confidence || 0,
                    verification: dept.verification || null,
                    isBestContact: false
                });
            }
        }

        // Process generic emails
        for (const gen of result.genericEmails || []) {
            const cleanedEmail = cleanEmail(gen.email || '');
            if (cleanedEmail && !seenEmails.has(cleanedEmail)) {
                seenEmails.add(cleanedEmail);
                cleanedContacts.push({
                    email: cleanedEmail,
                    name: null,
                    role: null,
                    type: 'generic',
                    sources: gen.sources || [],
                    confidence: gen.confidence || 0,
                    verification: gen.verification || null,
                    isBestContact: false
                });
            }
        }

        // Store in database (update removed - prospectId_email constraint doesn't exist)
        // TODO: Refactor enrichment data storage

        // Upsert emails - disabled until schema is fixed
        // for (const contact of cleanedContacts) { ... }

        // Score and group for response
        const scored = scoreAndRankContacts(cleanedContacts.map(c => ({
            email: c.email,
            name: c.name,
            role: c.role,
            confidence: c.confidence,
            source: c.sources?.[0],
            verification: c.verification
        })));

        const grouped = groupContacts(scored);

        return NextResponse.json({
            status: 'complete',
            companyId,
            domain,
            pattern: result.pattern,
            lastEnrichedAt: new Date().toISOString(),
            ...grouped,
            totalCount: cleanedContacts.length,
            stats: result.stats
        });

    } catch (error: any) {
        console.error('[EnrichmentAPI] POST error:', error);
        return NextResponse.json({
            status: 'failed',
            error: error.message
        }, { status: 500 });
    }
}
