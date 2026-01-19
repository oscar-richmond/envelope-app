/**
 * Phase 3: Public Email Discovery
 * Search public web + company PDFs for email addresses
 */

import * as cheerio from 'cheerio';

// ============================================
// TYPES
// ============================================

export interface PublicSearchResult {
    url: string;
    title: string;
    snippet: string;
    isPdf: boolean;
}

export interface ExtractedEmail {
    email: string;
    name: string | null;
    role: string | null;
    source: {
        url: string;
        title: string;
        snippet: string;
        type: 'company_site' | 'company_pdf' | 'directory' | 'press' | 'other';
    };
    confidence: 'high' | 'medium' | 'low';
}

export interface PublicDiscoveryResult {
    emails: ExtractedEmail[];
    searchStats: {
        queriesExecuted: number;
        resultsFound: number;
        pdfsParsed: number;
        durationMs: number;
    };
}

// ============================================
// CONSTANTS
// ============================================

const MAX_QUERIES = 10;
const MAX_RESULTS_PER_QUERY = 10;
const MAX_PDFS = 5;
const PDF_TIMEOUT_MS = 10000;
const PAGE_TIMEOUT_MS = 8000;
const MAX_PDF_SIZE = 5 * 1024 * 1024; // 5MB

// Role keywords for extraction
const ROLE_KEYWORDS: Record<string, string> = {
    'ceo': 'CEO',
    'chief executive': 'CEO',
    'founder': 'Founder',
    'co-founder': 'Co-Founder',
    'managing director': 'Managing Director',
    'cto': 'CTO',
    'cfo': 'CFO',
    'coo': 'COO',
    'cmo': 'CMO',
    'head of marketing': 'Head of Marketing',
    'head of growth': 'Head of Growth',
    'head of partnerships': 'Head of Partnerships',
    'partnerships': 'Partnerships',
    'business development': 'Business Development',
    'sales director': 'Sales Director',
    'sales': 'Sales',
    'marketing director': 'Marketing Director',
    'marketing manager': 'Marketing Manager',
    'operations': 'Operations',
    'director': 'Director',
    'manager': 'Manager',
    'partner': 'Partner',
};

// Generic email prefixes
const GENERIC_PREFIXES = new Set([
    'info', 'contact', 'hello', 'hi', 'enquiries', 'enquiry', 'general',
    'admin', 'office', 'team', 'support', 'help', 'sales', 'marketing',
    'hr', 'careers', 'jobs', 'press', 'media', 'legal', 'billing', 'accounts'
]);

// ============================================
// SEARCH API
// ============================================

