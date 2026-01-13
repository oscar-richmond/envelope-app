/**
 * Contact Discovery v3 - People-First Contact Discovery
 * 
 * 4 Channels: Hunter + Site Crawl + Companies House + Role Detection
 * Output: Recommended People → Other People → Department → Generic
 */

import { hunterDomainSearch, EmailCandidate } from './hunter-domain-search';
import { fetchOfficers, selectDecisionMakers, isCompaniesHouseEnabled, resolveCompany } from './companies-house';
import { verifyEmail } from './email-verification';

// ============================================
// TYPES
// ============================================

export interface Person {
    id: string;
    fullName: string;
    firstName: string;
    lastName: string;
    roleTitle: string | null;
    seniorityScore: number;
    sources: ('hunter' | 'website' | 'companies_house')[];
    evidence: { url?: string; snippet?: string }[];
}

export interface ContactEmail {
    id: string;
    email: string;
    domain: string;
    type: 'personal' | 'role' | 'generic';
    personId: string | null;
    sources: ('hunter' | 'website' | 'pattern')[];
    evidence: { url?: string; snippet?: string }[];
    isSuggested: boolean;
    suggestedFromPattern?: { patternType: string; confidence: number };
    verification?: {
        status: 'valid' | 'invalid' | 'risky' | 'unknown' | 'catch-all';
        provider?: string;
        checkedAt?: string;
        isCatchAll?: boolean;
    };
    confidence: number;
}

export interface RecommendedContact {
    person: Person;
    email: ContactEmail;
    priorityScore: number;
    reason: string;
}

export interface ContactDiscoveryV3Result {
    domain: string;
    recommendedRecipients: RecommendedContact[];
    otherPeople: { person: Person; email: ContactEmail }[];
    departmentEmails: ContactEmail[];
    genericEmails: ContactEmail[];
    pattern: string | null;
    stats: {
        hunterCount: number;
        websiteCount: number;
        directorsCount: number;
        roleEmailsCount: number;
        verifiedCount: number;
        suggestedCount: number;
        durationMs: number;
    };
}

export interface ContactDiscoveryV3Options {
    maxPeople?: number;
    verifyTopN?: number;
    includeWebsiteCrawl?: boolean;
    includeCompaniesHouse?: boolean;
    companyNumber?: string;
    companyName?: string;
}

// ============================================
// CONSTANTS
// ============================================

const STAFF_PAGES = [
    '/team', '/our-team', '/the-team', '/meet-the-team',
    '/people', '/our-people', '/staff',
    '/about', '/about-us',
    '/leadership', '/management', '/executives',
    '/contact', '/contact-us'
];

const ROLE_EMAIL_PREFIXES: Record<string, string> = {
    'sales': 'Sales',
    'marketing': 'Marketing',
    'partnerships': 'Partnerships',
    'partner': 'Partnerships',
    'bd': 'Business Development',
    'business': 'Business Development',
    'growth': 'Growth',
    'pr': 'PR',
    'press': 'Press',
    'media': 'Media',
    'careers': 'Careers',
    'jobs': 'Careers',
    'hr': 'HR',
    'recruitment': 'Recruitment',
    'accounts': 'Accounts',
    'finance': 'Finance',
    'billing': 'Billing',
    'legal': 'Legal',
    'support': 'Support',
    'help': 'Support',
    'service': 'Customer Service',
    'customer': 'Customer Service',
};

const GENERIC_PREFIXES = new Set([
    'info', 'contact', 'hello', 'hi', 'enquiries', 'enquiry',
    'general', 'admin', 'office', 'team', 'mail', 'email', 'inbox'
]);

const SENIORITY_SCORES: Record<string, number> = {
    'ceo': 100, 'chief executive': 100, 'founder': 100, 'co-founder': 100,
    'managing director': 95, 'md': 95, 'owner': 95,
    'director': 85, 'board': 85,
    'cto': 90, 'cfo': 90, 'cmo': 90, 'coo': 90, 'chief': 90,
    'vp': 80, 'vice president': 80,
    'head of': 75, 'head': 70,
    'senior': 60, 'lead': 55,
    'manager': 50,
    'marketing': 45, 'sales': 45, 'growth': 45,
    'partnerships': 40, 'business development': 40,
};

