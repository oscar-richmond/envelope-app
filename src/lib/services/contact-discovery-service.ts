/**
 * Contact Discovery Service v2
 * Multi-source contact harvesting: Hunter + Site Crawl + Pattern Inference
 */

import { hunterDomainSearch, EmailCandidate, formatPattern } from './hunter-domain-search';
import { verifyEmail } from './email-verification';

// ============================================
// TYPES
// ============================================

export interface ContactSource {
    provider: 'hunter' | 'site' | 'pattern' | 'companies_house';
    url?: string;
    snippet?: string;
    confidence?: number;
}

export interface DiscoveredContact {
    email: string;
    firstName: string | null;
    lastName: string | null;
    fullName: string | null;
    role: string | null;
    phone: string | null;
    linkedin: string | null;
    type: 'person' | 'generic';
    confidence: number;
    verification: {
        status: 'valid' | 'invalid' | 'risky' | 'unknown' | 'pending';
        reason?: string;
        isCatchAll: boolean;
        verifiedAt?: string;
    };
    sources: ContactSource[];
    score: number;
}

export interface ContactDiscoveryOptions {
    maxContacts?: number;
    verifyInferred?: number;
    crawlSite?: boolean;
    useHunter?: boolean;
    usePatternInference?: boolean;
    seedNames?: { firstName: string; lastName: string; role?: string }[];
}

export interface ContactDiscoveryResult {
    domain: string;
    contacts: DiscoveredContact[];
    pattern: string | null;
    stats: {
        hunterCount: number;
        crawlCount: number;
        inferredCount: number;
        verifiedCount: number;
        totalUnique: number;
        durationMs: number;
    };
}

// ============================================
// CONSTANTS
// ============================================

const CRAWL_PAGES = [
    '/contact',
    '/contact-us',
    '/about',
    '/about-us',
    '/team',
    '/our-team',
    '/people',
    '/leadership',
    '/management',
    '/staff',
    '/careers',
    '/press',
    '/meet-the-team',
];

const GENERIC_PREFIXES = new Set([
    'info', 'contact', 'hello', 'hi', 'enquiries', 'enquiry', 'general',
    'admin', 'office', 'team', 'support', 'help', 'sales', 'marketing',
    'hr', 'careers', 'jobs', 'press', 'media', 'legal', 'billing', 'accounts',
    'reception', 'mail', 'email', 'service', 'customer', 'feedback',
]);

const EMAIL_PATTERNS = [
    '{first}',           // john@
    '{first}.{last}',    // john.smith@
    '{f}.{last}',        // j.smith@
    '{first}{last}',     // johnsmith@
    '{first}_{last}',    // john_smith@
    '{f}{last}',         // jsmith@
    '{first}{l}',        // johns@
    '{last}.{first}',    // smith.john@
    '{last}',            // smith@
];

const ROLE_SCORES: Record<string, number> = {
    'ceo': 35,
    'founder': 35,
    'co-founder': 35,
    'owner': 30,
    'managing director': 30,
    'director': 25,
    'vp': 25,
    'vice president': 25,
    'head of': 22,
    'chief': 30,
    'cto': 28,
    'cfo': 28,
    'cmo': 28,
    'coo': 28,
    'marketing director': 22,
    'sales director': 22,
    'business development': 20,
    'marketing manager': 18,
    'sales manager': 18,
    'partner': 25,
    'managing partner': 28,
};

// ============================================
// SITE CRAWL PROVIDER
// ============================================

async function crawlSiteForContacts(
    domain: string,
    baseUrl: string
): Promise<DiscoveredContact[]> {
    const contacts: Map<string, DiscoveredContact> = new Map();

    console.log(`[SiteCrawl] Crawling ${domain}...`);

    for (const path of CRAWL_PAGES) {
        try {
            const url = `${baseUrl}${path}`;
            const response = await fetch(url, {
                headers: { 'User-Agent': 'EnvelopeBot/2.0' },
                signal: AbortSignal.timeout(8000),
            });

            if (!response.ok) continue;

            const html = await response.text();

            // Extract emails from page
            const extractedContacts = extractContactsFromHtml(html, domain, url);

            for (const contact of extractedContacts) {
                const existing = contacts.get(contact.email);
                if (existing) {
                    // Merge sources
                    existing.sources.push(...contact.sources);
                    if (!existing.fullName && contact.fullName) {
                        existing.fullName = contact.fullName;
                        existing.firstName = contact.firstName;
                        existing.lastName = contact.lastName;
                    }
                    if (!existing.role && contact.role) {
                        existing.role = contact.role;
                    }
                } else {
                    contacts.set(contact.email, contact);
                }
            }

            // Parse JSON-LD for structured data
            const structuredContacts = parseJsonLd(html, domain, url);
            for (const contact of structuredContacts) {
                if (!contacts.has(contact.email)) {
                    contacts.set(contact.email, contact);
                }
            }

        } catch (err) {
            // Page not found or error, continue
        }
    }

    console.log(`[SiteCrawl] Found ${contacts.size} contacts from site`);
    return Array.from(contacts.values());
}

