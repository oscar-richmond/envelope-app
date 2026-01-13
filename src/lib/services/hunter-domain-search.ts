/**
 * Hunter Domain Search Service
 * Full implementation with pagination, pattern, and sources
 */

// ============================================
// TYPES
// ============================================

export interface HunterSource {
    domain: string;
    uri: string;
    extracted_on: string;
    last_seen_on: string;
    still_on_page: boolean;
}

export interface HunterEmail {
    value: string;
    type: 'personal' | 'generic';
    confidence: number;
    first_name: string | null;
    last_name: string | null;
    position: string | null;
    seniority: string | null;
    department: string | null;
    linkedin: string | null;
    twitter: string | null;
    phone_number: string | null;
    sources: HunterSource[];
    verification: {
        date: string | null;
        status: 'valid' | 'invalid' | 'accept_all' | 'webmail' | 'disposable' | 'unknown';
    };
}

export interface HunterApiResponse {
    data: {
        domain: string;
        disposable: boolean;
        webmail: boolean;
        accept_all: boolean;
        pattern: string | null;
        organization: string | null;
        emails: HunterEmail[];
    };
    meta: {
        results: number;
        limit: number;
        offset: number;
    };
}

export interface EmailCandidate {
    email: string;
    firstName: string | null;
    lastName: string | null;
    fullName: string | null;
    position: string | null;
    confidence: number;
    type: 'personal' | 'generic';
    sources: { url: string; title: string; lastSeen?: string }[];
    verification: {
        status: 'valid' | 'invalid' | 'risky' | 'unknown';
        isCatchAll: boolean;
    };
    linkedin: string | null;
    phone: string | null;
}

export interface HunterDomainSearchResult {
    emails: EmailCandidate[];
    pattern: string | null;
    organization: string | null;
    isCatchAll: boolean;
    totalResults: number;
    pagesScanned: number;
    domain: string;
}

export interface HunterSearchOptions {
    maxResults?: number;
    type?: 'personal' | 'generic' | 'all';
}

// ============================================
// CONSTANTS
// ============================================

const HUNTER_API_BASE = 'https://api.hunter.io/v2';
const DEFAULT_MAX_RESULTS = 50;
const PAGE_SIZE = 10; // Hunter's default
const MAX_PAGES = 10; // Safety limit

// ============================================
// HELPERS
// ============================================

