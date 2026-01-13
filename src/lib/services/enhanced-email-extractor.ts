import * as cheerio from 'cheerio';

/**
 * Phase 1 Enhanced Contact with full evidence tracking and scoring
 */
export interface EnhancedContact {
    email: string;
    name: string | null;
    role: string | null;
    type: 'person' | 'generic';
    confidence: 'verified' | 'likely' | 'guessed';
    source: 'website_mailto' | 'website_text' | 'pdf' | 'jsonld' | 'team_page' | 'contact_page' | 'pattern_guess';
    evidence: {
        url: string;
        snippet?: string;
        pageType?: string;
    };
    score: number;
    isGeneric: boolean;
}

/**
 * Discovery result with metadata
 */
export interface EnhancedDiscoveryResult {
    contacts: EnhancedContact[];
    meta: {
        domain: string;
        scannedPages: number;
        scannedPdfs: number;
        pagesVisited: string[];
        foundTotal: number;
        foundNonGeneric: number;
        foundVerified: number;
        foundGeneric: number;
        cached: boolean;
        timeTakenMs: number;
    };
}

// ============================================
// URL PATTERNS FOR DISCOVERY
// ============================================
const URL_PATTERNS = [
    // Contact pages
    { pattern: /\/(contact|contact-us|get-in-touch|kontakt)/i, type: 'contact', priority: 2 },
    // About pages
    { pattern: /\/(about|about-us|who-we-are|company)/i, type: 'about', priority: 3 },
    // Team pages (high value)
    { pattern: /\/(team|our-team|people|leadership|management|staff|meet-the-team)/i, type: 'team', priority: 1 },
    // Partners/sales (high value)
    { pattern: /\/(partners|partnerships|partner-with-us|become-a-partner)/i, type: 'partners', priority: 2 },
    // Careers
    { pattern: /\/(careers|jobs|join-us|work-with-us|vacancies)/i, type: 'careers', priority: 4 },
    // Press/Media
    { pattern: /\/(press|media|news|newsroom)/i, type: 'press', priority: 4 },
    // Legal (often has DPO emails)
    { pattern: /\/(privacy|privacy-policy|terms|legal|imprint|impressum|gdpr)/i, type: 'legal', priority: 5 },
    // Services
    { pattern: /\/(services|work|case-studies|portfolio)/i, type: 'services', priority: 6 },
];

// ============================================
// ROLE INFERENCE FROM EMAIL PREFIX
// ============================================
const ROLE_FROM_PREFIX: Record<string, { role: string; category: string; baseScore: number }> = {
    // Sales/Partnerships (high value)
    'sales': { role: 'Sales', category: 'sales', baseScore: 25 },
    'bizdev': { role: 'Business Development', category: 'sales', baseScore: 25 },
    'partnerships': { role: 'Partnerships', category: 'sales', baseScore: 25 },
    'partners': { role: 'Partnerships', category: 'sales', baseScore: 25 },
    'marketing': { role: 'Marketing', category: 'marketing', baseScore: 25 },
    'growth': { role: 'Growth', category: 'sales', baseScore: 25 },
    // Careers
    'careers': { role: 'Careers', category: 'careers', baseScore: 15 },
    'jobs': { role: 'Careers', category: 'careers', baseScore: 15 },
    'hr': { role: 'HR', category: 'careers', baseScore: 15 },
    'talent': { role: 'Talent', category: 'careers', baseScore: 15 },
    'recruitment': { role: 'Recruitment', category: 'careers', baseScore: 15 },
    // Finance
    'accounts': { role: 'Accounts', category: 'finance', baseScore: 12 },
    'billing': { role: 'Billing', category: 'finance', baseScore: 12 },
    'finance': { role: 'Finance', category: 'finance', baseScore: 12 },
    'invoices': { role: 'Accounts', category: 'finance', baseScore: 12 },
    // Press/Media
    'press': { role: 'Press', category: 'press', baseScore: 10 },
    'media': { role: 'Media', category: 'press', baseScore: 10 },
    'pr': { role: 'PR', category: 'press', baseScore: 10 },
    // Legal
    'legal': { role: 'Legal', category: 'legal', baseScore: 8 },
    'dpo': { role: 'Data Protection', category: 'legal', baseScore: 8 },
    'data': { role: 'Data Protection', category: 'legal', baseScore: 8 },
    'privacy': { role: 'Privacy', category: 'legal', baseScore: 8 },
    'gdpr': { role: 'Data Protection', category: 'legal', baseScore: 8 },
    // Support
    'support': { role: 'Support', category: 'support', baseScore: 6 },
    'help': { role: 'Support', category: 'support', baseScore: 6 },
    'helpdesk': { role: 'Support', category: 'support', baseScore: 6 },
    'tech': { role: 'Technical Support', category: 'support', baseScore: 6 },
    // Generic (low value)
    'info': { role: 'Enquiries', category: 'generic', baseScore: 0 },
    'hello': { role: 'Enquiries', category: 'generic', baseScore: 0 },
    'hi': { role: 'Enquiries', category: 'generic', baseScore: 0 },
    'contact': { role: 'Enquiries', category: 'generic', baseScore: 0 },
    'enquiries': { role: 'Enquiries', category: 'generic', baseScore: 0 },
    'enquiry': { role: 'Enquiries', category: 'generic', baseScore: 0 },
    'general': { role: 'General', category: 'generic', baseScore: 0 },
    'office': { role: 'Office', category: 'generic', baseScore: 0 },
    'admin': { role: 'Admin', category: 'generic', baseScore: 0 },
    'team': { role: 'Team', category: 'generic', baseScore: 0 },
};