const EMAIL_PATTERNS = [
    '{first}.{last}',
    '{first}',
    '{f}.{last}',
    '{first}{last}',
    '{f}{last}',
];

// ============================================
// CHANNEL 1: HUNTER DOMAIN SEARCH
// ============================================

async function runHunterChannel(domain: string): Promise<{
    people: Map<string, Person>;
    emails: Map<string, ContactEmail>;
    pattern: string | null;
}> {
    const people = new Map<string, Person>();
    const emails = new Map<string, ContactEmail>();
    let pattern: string | null = null;

    try {
        const hunterResult = await hunterDomainSearch(domain, { maxResults: 50 });
        pattern = hunterResult.pattern;

        for (const candidate of hunterResult.emails) {
            const personId = `hunter_${candidate.email}`;

            // Create person if we have name
            if (candidate.firstName || candidate.lastName) {
                const seniorityScore = calculateSeniority(candidate.position || '');

                people.set(personId, {
                    id: personId,
                    fullName: candidate.fullName || `${candidate.firstName} ${candidate.lastName}`.trim(),
                    firstName: candidate.firstName || '',
                    lastName: candidate.lastName || '',
                    roleTitle: candidate.position || null,
                    seniorityScore,
                    sources: ['hunter'],
                    evidence: candidate.sources?.map(s => ({ url: s.url })) || []
                });
            }

            // Create email
            const emailId = candidate.email.toLowerCase();
            const isGeneric = GENERIC_PREFIXES.has(emailId.split('@')[0]);
            const isRole = !isGeneric && ROLE_EMAIL_PREFIXES[emailId.split('@')[0]];

            emails.set(emailId, {
                id: emailId,
                email: candidate.email,
                domain,
                type: (candidate.firstName || candidate.lastName) ? 'personal' : (isRole ? 'role' : 'generic'),
                personId: (candidate.firstName || candidate.lastName) ? personId : null,
                sources: ['hunter'],
                evidence: candidate.sources?.map(s => ({ url: s.url })) || [],
                isSuggested: false,
                confidence: candidate.confidence,
                verification: candidate.verification?.status ? {
                    status: mapVerificationStatus(candidate.verification.status),
                    isCatchAll: candidate.verification.isCatchAll
                } : undefined
            });
        }

        console.log(`[Channel:Hunter] Found ${people.size} people, ${emails.size} emails`);
    } catch (err) {
        console.error('[Channel:Hunter] Error:', err);
    }

    return { people, emails, pattern };
}

// ============================================
// CHANNEL 2: WEBSITE STAFF DISCOVERY
// ============================================

async function runWebsiteChannel(domain: string): Promise<{
    people: Map<string, Person>;
    emails: Map<string, ContactEmail>;
}> {
    const people = new Map<string, Person>();
    const emails = new Map<string, ContactEmail>();
    const baseUrl = `https://${domain}`;

    for (const path of STAFF_PAGES) {
        try {
            const url = `${baseUrl}${path}`;
            const response = await fetch(url, {
                headers: { 'User-Agent': 'EnvelopeBot/3.0' },
                signal: AbortSignal.timeout(6000),
            });

            if (!response.ok) continue;
            const html = await response.text();

            // Extract emails
            const emailMatches = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi) || [];

            for (const email of emailMatches) {
                const lower = email.toLowerCase();
                if (!lower.endsWith('@' + domain)) continue;
                if (emails.has(lower)) continue;

                const local = lower.split('@')[0];
                const isGeneric = GENERIC_PREFIXES.has(local);
                const roleLabel = ROLE_EMAIL_PREFIXES[local];

                // Try to find nearby name
                const nearbyData = extractNearbyPersonData(html, email);

                if (nearbyData?.name) {
                    const personId = `web_${lower}`;
                    people.set(personId, {
                        id: personId,
                        fullName: nearbyData.name,
                        firstName: nearbyData.firstName || '',
                        lastName: nearbyData.lastName || '',
                        roleTitle: nearbyData.role || null,
                        seniorityScore: calculateSeniority(nearbyData.role || ''),
                        sources: ['website'],
                        evidence: [{ url, snippet: nearbyData.role }]
                    });

                    emails.set(lower, {
                        id: lower,
                        email: lower,
                        domain,
                        type: 'personal',
                        personId,
                        sources: ['website'],
                        evidence: [{ url }],
                        isSuggested: false,
                        confidence: 85
                    });
                } else {
                    emails.set(lower, {
                        id: lower,
                        email: lower,
                        domain,
                        type: isGeneric ? 'generic' : (roleLabel ? 'role' : 'personal'),
                        personId: null,
                        sources: ['website'],
                        evidence: [{ url }],
                        isSuggested: false,
                        confidence: 70
                    });
                }
            }

            // Parse JSON-LD Person objects
            const jsonLdPeople = parseJsonLdPeople(html, domain, url);
            for (const p of jsonLdPeople) {
                if (!people.has(p.person.id)) {
                    people.set(p.person.id, p.person);
                }
                if (p.email && !emails.has(p.email.id)) {
                    emails.set(p.email.id, p.email);
                }
            }

        } catch (err) {
            // Page not accessible, continue
        }
    }

    console.log(`[Channel:Website] Found ${people.size} people, ${emails.size} emails`);
    return { people, emails };
}