function extractContactsFromHtml(
    html: string,
    domain: string,
    sourceUrl: string
): DiscoveredContact[] {
    const contacts: DiscoveredContact[] = [];

    // Email regex
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
    const matches = html.match(emailRegex) || [];

    for (const email of matches) {
        const lowerEmail = email.toLowerCase();

        // Only include emails for this domain
        if (!lowerEmail.endsWith('@' + domain) && !lowerEmail.endsWith('@www.' + domain)) {
            continue;
        }

        // Check if generic
        const [local] = lowerEmail.split('@');
        const isGeneric = GENERIC_PREFIXES.has(local);

        // Try to find name near email
        const name = findNearbyName(html, email);
        const role = findNearbyRole(html, email);

        contacts.push({
            email: lowerEmail,
            firstName: name?.firstName || null,
            lastName: name?.lastName || null,
            fullName: name?.fullName || null,
            role: role,
            phone: null,
            linkedin: null,
            type: isGeneric ? 'generic' : 'person',
            confidence: isGeneric ? 40 : 70,
            verification: { status: 'pending', isCatchAll: false },
            sources: [{
                provider: 'site',
                url: sourceUrl,
                snippet: role || 'Found on website',
            }],
            score: 0,
        });
    }

    return contacts;
}

function findNearbyName(html: string, email: string): { firstName: string; lastName: string; fullName: string } | null {
    // Look for name patterns near the email
    const index = html.indexOf(email);
    if (index === -1) return null;

    const context = html.substring(Math.max(0, index - 300), Math.min(html.length, index + 100));

    // Common name patterns
    const namePatterns = [
        /<h[2-4][^>]*>([A-Z][a-z]+ [A-Z][a-z]+)<\/h[2-4]>/i,
        /<strong>([A-Z][a-z]+ [A-Z][a-z]+)<\/strong>/i,
        /"name":\s*"([^"]+)"/,
    ];

    for (const pattern of namePatterns) {
        const match = context.match(pattern);
        if (match) {
            const parts = match[1].trim().split(/\s+/);
            if (parts.length >= 2) {
                return {
                    firstName: parts[0],
                    lastName: parts.slice(1).join(' '),
                    fullName: match[1].trim(),
                };
            }
        }
    }

    return null;
}

function findNearbyRole(html: string, email: string): string | null {
    const index = html.indexOf(email);
    if (index === -1) return null;

    const context = html.substring(Math.max(0, index - 300), Math.min(html.length, index + 200)).toLowerCase();

    for (const [keyword, _] of Object.entries(ROLE_SCORES)) {
        if (context.includes(keyword)) {
            // Capitalize properly
            return keyword.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        }
    }

    return null;
}

function parseJsonLd(html: string, domain: string, sourceUrl: string): DiscoveredContact[] {
    const contacts: DiscoveredContact[] = [];

    try {
        const jsonLdMatches = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi) || [];

        for (const match of jsonLdMatches) {
            const jsonContent = match.replace(/<script[^>]*>|<\/script>/gi, '');
            const data = JSON.parse(jsonContent);

            const people = findPeopleInJsonLd(data);

            for (const person of people) {
                if (person.email && person.email.includes('@' + domain)) {
                    const [local] = person.email.split('@');
                    contacts.push({
                        email: person.email.toLowerCase(),
                        firstName: person.givenName || null,
                        lastName: person.familyName || null,
                        fullName: person.name || null,
                        role: person.jobTitle || null,
                        phone: person.telephone || null,
                        linkedin: null,
                        type: GENERIC_PREFIXES.has(local) ? 'generic' : 'person',
                        confidence: 85,
                        verification: { status: 'pending', isCatchAll: false },
                        sources: [{
                            provider: 'site',
                            url: sourceUrl,
                            snippet: 'JSON-LD structured data',
                        }],
                        score: 0,
                    });
                }
            }
        }
    } catch (err) {
        // JSON parse error, ignore
    }

    return contacts;
}

