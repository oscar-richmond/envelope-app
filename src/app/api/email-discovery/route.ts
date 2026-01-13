export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

// ============================================
// TYPES
// ============================================

interface DiscoveredEmail {
    email: string;
    name: string | null;
    role: string | null;
    confidence: 'high' | 'medium' | 'low';
    sources: Array<{
        url: string;
        snippet: string;
        pageType: string;
    }>;
    isGeneric: boolean;
    score: number;
}

interface DiscoveryResult {
    emails: DiscoveredEmail[];
    crawlStats: {
        pagesVisited: number;
        pagesTotal: number;
        durationMs: number;
    };
    detectedPatterns: string[];
}

interface DiscoveryRequest {
    domain: string;
    seedUrl?: string;
    maxPages?: number;
}

// ============================================
// CONSTANTS
// ============================================

const MAX_PAGES = 25;
const PAGE_TIMEOUT_MS = 8000;
const TOTAL_TIMEOUT_MS = 12000;
const REQUEST_DELAY_MS = 300;
const MAX_RESPONSE_SIZE = 2 * 1024 * 1024;

// Crawl priority (lower = higher priority)
const URL_PRIORITY: Array<{ pattern: RegExp; priority: number; type: string }> = [
    // Team pages (highest priority)
    { pattern: /\/(team|our-team|people|leadership|staff|management|about-us\/team)/i, priority: 1, type: 'team' },
    // Contact pages
    { pattern: /\/(contact|contact-us|get-in-touch|reach-us)/i, priority: 2, type: 'contact' },
    // About pages
    { pattern: /\/(about|about-us|company|who-we-are)/i, priority: 3, type: 'about' },
    // Careers pages
    { pattern: /\/(careers|jobs|work-with-us|join-us|vacancies)/i, priority: 4, type: 'careers' },
    // Partners/Press
    { pattern: /\/(partners|partnerships|press|media|news)/i, priority: 5, type: 'press' },
    // Legal (DPO emails)
    { pattern: /\/(privacy|legal|gdpr|imprint|impressum)/i, priority: 6, type: 'legal' },
];

// Generic email prefixes
const GENERIC_PREFIXES = new Set([
    'info', 'contact', 'hello', 'hi', 'enquiries', 'enquiry', 'general',
    'admin', 'office', 'team', 'support', 'help', 'sales', 'marketing',
    'hr', 'careers', 'jobs', 'press', 'media', 'legal', 'billing', 'accounts'
]);

// Role keywords for inference
const ROLE_KEYWORDS: Record<string, string> = {
    'ceo': 'CEO',
    'chief executive': 'CEO',
    'founder': 'Founder',
    'co-founder': 'Co-Founder',
    'cto': 'CTO',
    'cfo': 'CFO',
    'coo': 'COO',
    'cmo': 'CMO',
    'director': 'Director',
    'manager': 'Manager',
    'head of': 'Head of Department',
    'vp': 'VP',
    'vice president': 'VP',
    'partner': 'Partner',
    'principal': 'Principal',
    'lead': 'Lead',
    'senior': 'Senior',
};

// ============================================
// HELPERS
// ============================================

function generateRequestId(): string {
    return `disc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getHeaders(requestId: string) {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json; charset=utf-8',
        'X-Request-Id': requestId,
    };
}

function normalizeDomain(input: string): { domain: string; baseUrl: string } {
    let url = input.trim();
    if (!url.startsWith('http')) url = 'https://' + url;

    try {
        const parsed = new URL(url);
        const domain = parsed.hostname.replace(/^www\./, '');
        return { domain, baseUrl: parsed.origin };
    } catch {
        const domain = input.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
        return { domain, baseUrl: `https://${domain}` };
    }
}