function extractNearbyPersonData(html: string, email: string): {
    name?: string;
    firstName?: string;
    lastName?: string;
    role?: string;
} | null {
    const idx = html.indexOf(email);
    if (idx === -1) return null;

    const context = html.substring(Math.max(0, idx - 400), Math.min(html.length, idx + 100));

    // Name patterns
    const namePatterns = [
        /<h[2-4][^>]*>([A-Z][a-z]+ [A-Z][a-z]+)<\/h[2-4]>/i,
        /<strong>([A-Z][a-z]+ [A-Z][a-z]+)<\/strong>/i,
        /class="[^"]*name[^"]*"[^>]*>([A-Z][a-z]+ [A-Z][a-z]+)</i,
    ];

    for (const pattern of namePatterns) {
        const match = context.match(pattern);
        if (match) {
            const parts = match[1].trim().split(/\s+/);
            return {
                name: match[1].trim(),
                firstName: parts[0],
                lastName: parts.slice(1).join(' '),
                role: findRoleInContext(context)
            };
        }
    }

    return null;
}

function findRoleInContext(context: string): string | null {
    const lower = context.toLowerCase();
    for (const [keyword, _] of Object.entries(SENIORITY_SCORES)) {
        if (lower.includes(keyword)) {
            return keyword.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        }
    }
    return null;
}

function parseJsonLdPeople(html: string, domain: string, sourceUrl: string): { person: Person; email?: ContactEmail }[] {
    const results: { person: Person; email?: ContactEmail }[] = [];

    try {
        const matches = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi) || [];

        for (const match of matches) {
            const json = match.replace(/<script[^>]*>|<\/script>/gi, '');
            const data = JSON.parse(json);

            const people = findPeopleRecursive(data);
            for (const p of people) {
                if (!p.name) continue;

                const personId = `jsonld_${p.name.replace(/\s+/g, '_').toLowerCase()}`;
                const person: Person = {
                    id: personId,
                    fullName: p.name,
                    firstName: p.givenName || p.name.split(' ')[0] || '',
                    lastName: p.familyName || p.name.split(' ').slice(1).join(' ') || '',
                    roleTitle: p.jobTitle || null,
                    seniorityScore: calculateSeniority(p.jobTitle || ''),
                    sources: ['website'],
                    evidence: [{ url: sourceUrl, snippet: 'JSON-LD' }]
                };

                let email: ContactEmail | undefined;
                if (p.email && p.email.includes('@' + domain)) {
                    const emailId = p.email.toLowerCase();
                    email = {
                        id: emailId,
                        email: emailId,
                        domain,
                        type: 'personal',
                        personId,
                        sources: ['website'],
                        evidence: [{ url: sourceUrl }],
                        isSuggested: false,
                        confidence: 90
                    };
                }

                results.push({ person, email });
            }
        }
    } catch (err) {
        // Parse error
    }

    return results;
}