// Role inference from page type
const ROLE_FROM_PAGE: Record<string, string> = {
    'careers': 'Careers',
    'press': 'Press',
    'legal': 'Legal/Data Protection',
    'partners': 'Partnerships',
    'contact': 'Enquiries',
    'team': 'Team Member',
};

// ============================================
// SCORING FUNCTIONS
// ============================================

function isPersonalEmail(email: string): boolean {
    const [local] = email.split('@');
    // Contains dot/underscore/dash separator (john.doe, j_smith)
    if (/[._-]/.test(local)) return true;
    // Single name without generic prefix
    const genericPrefixes = Object.keys(ROLE_FROM_PREFIX);
    if (!genericPrefixes.includes(local.toLowerCase())) return true;
    return false;
}

function isNoReply(email: string): boolean {
    const [local] = email.split('@');
    return /no-?reply|do-?not-?reply|mailer-daemon|bounce/i.test(local);
}

function getEmailCategory(email: string): { role: string | null; category: string; baseScore: number } {
    const [local] = email.split('@');
    const localLower = local.toLowerCase();

    // Check noreply first
    if (isNoReply(email)) {
        return { role: null, category: 'noreply', baseScore: -50 };
    }

    // Check for exact prefix match
    if (ROLE_FROM_PREFIX[localLower]) {
        return ROLE_FROM_PREFIX[localLower];
    }

    // Check for partial prefix match
    for (const [prefix, info] of Object.entries(ROLE_FROM_PREFIX)) {
        if (localLower.startsWith(prefix)) {
            return info;
        }
    }

    // Personal-looking email
    if (isPersonalEmail(email)) {
        return { role: null, category: 'personal', baseScore: 30 };
    }

    return { role: null, category: 'unknown', baseScore: 5 };
}

function getEvidenceScore(source: string): number {
    switch (source) {
        case 'website_mailto': return 20;
        case 'pdf': return 18;
        case 'website_text': return 15;
        case 'jsonld': return 12;
        case 'team_page':
        case 'contact_page':
            return 15;
        default:
            return 0;
    }
}

function calculateScore(contact: Partial<EnhancedContact>): number {
    const emailCategory = getEmailCategory(contact.email || '');
    let score = emailCategory.baseScore;

    // Add evidence score
    score += getEvidenceScore(contact.source || '');

    // Bonus for name
    if (contact.name) score += 5;

    // Bonus for role
    if (contact.role) score += 3;

    // Bonus for team page
    if (contact.evidence?.pageType === 'team') score += 8;

    return score;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function isGarbageEmail(email: string): boolean {
    if (!email || !email.includes('@') || !email.includes('.')) return true;
    if (email.length > 60 || email.length < 5) return true;
    if (email.endsWith('.png') || email.endsWith('.jpg') || email.endsWith('.svg')) return true;
    if (/example\.com|test@|sentry|wix\.com|wordpress|mailchimp|hubspot|cloudflare/i.test(email)) return true;
    if (isNoReply(email)) return true;
    return false;
}

function cleanSnippet(text: string, maxLen = 140): string {
    return text
        .replace(/\s+/g, ' ')
        .replace(/[<>]/g, '')
        .trim()
        .substring(0, maxLen);
}

function deriveName(email: string): string | null {
    const [local] = email.split('@');
    if (!local || local.length < 3) return null;
    if (ROLE_FROM_PREFIX[local.toLowerCase()]) return null;
    if (/\d/.test(local)) return null;

    const parts = local.split(/[._-]/);
    if (parts.length === 0) return null;

    const capitalized = parts
        .filter(p => p.length > 0)
        .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase());

    return capitalized.join(' ');
}