function normalizeDomain(input: string): string {
    let domain = input.trim().toLowerCase();

    // Strip protocol
    domain = domain.replace(/^https?:\/\//, '');

    // Strip path
    domain = domain.split('/')[0];

    // Strip www
    domain = domain.replace(/^www\./, '');

    // Strip port
    domain = domain.split(':')[0];

    return domain;
}

function mapVerificationStatus(status: string): 'valid' | 'invalid' | 'risky' | 'unknown' {
    switch (status) {
        case 'valid': return 'valid';
        case 'invalid': return 'invalid';
        case 'accept_all':
        case 'webmail':
        case 'disposable': return 'risky';
        default: return 'unknown';
    }
}

function mapHunterEmailToCandidate(email: HunterEmail): EmailCandidate {
    const firstName = email.first_name || null;
    const lastName = email.last_name || null;
    const fullName = firstName && lastName
        ? `${firstName} ${lastName}`
        : firstName || lastName || null;

    return {
        email: email.value.toLowerCase(),
        firstName,
        lastName,
        fullName,
        position: email.position,
        confidence: email.confidence,
        type: email.type,
        sources: email.sources.map(s => ({
            url: s.uri,
            title: s.domain,
            lastSeen: s.last_seen_on,
        })),
        verification: {
            status: mapVerificationStatus(email.verification?.status || 'unknown'),
            isCatchAll: false, // Set at domain level
        },
        linkedin: email.linkedin,
        phone: email.phone_number,
    };
}

// ============================================
// MAIN FUNCTION
// ============================================

export async function hunterDomainSearch(
    inputDomain: string,
    options: HunterSearchOptions = {}
): Promise<HunterDomainSearchResult> {
    const apiKey = process.env.HUNTER_API_KEY;

    if (!apiKey) {
        console.warn('[HunterService] No API key configured');
        return {
            emails: [],
            pattern: null,
            organization: null,
            isCatchAll: false,
            totalResults: 0,
            pagesScanned: 0,
            domain: inputDomain,
        };
    }

    const domain = normalizeDomain(inputDomain);
    const maxResults = options.maxResults || DEFAULT_MAX_RESULTS;
    const typeFilter = options.type || 'all';

    console.log(`[HunterService] Searching ${domain} (max: ${maxResults}, type: ${typeFilter})`);

    const allEmails: Map<string, EmailCandidate> = new Map();
    let pattern: string | null = null;
    let organization: string | null = null;
    let isCatchAll = false;
    let totalResults = 0;
    let pagesScanned = 0;

    try {
        // Paginate through results
        for (let page = 0; page < MAX_PAGES; page++) {
            const offset = page * PAGE_SIZE;

            // Build URL with pagination
            const params = new URLSearchParams({
                domain,
                api_key: apiKey,
                limit: String(PAGE_SIZE),
                offset: String(offset),
            });

            // Add type filter if not 'all'
            if (typeFilter !== 'all') {
                params.set('type', typeFilter);
            }

            const url = `${HUNTER_API_BASE}/domain-search?${params}`;

            const response = await fetch(url, {
                headers: { 'Accept': 'application/json' },
                signal: AbortSignal.timeout(15000),
            });

            if (!response.ok) {
                if (response.status === 429) {
                    console.warn('[HunterService] Rate limit hit, stopping pagination');
                    break;
                }
                if (response.status === 401) {
                    console.error('[HunterService] Invalid API key');
                    break;
                }
                console.error(`[HunterService] API error: ${response.status}`);
                break;
            }

            const data: HunterApiResponse = await response.json();
            pagesScanned++;

            // Store metadata from first page
            if (page === 0) {
                pattern = data.data.pattern;
                organization = data.data.organization;
                isCatchAll = data.data.accept_all || false;
                totalResults = data.meta.results;

                console.log(`[HunterService] Total available: ${totalResults}, pattern: ${pattern}`);
            }

            // No more results
            if (!data.data.emails || data.data.emails.length === 0) {
                console.log(`[HunterService] No more results at offset ${offset}`);
                break;
            }

            // Add emails to map (dedupe)
            for (const email of data.data.emails) {
                const candidate = mapHunterEmailToCandidate(email);
                candidate.verification.isCatchAll = isCatchAll;

                const existing = allEmails.get(candidate.email);
                if (existing) {
                    // Merge: keep highest confidence, combine sources
                    existing.confidence = Math.max(existing.confidence, candidate.confidence);
                    existing.sources.push(...candidate.sources);
                    if (!existing.fullName && candidate.fullName) {
                        existing.fullName = candidate.fullName;
                        existing.firstName = candidate.firstName;
                        existing.lastName = candidate.lastName;
                    }
                    if (!existing.position && candidate.position) {
                        existing.position = candidate.position;
                    }
                } else {
                    allEmails.set(candidate.email, candidate);
                }
            }

            console.log(`[HunterService] Page ${page + 1}: ${data.data.emails.length} emails (total: ${allEmails.size})`);

            // Check if we've reached our limit
            if (allEmails.size >= maxResults) {
                console.log(`[HunterService] Reached max results (${maxResults})`);
                break;
            }

            // Check if we've fetched all available
            if (offset + PAGE_SIZE >= totalResults) {
                console.log(`[HunterService] Fetched all available results`);
                break;
            }

            // Small delay between pages to be nice
            await new Promise(r => setTimeout(r, 200));
        }

    } catch (error: any) {
        console.error('[HunterService] Error:', error.message);
    }

    // Convert to array and sort
    const emails = Array.from(allEmails.values());

    // Sort: personal first, then by confidence
    emails.sort((a, b) => {
        if (a.type !== b.type) {
            return a.type === 'personal' ? -1 : 1;
        }
        return b.confidence - a.confidence;
    });

    console.log(`[HunterService] Complete: ${emails.length} emails, ${pagesScanned} pages`);

    return {
        emails,
        pattern,
        organization,
        isCatchAll,
        totalResults,
        pagesScanned,
        domain,
    };
}

// ============================================
// PATTERN HELPERS
// ============================================

export function formatPattern(pattern: string | null, domain: string): string | null {
    if (!pattern) return null;

    // Hunter patterns use {first}, {last}, {f}, {l}
    // Convert to readable format
    return `${pattern}@${domain}`;
}

export function generateEmailFromPattern(
    pattern: string | null,
    firstName: string,
    lastName: string,
    domain: string
): string | null {
    if (!pattern) return null;

    const first = firstName.toLowerCase().replace(/[^a-z]/g, '');
    const last = lastName.toLowerCase().replace(/[^a-z]/g, '');

    if (!first || !last) return null;

    let email = pattern
        .replace(/{first}/g, first)
        .replace(/{last}/g, last)
        .replace(/{f}/g, first[0])
        .replace(/{l}/g, last[0]);

    return `${email}@${domain}`;
}