function findPeopleRecursive(data: any): any[] {
    const people: any[] = [];
    if (Array.isArray(data)) {
        for (const item of data) {
            people.push(...findPeopleRecursive(item));
        }
    } else if (typeof data === 'object' && data !== null) {
        if (data['@type'] === 'Person') {
            people.push(data);
        }
        for (const key of Object.keys(data)) {
            if (typeof data[key] === 'object') {
                people.push(...findPeopleRecursive(data[key]));
            }
        }
    }
    return people;
}

// ============================================
// CHANNEL 3: COMPANIES HOUSE DIRECTORS
// ============================================

async function runCompaniesHouseChannel(
    domain: string,
    companyNumber?: string,
    companyName?: string
): Promise<{ people: Map<string, Person> }> {
    const people = new Map<string, Person>();

    if (!isCompaniesHouseEnabled()) {
        return { people };
    }

    try {
        let resolvedNumber = companyNumber;

        if (!resolvedNumber && companyName) {
            const resolved = await resolveCompany(companyName);
            if (resolved.status === 'matched') {
                resolvedNumber = resolved.companyNumber;
            }
        }

        if (!resolvedNumber) {
            return { people };
        }

        const officersResult = await fetchOfficers(resolvedNumber);
        if (!officersResult) {
            return { people };
        }

        const directors = selectDecisionMakers(officersResult.officers, 10);

        for (const director of directors) {
            const personId = `ch_${director.firstName}_${director.lastName}`.toLowerCase().replace(/\s+/g, '_');

            people.set(personId, {
                id: personId,
                fullName: director.fullName,
                firstName: director.firstName,
                lastName: director.lastName,
                roleTitle: director.role,
                seniorityScore: calculateSeniority(director.role),
                sources: ['companies_house'],
                evidence: [{ snippet: `Companies House: ${director.role}` }]
            });
        }

        console.log(`[Channel:CompaniesHouse] Found ${people.size} directors`);
    } catch (err) {
        console.error('[Channel:CompaniesHouse] Error:', err);
    }

    return { people };
}

// ============================================
// CHANNEL 4: ROLE EMAIL DETECTION
// ============================================

function detectRoleEmails(allEmails: Map<string, ContactEmail>): ContactEmail[] {
    const roleEmails: ContactEmail[] = [];

    for (const email of allEmails.values()) {
        if (email.type === 'role') {
            roleEmails.push(email);
        } else {
            const local = email.email.split('@')[0];
            const roleLabel = ROLE_EMAIL_PREFIXES[local];
            if (roleLabel && email.type !== 'personal') {
                email.type = 'role';
                roleEmails.push(email);
            }
        }
    }

    return roleEmails;
}

// ============================================
// PATTERN ENGINE
// ============================================

function generateSuggestedEmails(
    peopleWithoutEmails: Person[],
    pattern: string | null,
    domain: string,
    existingEmails: Map<string, ContactEmail>
): ContactEmail[] {
    const suggestions: ContactEmail[] = [];
    const patternsToTry = pattern ? [pattern] : EMAIL_PATTERNS.slice(0, 3);

    for (const person of peopleWithoutEmails) {
        if (!person.firstName || !person.lastName) continue;

        const first = person.firstName.toLowerCase().replace(/[^a-z]/g, '');
        const last = person.lastName.toLowerCase().replace(/[^a-z]/g, '');
        if (!first || !last) continue;

        for (const p of patternsToTry) {
            const local = p
                .replace('{first}', first)
                .replace('{last}', last)
                .replace('{f}', first[0])
                .replace('{l}', last[0]);

            const email = `${local}@${domain}`;

            if (existingEmails.has(email)) continue;

            suggestions.push({
                id: email,
                email,
                domain,
                type: 'personal',
                personId: person.id,
                sources: ['pattern'],
                evidence: [{ snippet: `Pattern: ${p}` }],
                isSuggested: true,
                suggestedFromPattern: {
                    patternType: p,
                    confidence: pattern ? 80 : 50
                },
                confidence: pattern ? 60 : 40
            });

            break; // Only first pattern per person
        }
    }

    console.log(`[Pattern] Generated ${suggestions.length} suggested emails`);
    return suggestions;
}