function findPeopleInJsonLd(data: any): any[] {
    const people: any[] = [];

    if (Array.isArray(data)) {
        for (const item of data) {
            people.push(...findPeopleInJsonLd(item));
        }
    } else if (typeof data === 'object' && data !== null) {
        if (data['@type'] === 'Person') {
            people.push(data);
        }
        for (const key of Object.keys(data)) {
            if (typeof data[key] === 'object') {
                people.push(...findPeopleInJsonLd(data[key]));
            }
        }
    }

    return people;
}

// ============================================
// PATTERN INFERENCE
// ============================================

function generateCandidateEmails(
    names: { firstName: string; lastName: string; role?: string }[],
    pattern: string | null,
    domain: string
): DiscoveredContact[] {
    const candidates: DiscoveredContact[] = [];

    // Determine patterns to try
    const patterns = pattern ? [pattern] : EMAIL_PATTERNS.slice(0, 4);

    for (const name of names) {
        const first = name.firstName.toLowerCase().replace(/[^a-z]/g, '');
        const last = name.lastName.toLowerCase().replace(/[^a-z]/g, '');

        if (!first || !last) continue;

        for (const patternTemplate of patterns) {
            const email = patternTemplate
                .replace('{first}', first)
                .replace('{last}', last)
                .replace('{f}', first[0])
                .replace('{l}', last[0])
                + '@' + domain;

            candidates.push({
                email,
                firstName: name.firstName,
                lastName: name.lastName,
                fullName: `${name.firstName} ${name.lastName}`,
                role: name.role || null,
                phone: null,
                linkedin: null,
                type: 'person',
                confidence: 50, // Lower confidence for inferred
                verification: { status: 'pending', isCatchAll: false },
                sources: [{
                    provider: 'pattern',
                    snippet: `Inferred from pattern: ${patternTemplate}`,
                }],
                score: 0,
            });
        }
    }

    console.log(`[PatternInference] Generated ${candidates.length} candidate emails`);
    return candidates;
}

// ============================================
// SCORING
// ============================================

function scoreContact(contact: DiscoveredContact): number {
    let score = 0;

    // Role scoring
    if (contact.role) {
        const roleLower = contact.role.toLowerCase();
        for (const [keyword, points] of Object.entries(ROLE_SCORES)) {
            if (roleLower.includes(keyword)) {
                score += points;
                break;
            }
        }
    }

    // Verification status
    if (contact.verification.status === 'valid') score += 25;
    else if (contact.verification.status === 'risky') score += 10;
    else if (contact.verification.status === 'pending') score += 5;

    // Source reliability
    const hasHunter = contact.sources.some(s => s.provider === 'hunter');
    const hasSite = contact.sources.some(s => s.provider === 'site');
    const hasPattern = contact.sources.some(s => s.provider === 'pattern');

    if (hasHunter) score += 20;
    if (hasSite) score += 12;
    if (hasPattern) score += 5;

    // Has name
    if (contact.fullName) score += 10;

    // Not generic
    if (contact.type === 'person') score += 15;

    // Multiple sources
    if (contact.sources.length > 1) score += 8;

    // Confidence boost
    score += Math.floor(contact.confidence / 10);

    return score;
}

// ============================================
// MAIN SERVICE
// ============================================