function isGarbageEmail(email: string): boolean {
    if (!email || !email.includes('@') || !email.includes('.')) return true;
    if (email.length > 60 || email.length < 5) return true;
    if (/\.(png|jpg|svg|gif|pdf)$/i.test(email)) return true;
    if (/example\.com|test@|sentry|wix\.com|wordpress|mailchimp|hubspot|cloudflare|noreply|no-reply|mailer-daemon/i.test(email)) return true;
    return false;
}

function isGenericEmail(email: string): boolean {
    const [local] = email.split('@');
    return GENERIC_PREFIXES.has(local.toLowerCase());
}

function deriveName(email: string): string | null {
    const [local] = email.split('@');
    if (!local || local.length < 3) return null;
    if (GENERIC_PREFIXES.has(local.toLowerCase())) return null;
    if (/\d/.test(local)) return null;

    const parts = local.split(/[._-]/);
    if (parts.length === 0) return null;

    return parts
        .filter(p => p.length > 0)
        .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
        .join(' ');
}

function cleanSnippet(text: string, maxLen = 140): string {
    return text.replace(/\s+/g, ' ').replace(/[<>]/g, '').trim().substring(0, maxLen);
}

// ============================================
// EMAIL EXTRACTION
// ============================================

// Standard email regex
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;

