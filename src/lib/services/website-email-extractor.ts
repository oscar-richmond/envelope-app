/**
 * Website Email Extractor
 * 
 * Footer-first extraction with contact page sweep.
 * This is the PRIMARY source for email discovery - runs before any third-party APIs.
 * 
 * Strategy:
 * 1. Fetch homepage, extract from footer/header first (high precision)
 * 2. If no emails, sweep common contact pages
 * 3. Handle obfuscation patterns (name [at] domain [dot] com)
 * 4. Return with provenance (source page, method, region)
 */

import * as cheerio from 'cheerio';

// ============================================
// TYPES
// ============================================

export interface ExtractedWebsiteEmail {
    email: string;
    name: string | null;
    source: 'mailto' | 'text' | 'attribute';
    region: 'footer' | 'header' | 'body' | 'contact_page';
    pageUrl: string;
    confidence: 'high' | 'medium' | 'low';
}

export interface WebsiteExtractionResult {
    emails: ExtractedWebsiteEmail[];
    pagesChecked: string[];
    reasonCode:
    | 'EMAILS_FOUND'
    | 'NO_EMAILS_FOUND_HOME'
    | 'NO_EMAILS_CONTACT_PAGES'
    | 'BLOCKED_403'
    | 'BLOCKED_CLOUDFLARE'
    | 'SITE_UNREACHABLE'
    | 'JS_RENDER_REQUIRED';
    durationMs: number;
    debug?: {
        rawTextScanEnabled: boolean;
        emailsFoundBeforeFilter: string[];
        emailsFilteredOut: { email: string; reason: string }[];
    };
}

// ============================================
// CONSTANTS
// ============================================

const PAGE_TIMEOUT_MS = 8000;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Contact page paths to sweep
const CONTACT_PATHS = [
    '/contact',
    '/contact-us',
    '/contactus',
    '/about',
    '/about-us',
    '/aboutus',
    '/get-in-touch',
    '/support',
    '/help',
    '/team',
    '/our-team',
    '/people',
];

// Email regex
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;

// Generic email prefixes (still valid, just labeled differently)
const GENERIC_PREFIXES = new Set([
    'info', 'contact', 'hello', 'hi', 'enquiries', 'enquiry', 'general',
    'admin', 'office', 'team', 'support', 'help', 'sales', 'marketing',
    'hr', 'careers', 'jobs', 'press', 'media', 'legal', 'billing', 'accounts'
]);

// Invalid patterns to reject
const INVALID_PATTERNS = [
    /\.(png|jpg|jpeg|gif|svg|pdf|webp)$/i,
    /example\.com/i,
    /test@/i,
    /sentry\./i,
    /wix\.com/i,
    /wordpress/i,
    /mailchimp/i,
    /hubspot/i,
    /noreply/i,
    /no-reply/i,
    /@sentry-/i,
    /protection#/i,
];

// ============================================
// OBFUSCATION HANDLING
// ============================================

/**
 * De-obfuscate common email patterns:
 * - name [at] domain [dot] com
 * - name(at)domain(dot)com
 * - HTML entities: &#64; for @, &#46; for .
 */
