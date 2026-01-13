export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { publicEmailDiscovery, isPublicDiscoveryEnabled, ExtractedEmail } from '@/lib/services/public-email-discovery';
import { HunterProvider } from '@/lib/providers/hunter';

// Hunter provider instance
const hunterProvider = new HunterProvider();

// ============================================
// TYPES
// ============================================

interface BestContact {
    email: string;
    name: string | null;
    role: string | null;
    confidence: 'high' | 'medium' | 'low';
    score: number;
    sources: Array<{
        url: string;
        title: string;
        snippet: string;
        type: string;
    }>;
    isGeneric: boolean;
}

interface DetectedPattern {
    pattern: string;
    verified: boolean;
    matches: number;
    examples: string[];
}

interface DiscoveryV3Result {
    bestContacts: BestContact[];
    emails: BestContact[];
    patterns: DetectedPattern[];
    stats: {
        pagesCrawled: number;
        publicResultsFetched: number;
        pdfsParsed: number;
        durationMs: number;
    };
    warnings: string[];
}

interface DiscoveryV3Request {
    domain: string;
    seedUrl?: string;
    options?: {
        crawlSite?: boolean;
        publicSearch?: boolean;
    };
}

// ============================================
// CONSTANTS
// ============================================

const MAX_PAGES = 20;
const PAGE_TIMEOUT_MS = 8000;
const TOTAL_TIMEOUT_MS = 15000;
const REQUEST_DELAY_MS = 250;

// Role priority for best contacts (lower = higher priority)
const ROLE_PRIORITY: Record<string, number> = {
    'ceo': 1, 'founder': 1, 'co-founder': 1, 'managing director': 1,
    'head of marketing': 2, 'head of growth': 2, 'marketing director': 2, 'cmo': 2,
    'head of partnerships': 3, 'partnerships': 3, 'partner': 3,
    'sales director': 4, 'business development': 4, 'sales': 4,
    'operations': 5, 'coo': 5,
    'director': 6, 'manager': 7, 'cto': 8, 'cfo': 8
};

// Generic email prefixes
const GENERIC_PREFIXES = new Set([
    'info', 'contact', 'hello', 'hi', 'enquiries', 'enquiry', 'general',
    'admin', 'office', 'team', 'support', 'help', 'sales', 'marketing',
    'hr', 'careers', 'jobs', 'press', 'media', 'legal', 'billing', 'accounts'
]);

// URL patterns for crawling
const URL_PRIORITY: Array<{ pattern: RegExp; priority: number; type: string }> = [
    { pattern: /\/(team|our-team|people|leadership|staff|management)/i, priority: 1, type: 'team' },
    { pattern: /\/(contact|contact-us|get-in-touch)/i, priority: 2, type: 'contact' },
    { pattern: /\/(about|about-us|company)/i, priority: 3, type: 'about' },
    { pattern: /\/(partners|partnerships)/i, priority: 4, type: 'partners' },
    { pattern: /\/(careers|jobs)/i, priority: 5, type: 'careers' },
    { pattern: /\/(press|media|news)/i, priority: 6, type: 'press' },
];

// ============================================
// HELPERS
// ============================================

