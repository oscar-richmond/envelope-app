import * as cheerio from 'cheerio';

/**
 * Enhanced Contact with full evidence tracking
 */
export interface EnhancedContact {
    email: string;
    name: string | null;
    role: string | null;
    type: 'person' | 'generic';
    confidence: 'verified' | 'likely' | 'guessed';
    source: 'website_mailto' | 'website_text' | 'team_page' | 'contact_page' | 'footer' | 'hunter' | 'pattern_guess';
    evidence: {
        url: string;
        snippet?: string;
        pageType?: string;
    };
    score: number;
}

/**
 * Discovery result with metadata
 */
export interface EnhancedDiscoveryResult {
    contacts: EnhancedContact[];
    meta: {
        domain: string;
        scannedPages: number;
        pagesVisited: string[];
        foundVerified: number;
        foundGeneric: number;
        foundGuessed: number;
        cached: boolean;
        timeTakenMs: number;
    };
}

// Page priority for crawling
const PAGE_PRIORITIES = [
    { path: '/', priority: 1, type: 'homepage' },
    { path: '/contact', priority: 2, type: 'contact' },
    { path: '/contact-us', priority: 2, type: 'contact' },
    { path: '/get-in-touch', priority: 2, type: 'contact' },
    { path: '/about', priority: 3, type: 'about' },
    { path: '/about-us', priority: 3, type: 'about' },
    { path: '/team', priority: 4, type: 'team' },
    { path: '/our-team', priority: 4, type: 'team' },
    { path: '/people', priority: 4, type: 'team' },
    { path: '/leadership', priority: 4, type: 'team' },
    { path: '/company', priority: 5, type: 'about' },
];

// Generic email prefixes
const GENERIC_PREFIXES = new Set([
    'info', 'contact', 'admin', 'support', 'sales', 'hello', 'hi', 'enquiries',
    'office', 'help', 'billing', 'accounts', 'hr', 'jobs', 'careers', 'marketing',
    'media', 'press', 'team', 'legal', 'finance', 'invoices', 'noreply', 'no-reply',
    'general', 'enquiry', 'bookings', 'reservations', 'orders', 'feedback'
]);

// Garbage email patterns
function isGarbageEmail(email: string): boolean {
    if (email.endsWith('.png') || email.endsWith('.jpg') || email.endsWith('.svg')) return true;
    if (email.includes('example.com') || email.includes('test')) return true;
    if (email.includes('sentry') || email.includes('wix.com') || email.includes('noreply')) return true;
    if (email.includes('wordpress') || email.includes('mailchimp') || email.includes('hubspot')) return true;
    if (email.length > 60 || email.length < 5) return true;
    if (!email.includes('@') || !email.includes('.')) return true;
    return false;
}

// Determine if email is personal (person) or generic
function getEmailType(email: string): 'person' | 'generic' {
    const [local] = email.split('@');
    const localLower = local.toLowerCase();

    // Check if it's a generic prefix
    if (GENERIC_PREFIXES.has(localLower)) return 'generic';

    // Check for role-based prefixes
    if (/^(sales|support|info|hello|contact|hr|careers|press|media|marketing|billing|accounts|legal|finance|team|admin|office|help|enquir)/i.test(localLower)) {
        return 'generic';
    }

    // Likely a person if it has separators (john.smith) or looks like a name
    if (/[._-]/.test(local) || /^[a-z]{2,}$/i.test(local)) {
        return 'person';
    }

    return 'person'; // Default to person for most cases
}

// Derive name from email local part
function deriveName(email: string): string | null {
    const [local] = email.split('@');
    if (!local || local.length < 3) return null;

    // Skip generics
    if (GENERIC_PREFIXES.has(local.toLowerCase())) return null;

    // Skip if contains numbers
    if (/\d/.test(local)) return null;

    // Split on separators and capitalize
    const parts = local.split(/[._-]/);
    if (parts.length === 0) return null;

    const capitalized = parts
        .filter(p => p.length > 0)
        .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase());

    return capitalized.join(' ');
}

// Clean snippet (max 140 chars, safe)
function cleanSnippet(text: string, maxLen = 140): string {
    return text
        .replace(/\s+/g, ' ')
        .replace(/[<>]/g, '')
        .trim()
        .substring(0, maxLen);
}