function deobfuscateText(text: string): string {
    let result = text;

    // Decode HTML entities
    result = result
        .replace(/&#64;/g, '@')
        .replace(/&#46;/g, '.')
        .replace(/&commat;/g, '@')
        .replace(/&period;/g, '.')
        .replace(/&#x40;/gi, '@')
        .replace(/&#x2e;/gi, '.');

    // Replace [at], (at), { at }, etc.
    result = result.replace(/\s*[\[\(\{]\s*at\s*[\]\)\}]\s*/gi, '@');

    // Replace [dot], (dot), { dot }, etc.
    result = result.replace(/\s*[\[\(\{]\s*dot\s*[\]\)\}]\s*/gi, '.');

    // Replace " at " (with spaces)
    result = result.replace(/\s+at\s+/gi, '@');

    // Replace " dot " (with spaces)
    result = result.replace(/\s+dot\s+/gi, '.');

    return result;
}

// Debug tracking
const debugFilteredEmails: { email: string; reason: string }[] = [];
const debugFoundEmails: string[] = [];

function isValidEmail(email: string, domain: string): boolean {
    const normalized = email.toLowerCase().trim();

    // Basic structure check
    if (!normalized.includes('@') || !normalized.includes('.')) {
        debugFilteredEmails.push({ email: normalized, reason: 'missing @ or .' });
        return false;
    }
    if (normalized.length > 60 || normalized.length < 5) {
        debugFilteredEmails.push({ email: normalized, reason: `length ${normalized.length} out of range 5-60` });
        return false;
    }

    // Check against invalid patterns
    for (const pattern of INVALID_PATTERNS) {
        if (pattern.test(normalized)) {
            debugFilteredEmails.push({ email: normalized, reason: `matched invalid pattern ${pattern}` });
            return false;
        }
    }

    // Extract email domain
    const emailDomain = normalized.split('@')[1];
    if (!emailDomain) {
        debugFilteredEmails.push({ email: normalized, reason: 'no domain after @' });
        return false;
    }

    // Normalize both domains for comparison (remove www.)
    const normalizedEmailDomain = emailDomain.replace(/^www\./, '').toLowerCase();
    const normalizedCompanyDomain = domain.replace(/^www\./, '').toLowerCase();

    // Allow exact domain match or subdomain
    if (normalizedEmailDomain !== normalizedCompanyDomain &&
        !normalizedEmailDomain.endsWith('.' + normalizedCompanyDomain) &&
        !normalizedCompanyDomain.endsWith('.' + normalizedEmailDomain)) {
        debugFilteredEmails.push({ email: normalized, reason: `domain ${emailDomain} != ${domain}` });
        return false;
    }

    // Valid!
    debugFoundEmails.push(normalized);
    return true;
}

function isGenericEmail(email: string): boolean {
    const [local] = email.split('@');
    return GENERIC_PREFIXES.has(local.toLowerCase());
}

// ============================================
// EXTRACTION FUNCTIONS
// ============================================

/**
 * Extract emails from mailto links
 */
function extractMailtoEmails(
    $: cheerio.CheerioAPI,
    domain: string,
    pageUrl: string
): ExtractedWebsiteEmail[] {
    const emails: ExtractedWebsiteEmail[] = [];
    const seen = new Set<string>();

    $('a[href^="mailto:"]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const email = href.replace('mailto:', '').split('?')[0].trim().toLowerCase();

        if (!isValidEmail(email, domain)) return;
        if (seen.has(email)) return;
        seen.add(email);

        // Determine region
        const region = getRegion($, el);

        // Try to find name from link text or nearby elements
        let name: string | null = null;
        const linkText = $(el).text().trim();
        if (linkText && !linkText.includes('@') && linkText.length > 2 && linkText.length < 50) {
            name = linkText;
        }

        emails.push({
            email,
            name,
            source: 'mailto',
            region,
            pageUrl,
            confidence: region === 'footer' || region === 'header' ? 'high' : 'medium'
        });
    });

    return emails;
}

/**
 * Extract emails from text content
 */
function extractTextEmails(
    $: cheerio.CheerioAPI,
    domain: string,
    pageUrl: string,
    region: 'footer' | 'header' | 'body' | 'contact_page'
): ExtractedWebsiteEmail[] {
    const emails: ExtractedWebsiteEmail[] = [];
    const seen = new Set<string>();

    // Get text from the appropriate region
    let text = '';
    let selector = '';
    if (region === 'footer') {
        selector = 'footer, [class*="footer"], [id*="footer"]';
        text = $(selector).text();
    } else if (region === 'header') {
        selector = 'header, [class*="header"], [id*="header"]';
        text = $(selector).text();
    } else {
        selector = 'body';
        text = $('body').text();
    }

    console.log(`[WebsiteExtractor] Extracting from ${region} (selector: ${selector}), text length: ${text.length}`);

    // De-obfuscate
    const deobfuscated = deobfuscateText(text);

    // Extract emails
    const matches = deobfuscated.match(EMAIL_REGEX) || [];
    console.log(`[WebsiteExtractor] Raw regex matches in ${region}: ${matches.join(', ') || 'none'}`);

    for (const match of matches) {
        const email = match.toLowerCase();
        if (!isValidEmail(email, domain)) continue;
        if (seen.has(email)) continue;
        seen.add(email);

        emails.push({
            email,
            name: null,
            source: 'text',
            region,
            pageUrl,
            confidence: region === 'footer' || region === 'header' ? 'high' : 'medium'
        });
    }

    return emails;
}

/**
 * Extract emails from data attributes
 */
function extractAttributeEmails(
    $: cheerio.CheerioAPI,
    domain: string,
    pageUrl: string
): ExtractedWebsiteEmail[] {
    const emails: ExtractedWebsiteEmail[] = [];
    const seen = new Set<string>();

    // Check common attributes that might contain emails
    const attributeSelectors = [
        '[data-email]',
        '[data-mail]',
        '[data-contact]',
        '[aria-label*="@"]',
    ];

    for (const selector of attributeSelectors) {
        try {
            $(selector).each((_, el) => {
                const attrs = $(el).attr();
                if (!attrs) return;

                for (const [key, value] of Object.entries(attrs)) {
                    if (typeof value !== 'string') continue;

                    const deobfuscated = deobfuscateText(value);
                    const matches = deobfuscated.match(EMAIL_REGEX) || [];

                    for (const match of matches) {
                        const email = match.toLowerCase();
                        if (!isValidEmail(email, domain)) continue;
                        if (seen.has(email)) continue;
                        seen.add(email);

                        emails.push({
                            email,
                            name: null,
                            source: 'attribute',
                            region: getRegion($, el),
                            pageUrl,
                            confidence: 'medium'
                        });
                    }
                }
            });
        } catch { }
    }

    return emails;
}

/**
 * Determine which region an element is in
 */
function getRegion($: cheerio.CheerioAPI, el: cheerio.Element): 'footer' | 'header' | 'body' {
    const $el = $(el);

    if ($el.closest('footer, [class*="footer"], [id*="footer"]').length > 0) {
        return 'footer';
    }
    if ($el.closest('header, [class*="header"], [id*="header"]').length > 0) {
        return 'header';
    }
    return 'body';
}

// ============================================
// PAGE FETCHING
// ============================================

interface FetchResult {
    ok: boolean;
    html: string;
    status: number;
    blocked: boolean;
    jsRequired: boolean;
}

async function fetchPage(url: string): Promise<FetchResult> {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': USER_AGENT,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            },
            signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
            redirect: 'follow',
        });

        if (response.status === 403 || response.status === 401) {
            return { ok: false, html: '', status: response.status, blocked: true, jsRequired: false };
        }

        if (!response.ok) {
            return { ok: false, html: '', status: response.status, blocked: false, jsRequired: false };
        }

        const html = await response.text();

        // Check for Cloudflare challenge
        if (html.includes('cf-browser-verification') || html.includes('challenge-platform')) {
            return { ok: false, html, status: response.status, blocked: true, jsRequired: true };
        }

        // Check if it's a JS shell (very small HTML with no content)
        const $ = cheerio.load(html);
        const bodyText = $('body').text().trim();
        if (html.length > 100 && bodyText.length < 50) {
            return { ok: true, html, status: response.status, blocked: false, jsRequired: true };
        }

        return { ok: true, html, status: response.status, blocked: false, jsRequired: false };
    } catch (err: any) {
        console.log(`[WebsiteExtractor] Fetch error: ${url}: ${err.message}`);
        return { ok: false, html: '', status: 0, blocked: false, jsRequired: false };
    }
}