function generateRequestId(): string {
    return `v3_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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

function isGenericEmail(email: string): boolean {
    const [local] = email.split('@');
    return GENERIC_PREFIXES.has(local.toLowerCase());
}

function getRolePriority(role: string | null): number {
    if (!role) return 100;
    const lower = role.toLowerCase();
    for (const [keyword, priority] of Object.entries(ROLE_PRIORITY)) {
        if (lower.includes(keyword)) return priority;
    }
    return 50;
}

function scoreContact(contact: BestContact): number {
    let score = 0;

    // Not generic = big bonus
    if (!contact.isGeneric) score += 40;

    // Has name
    if (contact.name) score += 15;

    // Has role
    if (contact.role) score += 10;

    // Role priority bonus
    const rolePriority = getRolePriority(contact.role);
    score += Math.max(0, 20 - rolePriority * 2);

    // High confidence
    if (contact.confidence === 'high') score += 15;
    else if (contact.confidence === 'medium') score += 8;

    // Multiple sources
    if (contact.sources.length > 1) score += 10;

    // Company site/PDF source
    if (contact.sources.some(s => s.type === 'company_pdf')) score += 10;
    if (contact.sources.some(s => s.type === 'company_site')) score += 5;

    return score;
}

// ============================================
// PATTERN DETECTION
// ============================================

function detectPatterns(contacts: BestContact[], domain: string): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];
    const personContacts = contacts.filter(c => !c.isGeneric && c.name);

    if (personContacts.length < 2) {
        // Not enough data to verify patterns
        if (personContacts.length === 1) {
            const pattern = inferPatternFromEmail(personContacts[0].email, personContacts[0].name);
            if (pattern) {
                patterns.push({
                    pattern: `${pattern}@${domain}`,
                    verified: false,
                    matches: 1,
                    examples: [personContacts[0].email]
                });
            }
        }
        return patterns;
    }

    // Count pattern matches
    const patternCounts: Record<string, { count: number; emails: string[] }> = {};

    for (const contact of personContacts) {
        const pattern = inferPatternFromEmail(contact.email, contact.name);
        if (pattern) {
            if (!patternCounts[pattern]) {
                patternCounts[pattern] = { count: 0, emails: [] };
            }
            patternCounts[pattern].count++;
            patternCounts[pattern].emails.push(contact.email);
        }
    }

    // Build pattern results
    for (const [pattern, data] of Object.entries(patternCounts)) {
        patterns.push({
            pattern: `${pattern}@${domain}`,
            verified: data.count >= 2,
            matches: data.count,
            examples: data.emails.slice(0, 3)
        });
    }

    // Sort by matches
    patterns.sort((a, b) => b.matches - a.matches);

    return patterns.slice(0, 3);
}

function inferPatternFromEmail(email: string, name: string | null): string | null {
    if (!name) return null;

    const [local] = email.split('@');
    const nameParts = name.toLowerCase().split(/\s+/);

    if (nameParts.length < 1) return null;

    const first = nameParts[0];
    const last = nameParts[nameParts.length - 1];
    const firstInitial = first[0];

    if (local === first) return 'first';
    if (local === `${first}.${last}`) return 'first.last';
    if (local === `${first}${last}`) return 'firstlast';
    if (local === `${firstInitial}${last}`) return '{f}last';
    if (local === `${firstInitial}.${last}`) return '{f}.last';
    if (local === `${first}_${last}`) return 'first_last';
    if (local === last) return 'last';

    return null;
}

// ============================================
// SITE CRAWL (from Phase 2)
// ============================================

async function crawlSite(
    baseUrl: string,
    domain: string,
    startTime: number
): Promise<{ contacts: BestContact[]; pagesCrawled: number }> {
    const contacts = new Map<string, BestContact>();
    const visited = new Set<string>();
    const queue: Array<{ url: string; priority: number; type: string }> = [
        { url: baseUrl, priority: 0, type: 'homepage' }
    ];

    // Discover URLs from homepage
    try {
        const response = await fetch(baseUrl, {
            headers: { 'User-Agent': 'EnvelopeBot/3.0 (email-discovery)' },
            signal: AbortSignal.timeout(PAGE_TIMEOUT_MS)
        });

        if (response.ok) {
            const html = await response.text();
            const $ = cheerio.load(html);

            $('a[href]').each((_, el) => {
                const href = $(el).attr('href');
                if (!href) return;

                try {
                    const absoluteUrl = new URL(href, baseUrl).toString().replace(/\/$/, '');
                    if (!absoluteUrl.includes(domain)) return;

                    for (const { pattern, priority, type } of URL_PRIORITY) {
                        if (pattern.test(absoluteUrl)) {
                            if (!queue.find(q => q.url === absoluteUrl)) {
                                queue.push({ url: absoluteUrl, priority, type });
                            }
                            break;
                        }
                    }
                } catch { }
            });
        }
    } catch { }

    queue.sort((a, b) => a.priority - b.priority);

    // Crawl pages
    for (const page of queue.slice(0, MAX_PAGES)) {
        if (Date.now() - startTime > TOTAL_TIMEOUT_MS) break;
        if (visited.has(page.url)) continue;
        visited.add(page.url);

        try {
            if (visited.size > 1) await new Promise(r => setTimeout(r, REQUEST_DELAY_MS));

            const response = await fetch(page.url, {
                headers: { 'User-Agent': 'EnvelopeBot/3.0' },
                signal: AbortSignal.timeout(PAGE_TIMEOUT_MS)
            });

            if (!response.ok) continue;

            const html = await response.text();
            const $ = cheerio.load(html);

            // Extract mailto
            $('a[href^="mailto:"]').each((_, el) => {
                const href = $(el).attr('href') || '';
                const email = href.replace('mailto:', '').split('?')[0].trim().toLowerCase();

                if (!email.includes('@') || !email.endsWith('@' + domain)) return;

                const parent = $(el).parent().parent();
                let name: string | null = null;
                let role: string | null = null;

                for (const sel of ['h2', 'h3', 'h4', '.name', 'strong']) {
                    const found = parent.find(sel).first().text().trim();
                    if (found && found.length > 2 && found.length < 50 && !found.includes('@')) {
                        name = found;
                        break;
                    }
                }

                for (const sel of ['.title', '.role', '.position', 'em']) {
                    const found = parent.find(sel).first().text().trim();
                    if (found && found.length > 2 && found.length < 80 && !found.includes('@') && found !== name) {
                        role = found;
                        break;
                    }
                }

                const existing = contacts.get(email);
                if (existing) {
                    existing.sources.push({
                        url: page.url,
                        title: $('title').text() || page.type,
                        snippet: $(el).parent().text().substring(0, 100),
                        type: page.type
                    });
                    if (name && !existing.name) existing.name = name;
                    if (role && !existing.role) existing.role = role;
                } else {
                    contacts.set(email, {
                        email,
                        name: name || deriveName(email),
                        role,
                        confidence: (name || role) ? 'high' : 'medium',
                        score: 0,
                        sources: [{
                            url: page.url,
                            title: $('title').text() || page.type,
                            snippet: $(el).parent().text().substring(0, 100),
                            type: page.type
                        }],
                        isGeneric: isGenericEmail(email)
                    });
                }
            });

        } catch { }
    }

    return { contacts: Array.from(contacts.values()), pagesCrawled: visited.size };
}

function deriveName(email: string): string | null {
    const [local] = email.split('@');
    if (!local || local.length < 3) return null;
    if (GENERIC_PREFIXES.has(local.toLowerCase())) return null;
    if (/\d/.test(local)) return null;

    const parts = local.split(/[._-]/);
    return parts.filter(p => p.length > 0).map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
}

// ============================================
// MERGE RESULTS
// ============================================

function mergeContacts(
    crawlContacts: BestContact[],
    publicEmails: ExtractedEmail[],
    hunterContacts: BestContact[] = []
): BestContact[] {
    const merged = new Map<string, BestContact>();

    // Add crawl contacts
    for (const c of crawlContacts) {
        merged.set(c.email, c);
    }

    // Add/merge public emails
    for (const e of publicEmails) {
        const existing = merged.get(e.email);
        if (existing) {
            existing.sources.push({
                url: e.source.url,
                title: e.source.title,
                snippet: e.source.snippet,
                type: e.source.type
            });
            if (e.name && !existing.name) existing.name = e.name;
            if (e.role && !existing.role) existing.role = e.role;
            if (e.confidence === 'high') existing.confidence = 'high';
        } else {
            merged.set(e.email, {
                email: e.email,
                name: e.name,
                role: e.role,
                confidence: e.confidence,
                score: 0,
                sources: [{
                    url: e.source.url,
                    title: e.source.title,
                    snippet: e.source.snippet,
                    type: e.source.type
                }],
                isGeneric: isGenericEmail(e.email)
            });
        }
    }

    // Add/merge Hunter contacts
    for (const h of hunterContacts) {
        const existing = merged.get(h.email);
        if (existing) {
            existing.sources.push(...h.sources);
            if (h.name && !existing.name) existing.name = h.name;
            if (h.role && !existing.role) existing.role = h.role;
            if (h.confidence === 'high') existing.confidence = 'high';
            // Boost score for Hunter matches
            existing.score = Math.max(existing.score, h.score);
        } else {
            merged.set(h.email, h);
        }
    }

    return Array.from(merged.values());
}

// ============================================
// API HANDLERS
// ============================================

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: getHeaders(generateRequestId()) });
}

export async function POST(request: Request) {
    const requestId = generateRequestId();
    const headers = getHeaders(requestId);
    const startTime = Date.now();

    console.log(`[DiscoveryV3] ${requestId} - Request received`);

    try {
        let body: DiscoveryV3Request;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ success: false, requestId, error: 'Invalid JSON' }, { status: 400, headers });
        }

        const { domain: inputDomain, seedUrl, options = {} } = body;
        const { crawlSite: doCrawl = true, publicSearch = true } = options;

        if (!inputDomain) {
            return NextResponse.json({ success: false, requestId, error: 'Domain required' }, { status: 400, headers });
        }

        const { domain, baseUrl } = normalizeDomain(inputDomain);
        const warnings: string[] = [];

        console.log(`[DiscoveryV3] ${requestId} - Processing ${domain}`);

        // Run site crawl
        let crawlContacts: BestContact[] = [];
        let pagesCrawled = 0;

        if (doCrawl) {
            const crawlResult = await crawlSite(baseUrl, domain, startTime);
            crawlContacts = crawlResult.contacts;
            pagesCrawled = crawlResult.pagesCrawled;
        }

        // Run public search
        let publicEmails: ExtractedEmail[] = [];
        let publicResultsFetched = 0;
        let pdfsParsed = 0;

        if (publicSearch && isPublicDiscoveryEnabled()) {
            const publicResult = await publicEmailDiscovery(domain);
            publicEmails = publicResult.emails;
            publicResultsFetched = publicResult.searchStats.resultsFound;
            pdfsParsed = publicResult.searchStats.pdfsParsed;
        } else if (publicSearch) {
            warnings.push('Public search disabled: no SERPAPI_KEY or GOOGLE_SEARCH_KEY configured');
        }

        // Run Hunter Domain Search
        let hunterContacts: BestContact[] = [];
        let hunterResultsCount = 0;

        try {
            const hunterResults = await hunterProvider.find(domain);
            hunterResultsCount = hunterResults.length;
            console.log(`[DiscoveryV3] ${requestId} - Hunter returned ${hunterResultsCount} contacts`);

            // Convert Hunter results to BestContact format
            hunterContacts = hunterResults.map(h => ({
                email: h.email || '',
                name: h.firstName && h.lastName ? `${h.firstName} ${h.lastName}` : h.firstName || h.lastName || null,
                role: h.title || null,
                confidence: h.confidence >= 80 ? 'high' as const : h.confidence >= 50 ? 'medium' as const : 'low' as const,
                score: h.confidence,
                sources: [{
                    url: `https://hunter.io/search/${domain}`,
                    title: 'Hunter.io',
                    snippet: h.title || 'Professional email',
                    type: 'directory' as const
                }],
                isGeneric: GENERIC_PREFIXES.has(h.email?.split('@')[0]?.toLowerCase() || '')
            })).filter(c => c.email);
        } catch (err: any) {
            console.log(`[DiscoveryV3] ${requestId} - Hunter error: ${err.message}`);
            warnings.push('Hunter search unavailable');
        }

        // Merge results (crawl + public + hunter)
        const allContacts = mergeContacts(crawlContacts, publicEmails, hunterContacts);

        // Score contacts
        for (const c of allContacts) {
            c.score = scoreContact(c);
        }

        // Sort by score
        allContacts.sort((a, b) => b.score - a.score);

        // Split into best contacts (non-generic with role) and other emails
        const bestContacts = allContacts
            .filter(c => !c.isGeneric && c.role)
            .slice(0, 4);

        // Detect patterns
        const patterns = detectPatterns(allContacts, domain);

        // Build result
        const result: DiscoveryV3Result = {
            bestContacts,
            emails: allContacts.slice(0, 25),
            patterns,
            stats: {
                pagesCrawled,
                publicResultsFetched,
                pdfsParsed,
                hunterResultsCount,
                durationMs: Date.now() - startTime
            },
            meta: {
                totalFound: allContacts.length,
                totalReturned: Math.min(allContacts.length, 25),
            },
            warnings
        };

        console.log(`[DiscoveryV3] ${requestId} - Found ${allContacts.length} emails, ${bestContacts.length} best contacts`);

        return NextResponse.json({ success: true, requestId, ...result }, { headers });

    } catch (error: any) {
        console.error(`[DiscoveryV3] ${requestId} - Error:`, error);
        return NextResponse.json({ success: false, requestId, error: 'Discovery failed' }, { status: 500, headers });
    }
}