function inferRole(email: string, pageType: string): string | null {
    // First try prefix-based
    const category = getEmailCategory(email);
    if (category.role) return category.role;

    // Then try page-based
    if (ROLE_FROM_PAGE[pageType]) return ROLE_FROM_PAGE[pageType];

    return null;
}

// ============================================
// ENHANCED EMAIL EXTRACTOR
// ============================================

export class EnhancedEmailExtractor {
    private readonly MAX_HTML_PAGES = 10;
    private readonly MAX_PDFS = 6;
    private readonly PAGE_TIMEOUT_MS = 8000;
    private readonly PDF_TIMEOUT_MS = 10000;
    private readonly TOTAL_TIMEOUT_MS = 25000;
    private readonly MAX_HTML_SIZE = 2 * 1024 * 1024; // 2MB
    private readonly MAX_PDF_SIZE = 5 * 1024 * 1024; // 5MB

    async extract(websiteUrl: string): Promise<EnhancedDiscoveryResult> {
        const startTime = Date.now();
        const contacts = new Map<string, EnhancedContact>();
        const pagesVisited: string[] = [];
        let pdfCount = 0;

        // Normalize URL
        let baseUrl = websiteUrl.trim();
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

        console.log(`[EmailExtractor] Starting Phase 1 extraction for: ${domain}`);

        // 1. Fetch homepage and discover URLs
        const candidateUrls = await this.discoverUrls(baseUrl, domain, startTime);
        console.log(`[EmailExtractor] Found ${candidateUrls.length} candidate URLs`);

        // 2. Track PDFs to fetch
        const pdfUrls: string[] = [];

        // 3. Crawl HTML pages
        const visited = new Set<string>();

        for (const candidate of candidateUrls) {
            if (visited.size >= this.MAX_HTML_PAGES) break;
            if (Date.now() - startTime > this.TOTAL_TIMEOUT_MS) {
                console.log(`[EmailExtractor] Timeout after ${visited.size} pages`);
                break;
            }

            const normalizedUrl = candidate.url.replace(/\/$/, '');
            if (visited.has(normalizedUrl)) continue;
            visited.add(normalizedUrl);

            try {
                const result = await this.fetchAndExtractHtml(candidate.url, candidate.type, domain);
                pagesVisited.push(candidate.url);

                // Add PDFs found on this page
                for (const pdfUrl of result.pdfLinks) {
                    if (pdfUrls.length < this.MAX_PDFS && !pdfUrls.includes(pdfUrl)) {
                        pdfUrls.push(pdfUrl);
                    }
                }

                // Merge contacts
                for (const contact of result.contacts) {
                    const existing = contacts.get(contact.email);
                    if (!existing || contact.score > existing.score) {
                        contacts.set(contact.email, contact);
                    }
                }

                console.log(`[EmailExtractor] ${candidate.type}: ${candidate.url} -> ${result.contacts.length} contacts`);

            } catch (err: any) {
                console.log(`[EmailExtractor] Failed: ${candidate.url}: ${err.message}`);
            }
        }

        // 4. Extract emails from PDFs
        for (const pdfUrl of pdfUrls) {
            if (pdfCount >= this.MAX_PDFS) break;
            if (Date.now() - startTime > this.TOTAL_TIMEOUT_MS) break;

            try {
                const pdfContacts = await this.extractFromPdf(pdfUrl, domain);
                pdfCount++;

                for (const contact of pdfContacts) {
                    const existing = contacts.get(contact.email);
                    if (!existing || contact.score > existing.score) {
                        contacts.set(contact.email, contact);
                    }
                }

                console.log(`[EmailExtractor] PDF: ${pdfUrl} -> ${pdfContacts.length} contacts`);

            } catch (err: any) {
                console.log(`[EmailExtractor] PDF failed: ${pdfUrl}: ${err.message}`);
            }
        }

        // 5. Sort by score (highest first)
        const sortedContacts = Array.from(contacts.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, 100); // Increased from 12 to 100

        // 6. Calculate stats
        const nonGeneric = sortedContacts.filter(c => !c.isGeneric).length;
        const verified = sortedContacts.filter(c => c.confidence === 'verified').length;
        const generic = sortedContacts.filter(c => c.isGeneric).length;

        console.log(`[EmailExtractor] Done: ${sortedContacts.length} contacts (${nonGeneric} non-generic, ${pdfCount} PDFs)`);

        return {
            contacts: sortedContacts,
            meta: {
                domain,
                scannedPages: pagesVisited.length,
                scannedPdfs: pdfCount,
                pagesVisited,
                foundTotal: sortedContacts.length,
                foundNonGeneric: nonGeneric,
                foundVerified: verified,
                foundGeneric: generic,
                cached: false,
                timeTakenMs: Date.now() - startTime
            }
        };
    }