// Obfuscated patterns
const OBFUSCATED_PATTERNS = [
    // name [at] domain [dot] com
    /([a-zA-Z0-9._%+-]+)\s*\[at\]\s*([a-zA-Z0-9.-]+)\s*\[dot\]\s*([a-zA-Z]{2,})/gi,
    // name (at) domain (dot) com
    /([a-zA-Z0-9._%+-]+)\s*\(at\)\s*([a-zA-Z0-9.-]+)\s*\(dot\)\s*([a-zA-Z]{2,})/gi,
    // name [at] domain.com
    /([a-zA-Z0-9._%+-]+)\s*\[at\]\s*([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
    // name (at) domain.com
    /([a-zA-Z0-9._%+-]+)\s*\(at\)\s*([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
];

function extractEmails(text: string, domain: string): string[] {
    const emails = new Set<string>();

    // Decode HTML entities
    const decoded = text
        .replace(/&#64;/g, '@')
        .replace(/&#46;/g, '.')
        .replace(/&commat;/g, '@')
        .replace(/&period;/g, '.');

    // Standard regex
    const matches = decoded.match(EMAIL_REGEX) || [];
    for (const match of matches) {
        const email = match.toLowerCase();
        if (!isGarbageEmail(email) && email.endsWith('@' + domain)) {
            emails.add(email);
        }
    }

    // Obfuscated patterns
    for (const pattern of OBFUSCATED_PATTERNS) {
        let match;
        const regex = new RegExp(pattern.source, pattern.flags);
        while ((match = regex.exec(decoded)) !== null) {
            let email: string;
            if (match.length === 4) {
                // [at] ... [dot]
                email = `${match[1]}@${match[2]}.${match[3]}`.toLowerCase();
            } else {
                // [at] domain.com
                email = `${match[1]}@${match[2]}`.toLowerCase();
            }
            if (!isGarbageEmail(email) && email.endsWith('@' + domain)) {
                emails.add(email);
            }
        }
    }

    return Array.from(emails);
}

// ============================================
// NAME/ROLE EXTRACTION
// ============================================

function findNearbyNameRole($: cheerio.CheerioAPI, element: cheerio.Element): { name: string | null; role: string | null } {
    let name: string | null = null;
    let role: string | null = null;

    // Check parent containers (card, list item)
    const parent = $(element).parent();
    const grandparent = parent.parent();
    const greatGrandparent = grandparent.parent();

    // Look for name in nearby heading/span
    for (const container of [parent, grandparent, greatGrandparent]) {
        if (name) break;

        for (const sel of ['h2', 'h3', 'h4', 'h5', '.name', '.person-name', '[itemprop="name"]', 'strong']) {
            const found = container.find(sel).first().text().trim();
            if (found && found.length > 2 && found.length < 50 && !found.includes('@') && /^[A-Z]/.test(found)) {
                name = found;
                break;
            }
        }
    }

    // Look for role
    for (const container of [parent, grandparent, greatGrandparent]) {
        if (role) break;

        for (const sel of ['.title', '.role', '.position', '.job-title', '[itemprop="jobTitle"]', 'em', 'small']) {
            const found = container.find(sel).first().text().trim();
            if (found && found.length > 2 && found.length < 80 && !found.includes('@') && found !== name) {
                role = found;
                break;
            }
        }
    }

    // Try to infer role from surrounding text
    if (!role) {
        const surroundingText = greatGrandparent.text().toLowerCase();
        for (const [keyword, roleLabel] of Object.entries(ROLE_KEYWORDS)) {
            if (surroundingText.includes(keyword)) {
                role = roleLabel;
                break;
            }
        }
    }

    return { name, role };
}

// ============================================
// SCORING
// ============================================

function scoreEmail(email: DiscoveredEmail): number {
    let score = 0;

    // Type scoring
    if (!email.isGeneric) score += 30;

    // Confidence scoring
    if (email.confidence === 'high') score += 20;
    else if (email.confidence === 'medium') score += 10;

    // Name/role bonus
    if (email.name) score += 10;
    if (email.role) score += 5;

    // Team page source bonus
    if (email.sources.some(s => s.pageType === 'team')) score += 15;

    // Multiple sources = more reliable
    if (email.sources.length > 1) score += 5;

    return score;
}

// ============================================
// PATTERN DETECTION
// ============================================

function detectPatterns(emails: DiscoveredEmail[], domain: string): string[] {
    const patterns: string[] = [];
    const personEmails = emails.filter(e => !e.isGeneric && e.name);

    if (personEmails.length < 2) return patterns;

    // Check for common patterns
    let firstOnly = 0;
    let firstDotLast = 0;
    let firstInitialLast = 0;

    for (const email of personEmails) {
        const [local] = email.email.split('@');
        const nameParts = email.name?.toLowerCase().split(' ') || [];

        if (nameParts.length >= 2) {
            const first = nameParts[0];
            const last = nameParts[nameParts.length - 1];

            if (local === first) firstOnly++;
            else if (local === `${first}.${last}`) firstDotLast++;
            else if (local === `${first[0]}${last}`) firstInitialLast++;
        }
    }

    if (firstDotLast >= 2) {
        patterns.push(`first.last@${domain}`);
    } else if (firstOnly >= 2) {
        patterns.push(`first@${domain}`);
    } else if (firstInitialLast >= 2) {
        patterns.push(`{f}last@${domain}`);
    }

    return patterns;
}

// ============================================
// CRAWLER
// ============================================

async function crawlAndExtract(
    baseUrl: string,
    domain: string,
    seedUrl: string | undefined,
    maxPages: number
): Promise<{
    emails: Map<string, DiscoveredEmail>;
    pagesVisited: number;
    startTime: number;
}> {
    const startTime = Date.now();
    const emails = new Map<string, DiscoveredEmail>();
    const visited = new Set<string>();
    const queue: Array<{ url: string; priority: number; type: string }> = [];

    // Add seed URL first
    if (seedUrl) {
        queue.push({ url: seedUrl, priority: 0, type: 'seed' });
    }

    // Add homepage
    queue.push({ url: baseUrl, priority: 0.5, type: 'homepage' });

    // Fetch homepage to discover links
    try {
        const response = await fetch(baseUrl, {
            headers: { 'User-Agent': 'EnvelopeBot/2.0 (email-discovery)' },
            signal: AbortSignal.timeout(PAGE_TIMEOUT_MS)
        });

        if (response.ok) {
            const html = await response.text();
            const $ = cheerio.load(html);

            // Find all internal links
            $('a[href]').each((_, el) => {
                const href = $(el).attr('href');
                if (!href) return;

                try {
                    const absoluteUrl = new URL(href, baseUrl).toString().replace(/\/$/, '');
                    if (!absoluteUrl.includes(domain)) return;
                    if (queue.find(q => q.url === absoluteUrl)) return;

                    // Check priority patterns
                    for (const { pattern, priority, type } of URL_PRIORITY) {
                        if (pattern.test(absoluteUrl)) {
                            queue.push({ url: absoluteUrl, priority, type });
                            break;
                        }
                    }

                    // Check footer links
                    const linkText = $(el).text().toLowerCase();
                    if (['contact', 'team', 'about', 'people', 'leadership', 'careers'].some(k => linkText.includes(k))) {
                        if (!queue.find(q => q.url === absoluteUrl)) {
                            queue.push({ url: absoluteUrl, priority: 7, type: 'footer' });
                        }
                    }
                } catch { }
            });
        }
    } catch (err: any) {
        console.log(`[Discovery] Homepage fetch failed: ${err.message}`);
    }

    // Sort by priority
    queue.sort((a, b) => a.priority - b.priority);

    // Limit queue
    const toVisit = queue.slice(0, maxPages);

    console.log(`[Discovery] Queue: ${toVisit.length} URLs`);

    // Crawl pages
    for (const page of toVisit) {
        // Check timeout
        if (Date.now() - startTime > TOTAL_TIMEOUT_MS) {
            console.log(`[Discovery] Timeout after ${visited.size} pages`);
            break;
        }

        if (visited.size >= maxPages) break;

        const normalizedUrl = page.url.replace(/\/$/, '');
        if (visited.has(normalizedUrl)) continue;
        visited.add(normalizedUrl);

        try {
            // Rate limit
            if (visited.size > 1) {
                await new Promise(r => setTimeout(r, REQUEST_DELAY_MS));
            }

            const response = await fetch(page.url, {
                headers: { 'User-Agent': 'EnvelopeBot/2.0 (email-discovery)' },
                signal: AbortSignal.timeout(PAGE_TIMEOUT_MS)
            });

            if (!response.ok) continue;

            const contentLength = response.headers.get('content-length');
            if (contentLength && parseInt(contentLength) > MAX_RESPONSE_SIZE) continue;

            const html = await response.text();
            if (html.length > MAX_RESPONSE_SIZE) continue;

            const $ = cheerio.load(html);

            // Extract from mailto links
            $('a[href^="mailto:"]').each((_, el) => {
                const href = $(el).attr('href') || '';
                const email = href.replace('mailto:', '').split('?')[0].trim().toLowerCase();

                if (isGarbageEmail(email) || !email.endsWith('@' + domain)) return;

                const { name, role } = findNearbyNameRole($, el);
                const anchorText = $(el).text().trim();

                const existing = emails.get(email);
                if (existing) {
                    existing.sources.push({
                        url: page.url,
                        snippet: cleanSnippet(anchorText),
                        pageType: page.type
                    });
                    if (name && !existing.name) existing.name = name;
                    if (role && !existing.role) existing.role = role;
                    existing.confidence = 'high';
                } else {
                    emails.set(email, {
                        email,
                        name: name || deriveName(email),
                        role,
                        confidence: name || role ? 'high' : 'medium',
                        sources: [{
                            url: page.url,
                            snippet: cleanSnippet(anchorText),
                            pageType: page.type
                        }],
                        isGeneric: isGenericEmail(email),
                        score: 0
                    });
                }
            });

            // Extract from text
            const bodyText = $('body').text();
            const foundEmails = extractEmails(bodyText, domain);

            for (const email of foundEmails) {
                if (emails.has(email)) continue;

                const index = bodyText.indexOf(email);
                const snippet = index > -1
                    ? bodyText.substring(Math.max(0, index - 50), Math.min(bodyText.length, index + email.length + 50))
                    : '';

                emails.set(email, {
                    email,
                    name: deriveName(email),
                    role: null,
                    confidence: 'medium',
                    sources: [{
                        url: page.url,
                        snippet: cleanSnippet(snippet),
                        pageType: page.type
                    }],
                    isGeneric: isGenericEmail(email),
                    score: 0
                });
            }

            // Extract from JSON-LD
            $('script[type="application/ld+json"]').each((_, el) => {
                try {
                    const json = JSON.parse($(el).html() || '{}');
                    extractFromJsonLd(json, page.url, page.type, emails, domain);
                } catch { }
            });

            console.log(`[Discovery] ${page.type}: ${page.url} -> ${emails.size} total`);

        } catch (err: any) {
            console.log(`[Discovery] Failed: ${page.url}: ${err.message}`);
        }
    }

    return { emails, pagesVisited: visited.size, startTime };
}

function extractFromJsonLd(
    json: any,
    url: string,
    pageType: string,
    emails: Map<string, DiscoveredEmail>,
    domain: string
): void {
    if (!json) return;

    if (Array.isArray(json)) {
        for (const item of json) {
            extractFromJsonLd(item, url, pageType, emails, domain);
        }
        return;
    }

    if (json['@type'] === 'Person' && json.email) {
        const email = json.email.replace('mailto:', '').toLowerCase();
        if (!isGarbageEmail(email) && email.endsWith('@' + domain) && !emails.has(email)) {
            emails.set(email, {
                email,
                name: json.name || null,
                role: json.jobTitle || null,
                confidence: 'high',
                sources: [{
                    url,
                    snippet: `JSON-LD Person: ${json.name || email}`,
                    pageType
                }],
                isGeneric: false,
                score: 0
            });
        }
    }

    if (json['@graph']) {
        extractFromJsonLd(json['@graph'], url, pageType, emails, domain);
    }
}

// ============================================
// API HANDLERS
// ============================================

export async function OPTIONS() {
    const requestId = generateRequestId();
    return new NextResponse(null, { status: 204, headers: getHeaders(requestId) });
}

export async function POST(request: Request) {
    const requestId = generateRequestId();
    const headers = getHeaders(requestId);

    console.log(`[Discovery] ${requestId} - Request received`);

    try {
        let body: DiscoveryRequest;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({
                success: false,
                requestId,
                error: 'Invalid JSON body'
            }, { status: 400, headers });
        }

        const { domain: inputDomain, seedUrl, maxPages = MAX_PAGES } = body;

        if (!inputDomain) {
            return NextResponse.json({
                success: false,
                requestId,
                error: 'Domain required'
            }, { status: 400, headers });
        }

        const { domain, baseUrl } = normalizeDomain(inputDomain);

        console.log(`[Discovery] ${requestId} - Crawling ${domain}`);

        // Run crawl
        const { emails, pagesVisited, startTime } = await crawlAndExtract(
            baseUrl,
            domain,
            seedUrl,
            Math.min(maxPages, MAX_PAGES)
        );

        // Score and sort emails
        const emailList = Array.from(emails.values());
        for (const email of emailList) {
            email.score = scoreEmail(email);
        }
        emailList.sort((a, b) => b.score - a.score);

        // Detect patterns
        const detectedPatterns = detectPatterns(emailList, domain);

        const result: DiscoveryResult = {
            emails: emailList.slice(0, 20),
            crawlStats: {
                pagesVisited,
                pagesTotal: maxPages,
                durationMs: Date.now() - startTime
            },
            detectedPatterns
        };

        console.log(`[Discovery] ${requestId} - Found ${emailList.length} emails in ${result.crawlStats.durationMs}ms`);

        return NextResponse.json({
            success: true,
            requestId,
            ...result
        }, { headers });

    } catch (error: any) {
        console.error(`[Discovery] ${requestId} - Error:`, error);

        return NextResponse.json({
            success: false,
            requestId,
            error: 'Discovery failed'
        }, { status: 500, headers });
    }
}