// ============================================
// SCORING ENGINE
// ============================================

function calculateSeniority(role: string): number {
    const lower = role.toLowerCase();
    let maxScore = 15; // default

    for (const [keyword, score] of Object.entries(SENIORITY_SCORES)) {
        if (lower.includes(keyword)) {
            maxScore = Math.max(maxScore, score);
        }
    }

    return maxScore;
}

function calculatePriorityScore(person: Person, email: ContactEmail): { score: number; reason: string } {
    let score = 0;
    const reasons: string[] = [];

    // Role Relevance (0-45)
    const roleScore = Math.min(45, Math.floor(person.seniorityScore * 0.45));
    score += roleScore;
    if (roleScore >= 40) reasons.push(person.roleTitle || 'Senior Role');

    // Email Quality (0-35)
    let emailScore = 5;
    if (email.verification?.status === 'valid') {
        emailScore = 35;
        reasons.push('Verified');
    } else if (email.type === 'personal' && email.confidence >= 80) {
        emailScore = 25;
    } else if (email.verification?.isCatchAll) {
        emailScore = 18;
    } else if (email.type === 'role') {
        emailScore = 16;
    } else if (email.type === 'personal') {
        emailScore = 20;
    }
    score += emailScore;

    // Source Confidence (0-20)
    let sourceScore = 6;
    if (email.sources.includes('hunter')) {
        sourceScore = 20;
        reasons.push('Hunter');
    } else if (email.sources.includes('website')) {
        sourceScore = 18;
    } else if (email.isSuggested && email.verification?.status === 'valid') {
        sourceScore = 18;
    } else if (person.sources.includes('companies_house')) {
        sourceScore = 10;
        reasons.push('CH Director');
    }
    score += sourceScore;

    return { score, reason: reasons.join(' + ') || 'Contact found' };
}

// ============================================
// VERIFICATION
// ============================================

async function verifyTopEmails(
    emails: ContactEmail[],
    maxVerify: number
): Promise<{ verified: number; valid: number }> {
    let verified = 0;
    let valid = 0;

    const toVerify = emails
        .filter(e => !e.verification && e.type === 'personal')
        .slice(0, maxVerify);

    for (const email of toVerify) {
        try {
            const result = await verifyEmail(email.email);
            email.verification = {
                status: mapVerificationStatus(result.status),
                provider: result.provider,
                checkedAt: new Date().toISOString(),
                isCatchAll: result.isCatchAll
            };
            verified++;
            if (result.status === 'valid') valid++;
        } catch (err) {
            email.verification = {
                status: 'unknown',
                checkedAt: new Date().toISOString()
            };
        }
    }

    return { verified, valid };
}

function mapVerificationStatus(status: string): 'valid' | 'invalid' | 'risky' | 'unknown' | 'catch-all' {
    switch (status?.toLowerCase()) {
        case 'valid': case 'deliverable': return 'valid';
        case 'invalid': case 'undeliverable': return 'invalid';
        case 'risky': case 'accept_all': case 'accept-all': return 'risky';
        case 'catch-all': case 'catchall': return 'catch-all';
        default: return 'unknown';
    }
}

// ============================================
// MAIN DISCOVERY FUNCTION
// ============================================