    private async discoverUrls(baseUrl: string, domain: string, startTime: number): Promise<Array<{ url: string; type: string; priority: number }>> {
        const urls: Array<{ url: string; type: string; priority: number }> = [
            { url: baseUrl, type: 'homepage', priority: 0 }
        ];

        try {
            // Fetch homepage
            const response = await fetch(baseUrl, {
                headers: { 'User-Agent': 'EnvelopeBot/1.0 (email-discovery)' },
                signal: AbortSignal.timeout(this.PAGE_TIMEOUT_MS)
            });

            if (!response.ok) return urls;

            const html = await response.text();
            const $ = cheerio.load(html);

            // Find all internal links
            $('a[href]').each((_, el) => {
                const href = $(el).attr('href');
                if (!href) return;

                try {
                    const absoluteUrl = new URL(href, baseUrl).toString();

                    // Only internal links
                    if (!absoluteUrl.includes(domain)) return;

                    // Check against patterns
                    for (const pattern of URL_PATTERNS) {
                        if (pattern.pattern.test(absoluteUrl)) {
                            const normalizedUrl = absoluteUrl.replace(/\/$/, '');
                            if (!urls.find(u => u.url === normalizedUrl)) {
                                urls.push({
                                    url: normalizedUrl,
                                    type: pattern.type,
                                    priority: pattern.priority
                                });
                            }
                            break;
                        }
                    }
                } catch (e) { }
            });

            // Try sitemap.xml
            if (Date.now() - startTime < this.TOTAL_TIMEOUT_MS / 2) {
                try {
                    const sitemapUrls = await this.parseSitemap(baseUrl, domain);
                    for (const sUrl of sitemapUrls) {
                        if (!urls.find(u => u.url === sUrl.url)) {
                            urls.push(sUrl);
                        }
                    }
                } catch (e) { }
            }

        } catch (err: any) {
            console.log(`[EmailExtractor] Homepage fetch failed: ${err.message}`);
        }

        // Sort by priority and limit
        return urls.sort((a, b) => a.priority - b.priority).slice(0, 20);
    }

    private async parseSitemap(baseUrl: string, domain: string): Promise<Array<{ url: string; type: string; priority: number }>> {
        const urls: Array<{ url: string; type: string; priority: number }> = [];

        try {
            const response = await fetch(`${baseUrl}/sitemap.xml`, {
                headers: { 'User-Agent': 'EnvelopeBot/1.0' },
                signal: AbortSignal.timeout(5000)
            });

            if (!response.ok) return urls;

            const contentLength = response.headers.get('content-length');
            if (contentLength && parseInt(contentLength) > 2 * 1024 * 1024) return urls;

            const xml = await response.text();

            // Simple regex extraction of URLs from sitemap
            const urlMatches = xml.match(/<loc>([^<]+)<\/loc>/gi) || [];

            for (const match of urlMatches) {
                const url = match.replace(/<\/?loc>/gi, '');

                for (const pattern of URL_PATTERNS) {
                    if (pattern.pattern.test(url)) {
                        urls.push({ url, type: pattern.type, priority: pattern.priority });
                        break;
                    }
                }
            }
        } catch (e) { }

        return urls;
    }