async function searchWithSerpApi(query: string, domain: string): Promise<PublicSearchResult[]> {
    const apiKey = process.env.SERPAPI_KEY;
    if (!apiKey) return [];

    try {
        const params = new URLSearchParams({
            q: query,
            api_key: apiKey,
            engine: 'google',
            num: String(MAX_RESULTS_PER_QUERY)
        });

        const response = await fetch(`https://serpapi.com/search?${params}`, {
            signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) return [];

        const data = await response.json();
        const results: PublicSearchResult[] = [];

        for (const result of data.organic_results || []) {
            results.push({
                url: result.link,
                title: result.title || '',
                snippet: result.snippet || '',
                isPdf: result.link?.toLowerCase().endsWith('.pdf') || false
            });
        }

        return results;
    } catch (err: any) {
        console.log(`[PublicDiscovery] SerpAPI error: ${err.message}`);
        return [];
    }
}

async function searchWithGoogleCustom(query: string, domain: string): Promise<PublicSearchResult[]> {
    const apiKey = process.env.GOOGLE_SEARCH_KEY;
    const cx = process.env.GOOGLE_SEARCH_CX;
    if (!apiKey || !cx) return [];

    try {
        const params = new URLSearchParams({
            key: apiKey,
            cx: cx,
            q: query,
            num: String(MAX_RESULTS_PER_QUERY)
        });

        const response = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`, {
            signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) return [];

        const data = await response.json();
        const results: PublicSearchResult[] = [];

        for (const item of data.items || []) {
            results.push({
                url: item.link,
                title: item.title || '',
                snippet: item.snippet || '',
                isPdf: item.link?.toLowerCase().endsWith('.pdf') || false
            });
        }

        return results;
    } catch (err: any) {
        console.log(`[PublicDiscovery] Google Custom Search error: ${err.message}`);
        return [];
    }
}

function hasSearchApi(): boolean {
    return !!(process.env.SERPAPI_KEY || (process.env.GOOGLE_SEARCH_KEY && process.env.GOOGLE_SEARCH_CX));
}

async function executeSearch(query: string, domain: string): Promise<PublicSearchResult[]> {
    // Try SerpAPI first, then Google Custom Search
    if (process.env.SERPAPI_KEY) {
        return searchWithSerpApi(query, domain);
    }
    if (process.env.GOOGLE_SEARCH_KEY && process.env.GOOGLE_SEARCH_CX) {
        return searchWithGoogleCustom(query, domain);
    }
    return [];
}

// ============================================
// EMAIL EXTRACTION
// ============================================

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;

const OBFUSCATED_PATTERNS = [
    /([a-zA-Z0-9._%+-]+)\s*\[at\]\s*([a-zA-Z0-9.-]+)\s*\[dot\]\s*([a-zA-Z]{2,})/gi,
    /([a-zA-Z0-9._%+-]+)\s*\(at\)\s*([a-zA-Z0-9.-]+)\s*\(dot\)\s*([a-zA-Z]{2,})/gi,
    /([a-zA-Z0-9._%+-]+)\s*\[at\]\s*([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
];

function extractEmailsFromText(text: string, domain: string): string[] {
    const emails = new Set<string>();

    // Decode HTML entities
    const decoded = text
        .replace(/&#64;/g, '@')
        .replace(/&#46;/g, '.')
        .replace(/&commat;/g, '@');

    // Standard regex
    const matches = decoded.match(EMAIL_REGEX) || [];
    for (const match of matches) {
        const email = match.toLowerCase();
        if (isValidEmail(email, domain)) {
            emails.add(email);
        }
    }

    // Obfuscated patterns
    for (const pattern of OBFUSCATED_PATTERNS) {
        let match;
        const regex = new RegExp(pattern.source, pattern.flags);
        while ((match = regex.exec(decoded)) !== null) {
            const email = match.length === 4
                ? `${match[1]}@${match[2]}.${match[3]}`.toLowerCase()
                : `${match[1]}@${match[2]}`.toLowerCase();
            if (isValidEmail(email, domain)) {
                emails.add(email);
            }
        }
    }

    return Array.from(emails);
}

function isValidEmail(email: string, domain: string): boolean {
    if (!email || !email.includes('@') || !email.includes('.')) return false;
    if (email.length > 60 || email.length < 5) return false;
    if (/\.(png|jpg|svg|gif|pdf)$/i.test(email)) return false;
    if (/example\.com|test@|sentry|wix\.com|wordpress|mailchimp|hubspot|noreply|no-reply/i.test(email)) return false;

    // Check domain match
    if (!email.endsWith('@' + domain)) return false;

    return true;
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

function inferRole(text: string): string | null {
    const lower = text.toLowerCase();
    for (const [keyword, role] of Object.entries(ROLE_KEYWORDS)) {
        if (lower.includes(keyword)) {
            return role;
        }
    }
    return null;
}

function cleanSnippet(text: string): string {
    return text.replace(/\s+/g, ' ').replace(/[<>]/g, '').trim().substring(0, 200);
}

// ============================================
// PAGE EXTRACTION
// ============================================

async function extractFromPage(
    url: string,
    title: string,
    domain: string
): Promise<ExtractedEmail[]> {
    const emails: ExtractedEmail[] = [];

    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': 'EnvelopeBot/3.0 (email-discovery)' },
            signal: AbortSignal.timeout(PAGE_TIMEOUT_MS)
        });

        if (!response.ok) return emails;

        const html = await response.text();
        const $ = cheerio.load(html);
        const bodyText = $('body').text();

        // Determine source type
        const sourceType = getSourceType(url, domain);

        // Extract emails from mailto links
        $('a[href^="mailto:"]').each((_, el) => {
            const href = $(el).attr('href') || '';
            const email = href.replace('mailto:', '').split('?')[0].trim().toLowerCase();

            if (!isValidEmail(email, domain)) return;
            if (emails.find(e => e.email === email)) return;

            // Find nearby context
            const parent = $(el).parent();
            const grandparent = parent.parent();

            let name: string | null = null;
            let role: string | null = null;

            for (const sel of ['h2', 'h3', 'h4', '.name', 'strong']) {
                const found = grandparent.find(sel).first().text().trim();
                if (found && found.length > 2 && found.length < 50 && !found.includes('@')) {
                    name = found;
                    break;
                }
            }

            for (const sel of ['.title', '.role', '.position', 'em', 'small']) {
                const found = grandparent.find(sel).first().text().trim();
                if (found && found.length > 2 && found.length < 80 && !found.includes('@') && found !== name) {
                    role = found;
                    break;
                }
            }

            if (!role) {
                role = inferRole(grandparent.text());
            }

            emails.push({
                email,
                name: name || deriveName(email),
                role,
                source: { url, title, snippet: cleanSnippet($(el).parent().text()), type: sourceType },
                confidence: (name || role) ? 'high' : 'medium'
            });
        });

        // Extract emails from text
        const foundEmails = extractEmailsFromText(bodyText, domain);

        for (const email of foundEmails) {
            if (emails.find(e => e.email === email)) continue;

            const index = bodyText.indexOf(email);
            const context = index > -1
                ? bodyText.substring(Math.max(0, index - 100), Math.min(bodyText.length, index + email.length + 100))
                : '';

            emails.push({
                email,
                name: deriveName(email),
                role: inferRole(context),
                source: { url, title, snippet: cleanSnippet(context), type: sourceType },
                confidence: 'medium'
            });
        }

    } catch (err: any) {
        console.log(`[PublicDiscovery] Page extraction failed: ${url}: ${err.message}`);
    }

    return emails;
}

function getSourceType(url: string, domain: string): 'company_site' | 'company_pdf' | 'directory' | 'press' | 'other' {
    if (url.toLowerCase().endsWith('.pdf')) return 'company_pdf';
    if (url.includes(domain)) return 'company_site';
    if (/crunchbase|linkedin|angellist|clutch|g2crowd/i.test(url)) return 'directory';
    if (/prnewswire|businesswire|globenewswire|press/i.test(url)) return 'press';
    return 'other';
}

// ============================================
// PDF EXTRACTION
// ============================================

async function extractFromPdf(
    url: string,
    title: string,
    domain: string
): Promise<ExtractedEmail[]> {
    const emails: ExtractedEmail[] = [];

    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': 'EnvelopeBot/3.0' },
            signal: AbortSignal.timeout(PDF_TIMEOUT_MS)
        });

        if (!response.ok) return emails;

        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength) > MAX_PDF_SIZE) return emails;

        const buffer = await response.arrayBuffer();

        // Dynamic import pdf-parse
        let pdfParse: any;
        try {
            pdfParse = await import('pdf-parse');
        } catch {
            // Fallback: basic text extraction
            return extractFromPdfBasic(buffer, url, title, domain);
        }

        const pdf = await pdfParse(Buffer.from(buffer));
        const text = pdf.text || '';

        const foundEmails = extractEmailsFromText(text, domain);

        for (const email of foundEmails) {
            const index = text.indexOf(email);
            const context = index > -1
                ? text.substring(Math.max(0, index - 100), Math.min(text.length, index + email.length + 100))
                : '';

            emails.push({
                email,
                name: deriveName(email),
                role: inferRole(context),
                source: { url, title, snippet: cleanSnippet(context), type: 'company_pdf' },
                confidence: 'high' // PDF emails are high confidence
            });
        }

    } catch (err: any) {
        console.log(`[PublicDiscovery] PDF extraction failed: ${url}: ${err.message}`);
    }

    return emails;
}

async function extractFromPdfBasic(
    buffer: ArrayBuffer,
    url: string,
    title: string,
    domain: string
): Promise<ExtractedEmail[]> {
    const emails: ExtractedEmail[] = [];

    try {
        const decoder = new TextDecoder('utf-8', { fatal: false });
        const text = decoder.decode(new Uint8Array(buffer));

        const foundEmails = extractEmailsFromText(text, domain);

        for (const email of foundEmails) {
            emails.push({
                email,
                name: deriveName(email),
                role: null,
                source: { url, title, snippet: 'Extracted from PDF', type: 'company_pdf' },
                confidence: 'high'
            });
        }
    } catch { }

    return emails;
}

// ============================================
// MAIN DISCOVERY FUNCTION
// ============================================

export async function publicEmailDiscovery(domain: string): Promise<PublicDiscoveryResult> {
    const startTime = Date.now();
    const allEmails = new Map<string, ExtractedEmail>();
    let queriesExecuted = 0;
    let resultsFound = 0;
    let pdfsParsed = 0;

    console.log(`[PublicDiscovery] Starting for domain: ${domain}`);

    if (!hasSearchApi()) {
        console.log(`[PublicDiscovery] No search API configured, skipping public search`);
        return {
            emails: [],
            searchStats: { queriesExecuted: 0, resultsFound: 0, pdfsParsed: 0, durationMs: Date.now() - startTime }
        };
    }

    // Generate search queries
    const queries = [
        `"@${domain}"`,
        `email "${domain}"`,
        `contact "${domain}"`,
        `"@${domain}" site:${domain}`,
        `"@${domain}" filetype:pdf`,
        `"@${domain}" -info@ -hello@ -support@`,
        `team "@${domain}"`,
        `staff "${domain}"`,
    ];

    // Execute searches
    const allResults: PublicSearchResult[] = [];

    for (const query of queries.slice(0, MAX_QUERIES)) {
        const results = await executeSearch(query, domain);
        queriesExecuted++;
        resultsFound += results.length;
        allResults.push(...results);

        // Small delay between queries
        await new Promise(r => setTimeout(r, 200));
    }

    // Dedupe results by URL
    const uniqueResults = new Map<string, PublicSearchResult>();
    for (const result of allResults) {
        if (!uniqueResults.has(result.url)) {
            uniqueResults.set(result.url, result);
        }
    }

    console.log(`[PublicDiscovery] Found ${uniqueResults.size} unique URLs`);

    // Process results
    const pdfs: PublicSearchResult[] = [];
    const pages: PublicSearchResult[] = [];

    for (const result of uniqueResults.values()) {
        if (result.isPdf) {
            pdfs.push(result);
        } else {
            pages.push(result);
        }
    }

    // Extract from pages (limit to 10)
    for (const page of pages.slice(0, 10)) {
        const extracted = await extractFromPage(page.url, page.title, domain);
        for (const email of extracted) {
            if (!allEmails.has(email.email)) {
                allEmails.set(email.email, email);
            }
        }
    }

    // Extract from PDFs (limit to MAX_PDFS)
    for (const pdf of pdfs.slice(0, MAX_PDFS)) {
        const extracted = await extractFromPdf(pdf.url, pdf.title, domain);
        pdfsParsed++;
        for (const email of extracted) {
            if (!allEmails.has(email.email)) {
                allEmails.set(email.email, email);
            }
        }
    }

    console.log(`[PublicDiscovery] Extracted ${allEmails.size} emails`);

    return {
        emails: Array.from(allEmails.values()),
        searchStats: {
            queriesExecuted,
            resultsFound,
            pdfsParsed,
            durationMs: Date.now() - startTime
        }
    };
}

// Check if public discovery is available
export function isPublicDiscoveryEnabled(): boolean {
    return hasSearchApi();
}