export async function discoverContactsV3(
    domain: string,
    options: ContactDiscoveryV3Options = {}
): Promise<ContactDiscoveryV3Result> {
    const startTime = Date.now();
    const {
        maxPeople = 30,
        verifyTopN = 10,
        includeWebsiteCrawl = true,
        includeCompaniesHouse = true,
        companyNumber,
        companyName
    } = options;

    console.log(`[ContactDiscoveryV3] Starting for ${domain}`);

    // Normalize domain
    const cleanDomain = domain
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split('/')[0]
        .toLowerCase();

    // Merged collections
    const allPeople = new Map<string, Person>();
    const allEmails = new Map<string, ContactEmail>();
    let pattern: string | null = null;

    // Stats
    let hunterCount = 0;
    let websiteCount = 0;
    let directorsCount = 0;

    // Channel 1: Hunter
    const hunterResult = await runHunterChannel(cleanDomain);
    hunterCount = hunterResult.emails.size;
    pattern = hunterResult.pattern;

    for (const [id, person] of hunterResult.people) {
        allPeople.set(id, person);
    }
    for (const [id, email] of hunterResult.emails) {
        allEmails.set(id, email);
    }

    // Channel 2: Website Crawl
    if (includeWebsiteCrawl) {
        const websiteResult = await runWebsiteChannel(cleanDomain);
        websiteCount = websiteResult.emails.size;

        for (const [id, person] of websiteResult.people) {
            if (!allPeople.has(id)) {
                allPeople.set(id, person);
            }
        }
        for (const [id, email] of websiteResult.emails) {
            if (!allEmails.has(id)) {
                allEmails.set(id, email);
            }
        }
    }

    // Channel 3: Companies House
    if (includeCompaniesHouse) {
        const chResult = await runCompaniesHouseChannel(cleanDomain, companyNumber, companyName);
        directorsCount = chResult.people.size;

        for (const [id, person] of chResult.people) {
            // Check if we already have this person by name
            let found = false;
            for (const existing of allPeople.values()) {
                if (existing.firstName.toLowerCase() === person.firstName.toLowerCase() &&
                    existing.lastName.toLowerCase() === person.lastName.toLowerCase()) {
                    existing.sources.push('companies_house');
                    existing.evidence.push(...person.evidence);
                    found = true;
                    break;
                }
            }
            if (!found) {
                allPeople.set(id, person);
            }
        }
    }

    // Channel 4: Role Detection
    const roleEmails = detectRoleEmails(allEmails);
    const roleEmailsCount = roleEmails.length;

    // Pattern Generation for people without emails
    const peopleWithoutEmails = Array.from(allPeople.values()).filter(p => {
        return !Array.from(allEmails.values()).some(e => e.personId === p.id);
    });

    const suggestions = generateSuggestedEmails(peopleWithoutEmails, pattern, cleanDomain, allEmails);
    for (const email of suggestions) {
        allEmails.set(email.id, email);
    }

    // Verification
    const personalEmails = Array.from(allEmails.values())
        .filter(e => e.type === 'personal')
        .sort((a, b) => b.confidence - a.confidence);

    const { verified: verifiedCount, valid: validCount } = await verifyTopEmails(personalEmails, verifyTopN);

    // Remove invalid suggested emails
    for (const [id, email] of allEmails) {
        if (email.isSuggested && email.verification?.status === 'invalid') {
            allEmails.delete(id);
        }
    }

    // Build scored contacts
    const scoredContacts: RecommendedContact[] = [];

    for (const email of allEmails.values()) {
        if (email.type !== 'personal' || !email.personId) continue;

        const person = allPeople.get(email.personId);
        if (!person) continue;

        const { score, reason } = calculatePriorityScore(person, email);
        scoredContacts.push({ person, email, priorityScore: score, reason });
    }

    // Sort by priority
    scoredContacts.sort((a, b) => b.priorityScore - a.priorityScore);

    // Split into recommended (top 8) and others
    const recommendedRecipients = scoredContacts.slice(0, 8);
    const otherPeople = scoredContacts.slice(8).map(c => ({ person: c.person, email: c.email }));

    // Department and generic
    const departmentEmails = Array.from(allEmails.values())
        .filter(e => e.type === 'role')
        .sort((a, b) => b.confidence - a.confidence);

    const genericEmails = Array.from(allEmails.values())
        .filter(e => e.type === 'generic')
        .sort((a, b) => b.confidence - a.confidence);

    console.log(`[ContactDiscoveryV3] Complete: ${recommendedRecipients.length} recommended, ${otherPeople.length} other, ${departmentEmails.length} dept, ${genericEmails.length} generic`);

    return {
        domain: cleanDomain,
        recommendedRecipients,
        otherPeople,
        departmentEmails,
        genericEmails,
        pattern: pattern ? `${pattern}@${cleanDomain}` : null,
        stats: {
            hunterCount,
            websiteCount,
            directorsCount,
            roleEmailsCount,
            verifiedCount,
            suggestedCount: suggestions.length,
            durationMs: Date.now() - startTime
        }
    };
}