    private async fetchAndExtractHtml(url: string, pageType: string, domain: string): Promise<{ contacts: EnhancedContact[]; pdfLinks: string[] }> {
        const contacts: EnhancedContact[] = [];
        const pdfLinks: string[] = [];

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'EnvelopeBot/1.0 (email-discovery)',
                'Accept': 'text/html',
            },
            signal: AbortSignal.timeout(this.PAGE_TIMEOUT_MS)
        });

        if (!response.ok) return { contacts, pdfLinks };

        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength) > this.MAX_HTML_SIZE) {
            return { contacts, pdfLinks };
        }

        const html = await response.text();
        if (html.length > this.MAX_HTML_SIZE) return { contacts, pdfLinks };

        const $ = cheerio.load(html);

        // Find PDF links
        $('a[href$=".pdf"]').each((_, el) => {
            const href = $(el).attr('href');
            if (href) {
                try {
                    const pdfUrl = new URL(href, url).toString();
                    pdfLinks.push(pdfUrl);
                } catch (e) { }
            }
        });

        // Extract mailto links
        $('a[href^="mailto:"]').each((_, el) => {
            const href = $(el).attr('href') || '';
            const email = href.replace('mailto:', '').split('?')[0].trim().toLowerCase();

            if (isGarbageEmail(email)) return;
            if (contacts.find(c => c.email === email)) return;

            const anchorText = $(el).text().trim();
            const { name, role: nearbyRole } = this.findNearbyNameRole($, el);
            const inferredRole = inferRole(email, pageType);
            const category = getEmailCategory(email);

            const contact: EnhancedContact = {
                email,
                name: name || deriveName(email),
                role: nearbyRole || inferredRole,
                type: category.category === 'personal' ? 'person' : 'generic',
                confidence: 'verified',
                source: 'website_mailto',
                evidence: { url, snippet: cleanSnippet(anchorText), pageType },
                score: 0,
                isGeneric: category.category === 'generic'
            };
            contact.score = calculateScore(contact);
            contacts.push(contact);
        });

        // Extract text emails
        const bodyText = $('body').text();
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
        const textEmails = bodyText.match(emailRegex) || [];

        for (const rawEmail of textEmails) {
            const email = rawEmail.trim().toLowerCase();

            if (isGarbageEmail(email)) continue;
            if (contacts.find(c => c.email === email)) continue;
            if (!email.endsWith('@' + domain)) continue;

            const index = bodyText.indexOf(rawEmail);
            const snippet = index > -1
                ? bodyText.substring(Math.max(0, index - 50), Math.min(bodyText.length, index + rawEmail.length + 50))
                : '';

            const category = getEmailCategory(email);
            const inferredRole = inferRole(email, pageType);

            const contact: EnhancedContact = {
                email,
                name: deriveName(email),
                role: inferredRole,
                type: category.category === 'personal' ? 'person' : 'generic',
                confidence: 'likely',
                source: 'website_text',
                evidence: { url, snippet: cleanSnippet(snippet), pageType },
                score: 0,
                isGeneric: category.category === 'generic'
            };
            contact.score = calculateScore(contact);
            contacts.push(contact);
        }

        // Extract from JSON-LD
        $('script[type="application/ld+json"]').each((_, el) => {
            try {
                const json = JSON.parse($(el).html() || '{}');
                this.extractFromJsonLd(json, url, pageType, contacts, domain);
            } catch (e) { }
        });

        return { contacts, pdfLinks };
    }

    private async extractFromPdf(pdfUrl: string, domain: string): Promise<EnhancedContact[]> {
        const contacts: EnhancedContact[] = [];

        try {
            const response = await fetch(pdfUrl, {
                headers: { 'User-Agent': 'EnvelopeBot/1.0' },
                signal: AbortSignal.timeout(this.PDF_TIMEOUT_MS)
            });

            if (!response.ok) return contacts;

            const contentLength = response.headers.get('content-length');
            if (contentLength && parseInt(contentLength) > this.MAX_PDF_SIZE) {
                return contacts;
            }

            // Get PDF as ArrayBuffer and extract text
            const buffer = await response.arrayBuffer();
            const text = await this.extractTextFromPdf(buffer);

            // Find emails in text
            const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
            const matches = text.match(emailRegex) || [];

            for (const rawEmail of matches) {
                const email = rawEmail.trim().toLowerCase();

                if (isGarbageEmail(email)) continue;
                if (contacts.find(c => c.email === email)) continue;
                if (!email.endsWith('@' + domain)) continue;

                // Get context
                const index = text.indexOf(rawEmail);
                const snippet = index > -1
                    ? text.substring(Math.max(0, index - 50), Math.min(text.length, index + rawEmail.length + 50))
                    : '';

                const category = getEmailCategory(email);

                const contact: EnhancedContact = {
                    email,
                    name: deriveName(email),
                    role: category.role || null,
                    type: category.category === 'personal' ? 'person' : 'generic',
                    confidence: 'verified',
                    source: 'pdf',
                    evidence: { url: pdfUrl, snippet: cleanSnippet(snippet), pageType: 'pdf' },
                    score: 0,
                    isGeneric: category.category === 'generic'
                };
                contact.score = calculateScore(contact);
                contacts.push(contact);
            }
        } catch (err: any) {
            console.log(`[EmailExtractor] PDF error: ${err.message}`);
        }

        return contacts;
    }

    private async extractTextFromPdf(buffer: ArrayBuffer): Promise<string> {
        // Simple PDF text extraction using binary string search
        // In production, use pdf-parse or similar library
        try {
            const bytes = new Uint8Array(buffer);
            let text = '';

            // Convert to string for regex search
            const decoder = new TextDecoder('utf-8', { fatal: false });
            const rawText = decoder.decode(bytes);

            // Extract text between stream/endstream, BT/ET
            const streamMatches = rawText.match(/stream[\r\n]+(.+?)[\r\n]+endstream/gs) || [];
            for (const match of streamMatches) {
                // Try to decode text content
                const content = match.replace(/stream[\r\n]+|[\r\n]+endstream/g, '');
                if (content.length < 10000) { // Limit per stream
                    text += content + ' ';
                }
            }

            // Also search for plain text patterns
            const textMatches = rawText.match(/\(([^)]+)\)/g) || [];
            for (const match of textMatches) {
                const inner = match.slice(1, -1);
                if (inner.length > 3 && inner.length < 200) {
                    text += inner + ' ';
                }
            }

            return text;
        } catch (e) {
            return '';
        }
    }

    private findNearbyNameRole($: cheerio.CheerioAPI, el: cheerio.Element): { name: string | null; role: string | null } {
        let name: string | null = null;
        let role: string | null = null;

        const parent = $(el).parent();
        const grandparent = parent.parent();

        for (const sel of ['h2', 'h3', 'h4', '.name', '.person-name', '[itemprop="name"]']) {
            const found = grandparent.find(sel).first().text().trim();
            if (found && found.length > 2 && found.length < 50 && !found.includes('@')) {
                name = found;
                break;
            }
        }

        for (const sel of ['.title', '.role', '.position', '.job-title', '[itemprop="jobTitle"]']) {
            const found = grandparent.find(sel).first().text().trim();
            if (found && found.length > 2 && found.length < 60 && !found.includes('@') && found !== name) {
                role = found;
                break;
            }
        }

        return { name, role };
    }

    private extractFromJsonLd(json: any, url: string, pageType: string, contacts: EnhancedContact[], domain: string): void {
        if (!json) return;

        if (Array.isArray(json)) {
            for (const item of json) {
                this.extractFromJsonLd(item, url, pageType, contacts, domain);
            }
            return;
        }

        if (json['@type'] === 'Person' && json.email) {
            const email = json.email.replace('mailto:', '').toLowerCase();
            if (!isGarbageEmail(email) && !contacts.find(c => c.email === email)) {
                const category = getEmailCategory(email);
                const contact: EnhancedContact = {
                    email,
                    name: json.name || null,
                    role: json.jobTitle || null,
                    type: 'person',
                    confidence: 'verified',
                    source: 'jsonld',
                    evidence: { url, snippet: `JSON-LD Person: ${json.name || email}`, pageType },
                    score: 0,
                    isGeneric: false
                };
                contact.score = calculateScore(contact);
                contacts.push(contact);
            }
        }

        if (json['@type'] === 'ContactPoint' && json.email) {
            const email = json.email.replace('mailto:', '').toLowerCase();
            if (!isGarbageEmail(email) && !contacts.find(c => c.email === email)) {
                const category = getEmailCategory(email);
                const contact: EnhancedContact = {
                    email,
                    name: null,
                    role: json.contactType || null,
                    type: 'generic',
                    confidence: 'verified',
                    source: 'jsonld',
                    evidence: { url, snippet: `JSON-LD ContactPoint: ${json.contactType || email}`, pageType },
                    score: 0,
                    isGeneric: true
                };
                contact.score = calculateScore(contact);
                contacts.push(contact);
            }
        }

        if (json['@graph']) {
            this.extractFromJsonLd(json['@graph'], url, pageType, contacts, domain);
        }
    }

    private emptyResult(url: string, startTime: number): EnhancedDiscoveryResult {
        return {
            contacts: [],
            meta: {
                domain: url,
                scannedPages: 0,
                scannedPdfs: 0,
                pagesVisited: [],
                foundTotal: 0,
                foundNonGeneric: 0,
                foundVerified: 0,
                foundGeneric: 0,
                cached: false,
                timeTakenMs: Date.now() - startTime
            }
        };
    }
}

export const enhancedEmailExtractor = new EnhancedEmailExtractor();