// Score contact based on source and type
function scoreContact(contact: Partial<EnhancedContact>): number {
    let score = 0;

    // Type scoring
    if (contact.type === 'person') score += 10;
    if (contact.type === 'generic') score += 2;

    // Confidence scoring
    if (contact.confidence === 'verified') score += 5;
    if (contact.confidence === 'likely') score += 3;
    if (contact.confidence === 'guessed') score += 0;

    // Source scoring
    if (contact.source === 'team_page') score += 8;
    if (contact.source === 'contact_page') score += 5;
    if (contact.source === 'website_mailto') score += 4;
    if (contact.source === 'website_text') score += 2;
    if (contact.source === 'footer') score += 1;
    if (contact.source === 'hunter') score += 3;
    if (contact.source === 'pattern_guess') score -= 5;

    // Name/role bonus
    if (contact.name) score += 3;
    if (contact.role) score += 2;

    return score;
}

/**
 * Enhanced Website Email Extractor
 * Extracts emails with evidence, team card parsing, and scoring
 */
export class EnhancedEmailExtractor {
    private readonly MAX_PAGES = 8;
    private readonly TIMEOUT_MS = 7000;
    private readonly TOTAL_TIMEOUT_MS = 20000;
    private readonly MAX_RESPONSE_SIZE = 2 * 1024 * 1024; // 2MB

    async extract(websiteUrl: string): Promise<EnhancedDiscoveryResult> {
        const startTime = Date.now();
        const contacts = new Map<string, EnhancedContact>();
        const pagesVisited: string[] = [];

        // Normalize URL
        let baseUrl = websiteUrl.trim().toLowerCase();
        if (!baseUrl.startsWith('http')) {
            baseUrl = 'https://' + baseUrl;
        }

        let domain: string;
        try {
            const parsed = new URL(baseUrl);
            domain = parsed.hostname.replace(/^www\./, '');
            baseUrl = parsed.origin;
        } catch (e) {
            return this.emptyResult(websiteUrl, startTime);
        }

        console.log(`[EmailExtractor] Starting extraction for: ${domain}`);

        // Build queue of pages to visit
        const queue: Array<{ url: string; type: string; priority: number }> = [];
        for (const page of PAGE_PRIORITIES) {
            queue.push({
                url: baseUrl + page.path,
                type: page.type,
                priority: page.priority
            });
        }

        // Sort by priority
        queue.sort((a, b) => a.priority - b.priority);

        // Crawl pages
        const visited = new Set<string>();

        for (const page of queue) {
            // Check limits
            if (visited.size >= this.MAX_PAGES) break;
            if (Date.now() - startTime > this.TOTAL_TIMEOUT_MS) {
                console.log(`[EmailExtractor] Total timeout reached after ${visited.size} pages`);
                break;
            }

            // Skip duplicates
            const normalizedUrl = page.url.replace(/\/$/, '');
            if (visited.has(normalizedUrl)) continue;
            visited.add(normalizedUrl);

            try {
                const pageContacts = await this.fetchAndExtract(page.url, page.type, domain);
                pagesVisited.push(page.url);

                // Merge contacts (prefer higher score)
                for (const contact of pageContacts) {
                    const existing = contacts.get(contact.email);
                    if (!existing || contact.score > existing.score) {
                        contacts.set(contact.email, contact);
                    }
                }

                console.log(`[EmailExtractor] ${page.type}: ${page.url} -> ${pageContacts.length} contacts`);

            } catch (err: any) {
                console.log(`[EmailExtractor] Failed to fetch ${page.url}: ${err.message}`);
            }
        }

        // Sort contacts by score
        const sortedContacts = Array.from(contacts.values())
            .sort((a, b) => b.score - a.score);

        // Count types
        const foundVerified = sortedContacts.filter(c => c.confidence === 'verified').length;
        const foundGeneric = sortedContacts.filter(c => c.type === 'generic').length;

        console.log(`[EmailExtractor] Done: ${sortedContacts.length} contacts (${foundVerified} verified, ${foundGeneric} generic)`);

        return {
            contacts: sortedContacts,
            meta: {
                domain,
                scannedPages: pagesVisited.length,
                pagesVisited,
                foundVerified,
                foundGeneric,
                foundGuessed: 0, // We'll add guesses separately if needed
                cached: false,
                timeTakenMs: Date.now() - startTime
            }
        };
    }