// ============================================
// MAIN EXTRACTION FUNCTION
// ============================================

/**
 * Extract emails from a company website
 * 
 * Strategy:
 * 1. Homepage footer + header first (high precision)
 * 2. If no emails, sweep contact pages
 * 3. Return with reason codes for debugging
 */
export async function extractEmailsFromWebsite(domain: string): Promise<WebsiteExtractionResult> {
    const startTime = Date.now();
    const allEmails = new Map<string, ExtractedWebsiteEmail>();
    const pagesChecked: string[] = [];

    console.log(`[WebsiteExtractor] Starting extraction for: ${domain}`);

    // Build homepage URL
    const homepageUrl = `https://${domain}`;

    // Step 1: Fetch homepage
    const homeResult = await fetchPage(homepageUrl);
    pagesChecked.push(homepageUrl);

    if (!homeResult.ok) {
        if (homeResult.blocked) {
            return {
                emails: [],
                pagesChecked,
                reasonCode: homeResult.status === 403 ? 'BLOCKED_403' : 'BLOCKED_CLOUDFLARE',
                durationMs: Date.now() - startTime
            };
        }
        return {
            emails: [],
            pagesChecked,
            reasonCode: 'SITE_UNREACHABLE',
            durationMs: Date.now() - startTime
        };
    }

    if (homeResult.jsRequired) {
        console.log(`[WebsiteExtractor] JS rendering may be required for ${domain}`);
    }

    // Step 2: Extract from homepage
    const $ = cheerio.load(homeResult.html);

    // Footer-first strategy
    const footerMailtoEmails = extractMailtoEmails($, domain, homepageUrl);
    const footerTextEmails = extractTextEmails($, domain, homepageUrl, 'footer');
    const headerTextEmails = extractTextEmails($, domain, homepageUrl, 'header');
    const attributeEmails = extractAttributeEmails($, domain, homepageUrl);

    // Add all homepage emails
    for (const email of [...footerMailtoEmails, ...footerTextEmails, ...headerTextEmails, ...attributeEmails]) {
        if (!allEmails.has(email.email)) {
            allEmails.set(email.email, email);
        }
    }

    // If we found footer/header emails, we can stop (high precision)
    if (allEmails.size > 0) {
        console.log(`[WebsiteExtractor] Found ${allEmails.size} emails on homepage for ${domain}`);
        return {
            emails: Array.from(allEmails.values()),
            pagesChecked,
            reasonCode: 'EMAILS_FOUND',
            durationMs: Date.now() - startTime
        };
    }

    // Step 3: Try body text extraction on homepage
    const bodyTextEmails = extractTextEmails($, domain, homepageUrl, 'body');
    for (const email of bodyTextEmails) {
        if (!allEmails.has(email.email)) {
            allEmails.set(email.email, email);
        }
    }

    if (allEmails.size > 0) {
        console.log(`[WebsiteExtractor] Found ${allEmails.size} emails in body for ${domain}`);
        return {
            emails: Array.from(allEmails.values()),
            pagesChecked,
            reasonCode: 'EMAILS_FOUND',
            durationMs: Date.now() - startTime
        };
    }

    // Step 4: Contact page sweep
    console.log(`[WebsiteExtractor] No homepage emails, checking contact pages for ${domain}`);

    for (const path of CONTACT_PATHS) {
        const pageUrl = `https://${domain}${path}`;
        const pageResult = await fetchPage(pageUrl);

        if (!pageResult.ok) continue;
        pagesChecked.push(pageUrl);

        const $page = cheerio.load(pageResult.html);

        // Extract from contact page
        const mailtoEmails = extractMailtoEmails($page, domain, pageUrl);
        const textEmails = extractTextEmails($page, domain, pageUrl, 'contact_page');
        const attrEmails = extractAttributeEmails($page, domain, pageUrl);

        for (const email of [...mailtoEmails, ...textEmails, ...attrEmails]) {
            if (!allEmails.has(email.email)) {
                allEmails.set(email.email, email);
            }
        }

        // If we found emails, stop early
        if (allEmails.size >= 2) {
            console.log(`[WebsiteExtractor] Found ${allEmails.size} emails on contact pages for ${domain}`);
            return {
                emails: Array.from(allEmails.values()),
                pagesChecked,
                reasonCode: 'EMAILS_FOUND',
                durationMs: Date.now() - startTime
            };
        }

        // Small delay between requests
        await new Promise(r => setTimeout(r, 200));
    }

    // Final check
    if (allEmails.size > 0) {
        return {
            emails: Array.from(allEmails.values()),
            pagesChecked,
            reasonCode: 'EMAILS_FOUND',
            durationMs: Date.now() - startTime
        };
    }

    // No emails found
    const reasonCode = homeResult.jsRequired ? 'JS_RENDER_REQUIRED' : 'NO_EMAILS_CONTACT_PAGES';
    console.log(`[WebsiteExtractor] No emails found for ${domain}: ${reasonCode}`);
    console.log(`[WebsiteExtractor] Debug - emails before filter: ${debugFoundEmails.join(', ') || 'none'}`);
    console.log(`[WebsiteExtractor] Debug - filtered out: ${JSON.stringify(debugFilteredEmails)}`);

    return {
        emails: [],
        pagesChecked,
        reasonCode,
        durationMs: Date.now() - startTime,
        debug: {
            rawTextScanEnabled: true,
            emailsFoundBeforeFilter: debugFoundEmails,
            emailsFilteredOut: debugFilteredEmails
        }
    };
}

/**
 * Get human-readable message for reason code
 */
export function getReasonMessage(reasonCode: WebsiteExtractionResult['reasonCode']): string {
    switch (reasonCode) {
        case 'EMAILS_FOUND':
            return 'Emails found on website';
        case 'NO_EMAILS_FOUND_HOME':
            return 'No emails found on homepage';
        case 'NO_EMAILS_CONTACT_PAGES':
            return 'No emails found on homepage or contact pages';
        case 'BLOCKED_403':
            return 'Site blocked automated access (403 Forbidden)';
        case 'BLOCKED_CLOUDFLARE':
            return 'Site uses Cloudflare protection';
        case 'SITE_UNREACHABLE':
            return 'Site could not be reached';
        case 'JS_RENDER_REQUIRED':
            return 'Site requires JavaScript rendering';
        default:
            return 'Unknown';
    }
}