export async function discoverContacts(
    domain: string,
    options: ContactDiscoveryOptions = {}
): Promise<ContactDiscoveryResult> {
    const startTime = Date.now();
    const {
        maxContacts = 30,
        verifyInferred = 5,
        crawlSite = true,
        useHunter = true,
        usePatternInference = true,
        seedNames = [],
    } = options;

    console.log(`[ContactDiscovery] Starting for ${domain}`);

    // Normalize domain
    const cleanDomain = domain
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split('/')[0];

    const baseUrl = `https://${cleanDomain}`;

    const allContacts: Map<string, DiscoveredContact> = new Map();
    let hunterCount = 0;
    let crawlCount = 0;
    let inferredCount = 0;
    let hunterPattern: string | null = null;

    // 1. Hunter Domain Search
    if (useHunter) {
        try {
            const hunterResult = await hunterDomainSearch(cleanDomain, { maxResults: 50 });
            hunterCount = hunterResult.emails.length;
            hunterPattern = hunterResult.pattern;

            for (const email of hunterResult.emails) {
                const contact: DiscoveredContact = {
                    email: email.email,
                    firstName: email.firstName,
                    lastName: email.lastName,
                    fullName: email.fullName,
                    role: email.position,
                    phone: email.phone,
                    linkedin: email.linkedin,
                    type: email.type,
                    confidence: email.confidence,
                    verification: {
                        status: mapHunterVerification(email.verification.status),
                        isCatchAll: email.verification.isCatchAll,
                    },
                    sources: email.sources.map(s => ({
                        provider: 'hunter' as const,
                        url: s.url,
                        snippet: email.position || 'Hunter.io',
                    })),
                    score: 0,
                };
                allContacts.set(email.email, contact);
            }
        } catch (err) {
            console.error('[ContactDiscovery] Hunter error:', err);
        }
    }

    // 2. Site Crawl
    if (crawlSite) {
        try {
            const crawledContacts = await crawlSiteForContacts(cleanDomain, baseUrl);
            crawlCount = crawledContacts.length;

            for (const contact of crawledContacts) {
                const existing = allContacts.get(contact.email);
                if (existing) {
                    // Merge
                    existing.sources.push(...contact.sources);
                    if (!existing.fullName && contact.fullName) {
                        existing.fullName = contact.fullName;
                        existing.firstName = contact.firstName;
                        existing.lastName = contact.lastName;
                    }
                    if (!existing.role && contact.role) {
                        existing.role = contact.role;
                    }
                } else {
                    allContacts.set(contact.email, contact);
                }
            }
        } catch (err) {
            console.error('[ContactDiscovery] Crawl error:', err);
        }
    }

    // 3. Pattern Inference
    if (usePatternInference && seedNames.length > 0) {
        const candidates = generateCandidateEmails(seedNames, hunterPattern, cleanDomain);

        // Verify top N inferred candidates
        let verifiedInferred = 0;
        for (const candidate of candidates.slice(0, verifyInferred)) {
            if (allContacts.has(candidate.email)) continue;

            try {
                const result = await verifyEmail(candidate.email);
                candidate.verification = {
                    status: result.status as any,
                    reason: result.reason,
                    isCatchAll: result.isCatchAll || false,
                    verifiedAt: new Date().toISOString(),
                };

                if (result.status === 'valid') {
                    candidate.confidence = 80;
                    allContacts.set(candidate.email, candidate);
                    verifiedInferred++;
                    inferredCount++;
                }
            } catch (err) {
                // Verification failed, skip
            }
        }
    }

    // 4. Score all contacts
    for (const contact of allContacts.values()) {
        contact.score = scoreContact(contact);
    }

    // 5. Sort and limit
    const sortedContacts = Array.from(allContacts.values())
        .sort((a, b) => {
            // People first
            if (a.type !== b.type) return a.type === 'person' ? -1 : 1;
            // Then by score
            return b.score - a.score;
        })
        .slice(0, maxContacts);

    // 6. Count verified
    const verifiedCount = sortedContacts.filter(c => c.verification.status === 'valid').length;

    console.log(`[ContactDiscovery] Complete: ${sortedContacts.length} contacts, ${verifiedCount} verified`);

    return {
        domain: cleanDomain,
        contacts: sortedContacts,
        pattern: hunterPattern ? formatPattern(hunterPattern, cleanDomain) : null,
        stats: {
            hunterCount,
            crawlCount,
            inferredCount,
            verifiedCount,
            totalUnique: allContacts.size,
            durationMs: Date.now() - startTime,
        },
    };
}

function mapHunterVerification(status: string): 'valid' | 'invalid' | 'risky' | 'unknown' {
    switch (status) {
        case 'valid': return 'valid';
        case 'invalid': return 'invalid';
        case 'risky': return 'risky';
        default: return 'unknown';
    }
}