    private async fetchAndExtract(url: string, pageType: string, domain: string): Promise<EnhancedContact[]> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'EnvelopeBot/1.0 (email-discovery)',
                    'Accept': 'text/html',
                },
                signal: controller.signal,
                redirect: 'follow'
            });

            clearTimeout(timeoutId);

            if (!response.ok) return [];

            // Check size
            const contentLength = response.headers.get('content-length');
            if (contentLength && parseInt(contentLength) > this.MAX_RESPONSE_SIZE) {
                console.log(`[EmailExtractor] Skipping ${url} - too large`);
                return [];
            }

            const html = await response.text();
            if (html.length > this.MAX_RESPONSE_SIZE) {
                return [];
            }

            const $ = cheerio.load(html);
            const contacts: EnhancedContact[] = [];

            // 1. Extract mailto links
            $('a[href^="mailto:"]').each((_, el) => {
                const href = $(el).attr('href') || '';
                const email = href.replace('mailto:', '').split('?')[0].trim().toLowerCase();

                if (isGarbageEmail(email)) return;

                // Get context
                const anchorText = $(el).text().trim();
                const parentText = $(el).parent().text().trim();

                // Try to find name/role nearby
                const { name, role } = this.findNearbyNameRole($, el, email);

                const type = getEmailType(email);
                const isTeamPage = pageType === 'team';

                contacts.push({
                    email,
                    name: name || deriveName(email),
                    role,
                    type,
                    confidence: 'verified',
                    source: isTeamPage ? 'team_page' : (pageType === 'contact' ? 'contact_page' : 'website_mailto'),
                    evidence: {
                        url,
                        snippet: cleanSnippet(anchorText || parentText),
                        pageType
                    },
                    score: 0
                });
            });

            // 2. Extract text emails
            const bodyText = $('body').text();
            const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
            const textEmails = bodyText.match(emailRegex) || [];

            for (const rawEmail of textEmails) {
                const email = rawEmail.trim().toLowerCase();

                if (isGarbageEmail(email)) continue;
                if (contacts.find(c => c.email === email)) continue; // Skip if already found via mailto

                // Check if email belongs to this domain
                if (!email.endsWith('@' + domain) && !email.includes(domain.split('.')[0])) {
                    continue; // Skip external emails
                }

                // Get context snippet
                const index = bodyText.indexOf(rawEmail);
                const snippet = index > -1
                    ? bodyText.substring(Math.max(0, index - 50), Math.min(bodyText.length, index + rawEmail.length + 50))
                    : '';

                const type = getEmailType(email);
                const isTeamPage = pageType === 'team';

                contacts.push({
                    email,
                    name: deriveName(email),
                    role: this.inferRoleFromContext(snippet),
                    type,
                    confidence: 'likely', // Text emails are "likely" not "verified"
                    source: isTeamPage ? 'team_page' : 'website_text',
                    evidence: {
                        url,
                        snippet: cleanSnippet(snippet),
                        pageType
                    },
                    score: 0
                });
            }

            // 3. Check JSON-LD for Person/ContactPoint
            $('script[type="application/ld+json"]').each((_, el) => {
                try {
                    const json = JSON.parse($(el).html() || '{}');
                    this.extractFromJsonLd(json, url, pageType, contacts, domain);
                } catch (e) { }
            });

            // 4. Team card detection
            if (pageType === 'team') {
                this.extractTeamCards($, url, contacts, domain);
            }

            // Calculate scores
            for (const contact of contacts) {
                contact.score = scoreContact(contact);
            }

            return contacts;

        } catch (err: any) {
            clearTimeout(timeoutId);
            throw err;
        }
    }

    private findNearbyNameRole($: cheerio.CheerioAPI, el: cheerio.Element, email: string): { name: string | null; role: string | null } {
        // Look up DOM tree for name/role patterns
        let name: string | null = null;
        let role: string | null = null;

        // Check parent and grandparent
        const parent = $(el).parent();
        const grandparent = parent.parent();

        // Look for name patterns
        const nameSelectors = ['h2', 'h3', 'h4', '.name', '.person-name', '[itemprop="name"]'];
        for (const sel of nameSelectors) {
            const found = grandparent.find(sel).first().text().trim();
            if (found && found.length > 2 && found.length < 50 && !found.includes('@')) {
                name = found;
                break;
            }
        }

        // Look for role patterns
        const roleSelectors = ['.title', '.role', '.position', '.job-title', '[itemprop="jobTitle"]', 'p'];
        for (const sel of roleSelectors) {
            const found = grandparent.find(sel).first().text().trim();
            if (found && found.length > 2 && found.length < 60 && !found.includes('@') && found !== name) {
                role = found;
                break;
            }
        }

        return { name, role };
    }

    private inferRoleFromContext(snippet: string): string | null {
        const lower = snippet.toLowerCase();

        if (/founder|ceo|chief executive/i.test(lower)) return 'Founder/CEO';
        if (/cto|chief technology/i.test(lower)) return 'CTO';
        if (/cfo|chief financial/i.test(lower)) return 'CFO';
        if (/cmo|chief marketing/i.test(lower)) return 'CMO';
        if (/director/i.test(lower)) return 'Director';
        if (/manager/i.test(lower)) return 'Manager';
        if (/head of/i.test(lower)) return 'Head of Department';
        if (/sales/i.test(lower)) return 'Sales';
        if (/marketing/i.test(lower)) return 'Marketing';
        if (/support/i.test(lower)) return 'Support';
        if (/press|media/i.test(lower)) return 'Press/Media';
        if (/hr|human resources|careers/i.test(lower)) return 'HR';

        return null;
    }

    private extractFromJsonLd(json: any, url: string, pageType: string, contacts: EnhancedContact[], domain: string): void {
        if (!json) return;

        // Handle arrays
        if (Array.isArray(json)) {
            for (const item of json) {
                this.extractFromJsonLd(item, url, pageType, contacts, domain);
            }
            return;
        }

        // Check for Person type
        if (json['@type'] === 'Person' && json.email) {
            const email = json.email.replace('mailto:', '').toLowerCase();
            if (!isGarbageEmail(email) && !contacts.find(c => c.email === email)) {
                contacts.push({
                    email,
                    name: json.name || null,
                    role: json.jobTitle || null,
                    type: 'person',
                    confidence: 'verified',
                    source: 'team_page',
                    evidence: { url, snippet: `JSON-LD Person: ${json.name || email}`, pageType },
                    score: 0
                });
            }
        }

        // Check for ContactPoint
        if (json['@type'] === 'ContactPoint' && json.email) {
            const email = json.email.replace('mailto:', '').toLowerCase();
            if (!isGarbageEmail(email) && !contacts.find(c => c.email === email)) {
                contacts.push({
                    email,
                    name: null,
                    role: json.contactType || null,
                    type: 'generic',
                    confidence: 'verified',
                    source: 'contact_page',
                    evidence: { url, snippet: `JSON-LD ContactPoint: ${json.contactType || email}`, pageType },
                    score: 0
                });
            }
        }

        // Recurse into nested objects
        if (json['@graph']) {
            this.extractFromJsonLd(json['@graph'], url, pageType, contacts, domain);
        }
    }

    private extractTeamCards($: cheerio.CheerioAPI, url: string, contacts: EnhancedContact[], domain: string): void {
        // Common team card selectors
        const cardSelectors = [
            '.team-member',
            '.team-card',
            '.person-card',
            '.staff-member',
            '[itemtype*="Person"]',
            '.bio-card',
            '.member'
        ];

        for (const selector of cardSelectors) {
            $(selector).each((_, card) => {
                const $card = $(card);

                // Find email in card
                const mailto = $card.find('a[href^="mailto:"]').attr('href');
                if (!mailto) return;

                const email = mailto.replace('mailto:', '').split('?')[0].trim().toLowerCase();
                if (isGarbageEmail(email)) return;
                if (contacts.find(c => c.email === email)) return;

                // Find name
                let name: string | null = null;
                for (const sel of ['h2', 'h3', 'h4', '.name', '.person-name']) {
                    const text = $card.find(sel).first().text().trim();
                    if (text && text.length > 2 && text.length < 50 && !text.includes('@')) {
                        name = text;
                        break;
                    }
                }

                // Find role
                let role: string | null = null;
                for (const sel of ['.title', '.role', '.position', '.job-title', 'p']) {
                    const text = $card.find(sel).first().text().trim();
                    if (text && text.length > 2 && text.length < 60 && !text.includes('@') && text !== name) {
                        role = text;
                        break;
                    }
                }

                contacts.push({
                    email,
                    name: name || deriveName(email),
                    role,
                    type: 'person',
                    confidence: 'verified',
                    source: 'team_page',
                    evidence: {
                        url,
                        snippet: cleanSnippet([name, role].filter(Boolean).join(' - ')),
                        pageType: 'team'
                    },
                    score: 0
                });
            });
        }
    }

    private emptyResult(url: string, startTime: number): EnhancedDiscoveryResult {
        return {
            contacts: [],
            meta: {
                domain: url,
                scannedPages: 0,
                pagesVisited: [],
                foundVerified: 0,
                foundGeneric: 0,
                foundGuessed: 0,
                cached: false,
                timeTakenMs: Date.now() - startTime
            }
        };
    }

    /**
     * Generate guessed emails as fallback
     */
    generateGuessedEmails(domain: string): EnhancedContact[] {
        const guesses = ['info', 'hello', 'contact', 'sales', 'support'];

        return guesses.map(prefix => ({
            email: `${prefix}@${domain}`,
            name: prefix.charAt(0).toUpperCase() + prefix.slice(1),
            role: prefix === 'sales' ? 'Sales' : prefix === 'support' ? 'Support' : 'General',
            type: 'generic' as const,
            confidence: 'guessed' as const,
            source: 'pattern_guess' as const,
            evidence: { url: '', snippet: 'Generated based on common patterns', pageType: 'none' },
            score: -5
        }));
    }
}

export const enhancedEmailExtractor = new EnhancedEmailExtractor();
