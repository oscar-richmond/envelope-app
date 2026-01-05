import * as cheerio from 'cheerio';
import { URL } from 'url';

// ...
interface DiscoveredEmail {
    email: string;
    type: 'GENERAL' | 'SALES' | 'SUPPORT' | 'PERSONAL' | 'BUSINESS';
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    sourceUrl: string;
    contextSnippet: string;
    roleTitle?: string;
    roleSource?: string;
    roleConfidence?: 'HIGH' | 'MEDIUM' | 'LOW';
    name?: string | null;
}

export class EmailDiscoveryService {

    private readonly MAX_PAGES = 5;
    private readonly TIMEOUT_MS = 5000;

    private CONSUMER_PROVIDERS = new Set([
        'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'hotmail.com', 'hotmail.co.uk',
        'outlook.com', 'live.com', 'icloud.com', 'me.com', 'aol.com', 'protonmail.com', 'zoho.com',
        'yandex.com', 'mail.com', 'gmx.com'
    ]);

    // Simple role keywords for context matching
    private ROLE_KEYWORDS = [
        'Founder', 'Co-Founder', 'CEO', 'CTO', 'CFO', 'CMO', 'COO',
        'Director', 'Manager', 'Head of', 'Lead', 'VP', 'President',
        'Partner', 'Owner', 'Principal', 'Associate', 'Consultant',
        'Engineer', 'Developer', 'Designer', 'Editor', 'Writer',
        'Assistant', 'Administrator', 'Support'
    ];

    async discoverEmails(baseUrl: string): Promise<{ emails: DiscoveredEmail[], brandName: string | null, brandNameSource: string | null, brandNameConfidence: string | null, websiteDomain: string | null }> {
        // ... (existing implementation) ...
        if (!baseUrl) return { emails: [], brandName: null, brandNameSource: null, brandNameConfidence: null, websiteDomain: null };

        let startUrl = baseUrl;
        if (!startUrl.startsWith('http')) startUrl = 'https://' + startUrl;

        // Extract Company Domain for matching
        let companyDomain = '';
        try {
            companyDomain = new URL(startUrl).hostname.replace(/^www\./, '');
        } catch (e) { }

        const visited = new Set<string>();
        const queue: string[] = [startUrl];
        const emails = new Map<string, DiscoveredEmail>();
        let brandName: string | null = null;
        let brandNameSource: string | null = null;
        let brandNameConfidence: string | null = null;

        // 1. Crawl Phase
        while (queue.length > 0 && visited.size < this.MAX_PAGES) {
            const currentUrl = queue.shift()!;
            if (visited.has(currentUrl)) continue;
            visited.add(currentUrl);

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

                const response = await fetch(currentUrl, {
                    headers: { 'User-Agent': 'LeadGenBot/1.0 (Safe; Contact Discovery)' },
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (!response.ok) continue;
                const html = await response.text();
                const $ = cheerio.load(html);

                // Extract Brand Name (Only from Homepage/First Page)
                if (visited.size === 1) {
                    const brandData = this.extractBrandName($, companyDomain);
                    if (brandData.name) {
                        brandName = brandData.name;
                        brandNameSource = brandData.source;
                        brandNameConfidence = brandData.confidence;
                    }
                }

                // A. Extract Emails from this page
                this.extractFromPage($, currentUrl, emails, companyDomain);

                // B. Find "Contact", "Team", "About" links (only from Homepage)
                if (visited.size === 1) {
                    $('a[href]').each((_, el) => {
                        const href = $(el).attr('href');
                        if (!href) return;

                        try {
                            const absolute = new URL(href, startUrl).toString();
                            // Only internal links
                            if (!absolute.includes(new URL(startUrl).hostname)) return;

                            // Keywords filter
                            if (/contact|about|team|people|us/i.test(absolute)) {
                                if (!visited.has(absolute) && !queue.includes(absolute)) {
                                    queue.push(absolute);
                                }
                            }
                        } catch (e) { }
                    });
                }

            } catch (error) {
                console.error(`Failed to crawl ${currentUrl}`, error);
            }
        }

        // 2. Rank & Sort
        const sortedEmails = Array.from(emails.values()).sort((a, b) => {
            const priority = { 'PERSONAL': 1, 'BUSINESS': 5, 'SALES': 4, 'GENERAL': 3, 'SUPPORT': 2 };
            // @ts-ignore - Dynamic key access
            return (priority[b.type] || 0) - (priority[a.type] || 0);
        });

        return { emails: sortedEmails, brandName, brandNameSource, brandNameConfidence, websiteDomain: companyDomain };
    }

    private extractFromPage($: cheerio.CheerioAPI, url: string, emails: Map<string, DiscoveredEmail>, companyDomain: string) {
        const bodyText = $('body').text();
        const mailtoLinks: string[] = [];
        $('a[href^="mailto:"]').each((_, el) => {
            mailtoLinks.push($(el).attr('href')!.replace('mailto:', '').split('?')[0]);
        });

        // Regex for text emails (loose but safe)
        const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
        const matches = bodyText.match(emailRegex) || [];

        const allFound = new Set([...mailtoLinks, ...matches]);

        allFound.forEach(rawEmail => {
            const email = rawEmail.trim().toLowerCase();

            // Filter Garbage
            if (this.isGarbage(email)) return;
            if (emails.has(email)) return;

            // Classify with context
            const type = this.classify(email, companyDomain);
            const [local, domain] = email.split('@');

            // Context Snippet (simple 50 chars around)
            const index = bodyText.indexOf(rawEmail);
            const snippet = index > -1 ? bodyText.substring(Math.max(0, index - 50), Math.min(bodyText.length, index + rawEmail.length + 50)).replace(/\s+/g, ' ').trim() : 'Found in link';

            // Confidence
            const isContactPage = /contact|team|about/i.test(url);
            const confidence = isContactPage ? 'HIGH' : 'MEDIUM';

            // Role Extraction
            let roleTitle: string | undefined;
            let roleSource: string | undefined;
            let roleConfidence: 'HIGH' | 'MEDIUM' | 'LOW' | undefined;

            // 1. Check Context for Roles
            // Look for role keywords in snippet or nearby headers
            // Only try context extraction if it's potentially a person (Business/Personal)
            if (type === 'BUSINESS' || type === 'PERSONAL') {
                // Simple keyword search in snippet
                // To do it better, we'd traverse up the DOM from the email node to find nearest H-tag
                // But for now, text search in snippet is faster/cheaper
                const foundRole = this.ROLE_KEYWORDS.find(r => snippet.includes(r));
                if (foundRole) {
                    // Try to extract full title e.g. "Managing Director" if snippet says "John Doe, Managing Director"
                    // This is brittle with regex, keeping it simple: use the keyword found plus surrounding words?
                    // Or just use the Found keyword? Let's use keyword + heuristics or just keyword for safety.
                    // Better: "Managing Director" is a keyword in my list? 
                    // I'll update my list to include phrases.

                    // If the found token is simple like "Lead", we might want "Lead Developer". 
                    // For MVP: Just stick to the detected keyword or hardcoded "Team Member" if on team page?
                    roleTitle = foundRole;
                    roleSource = 'page_context';
                    roleConfidence = 'MEDIUM';
                }
            }

            // 2. Role Prefix Override (High Confidence)
            // If extracting from context failed, or if it's a generic email role
            if (!roleTitle) {
                if (/sales|partner|biz|growth/i.test(local)) { roleTitle = 'Sales Team'; roleSource = 'role_email_prefix'; roleConfidence = 'HIGH'; }
                if (/support|help|desk|billing/i.test(local)) { roleTitle = 'Support Team'; roleSource = 'role_email_prefix'; roleConfidence = 'HIGH'; }
                if (/info|hello|hi|enquir|general|office|contact/i.test(local)) { roleTitle = 'General Enquiries'; roleSource = 'role_email_prefix'; roleConfidence = 'HIGH'; }
                if (/press|media/i.test(local)) { roleTitle = 'Press Team'; roleSource = 'role_email_prefix'; roleConfidence = 'HIGH'; }
                if (/careers|jobs|hr/i.test(local)) { roleTitle = 'HR Team'; roleSource = 'role_email_prefix'; roleConfidence = 'HIGH'; }
                if (/accounts|finance|billing/i.test(local)) { roleTitle = 'Accounts Team'; roleSource = 'role_email_prefix'; roleConfidence = 'HIGH'; }
            }

            // Name Derivation
            const derivedName = this.deriveNameFromEmail(email);

            emails.set(email, {
                email,
                type,
                confidence,
                sourceUrl: url,
                contextSnippet: snippet,
                roleTitle,
                roleSource,
                roleConfidence,
                name: derivedName
            });
        });
    }

    private isGarbage(email: string): boolean {
        if (email.endsWith('.png') || email.endsWith('.jpg') || email.endsWith('.svg')) return true;
        if (email.includes('example') || email.includes('test')) return true;
        if (email.includes('sentry') || email.includes('wix') || email.includes('noreply')) return true;
        if (email.length > 50) return true;
        return false;
    }

    public classify(email: string, companyDomain?: string): 'GENERAL' | 'SALES' | 'SUPPORT' | 'PERSONAL' | 'BUSINESS' {
        const [local, domain] = email.split('@');
        // ... (Using updated classify logic from previous task, wait, I need to preserve it or rewrite it)
        // Previous task updated logic. I should ensure I don't regress.
        // I will copy the latest logic from previous step view.
        // It was:
        /*
        // 1. Check Company Match
        if (companyDomain && (domain === companyDomain || domain.endsWith('.' + companyDomain) || companyDomain.endsWith('.' + domain))) {
            if (/sales|partner|biz|growth/i.test(local)) return 'SALES';
            if (/support|help|desk|billing/i.test(local)) return 'SUPPORT';
            if (/info|hello|hi|enquir|general|office|contact/i.test(local)) return 'GENERAL';
            return 'BUSINESS';
        }

        // 2. Check Strict Personal
        if (this.CONSUMER_PROVIDERS.has(domain)) return 'PERSONAL';

        // 3. Fallback
        if (/sales|partner|biz|growth/i.test(local)) return 'SALES';
        if (/support|help|desk|billing/i.test(local)) return 'SUPPORT';
        if (/info|hello|hi|enquir|general|office|contact/i.test(local)) return 'GENERAL';

        return 'BUSINESS'; 
        */

        // 1. Check Company Match
        if (companyDomain && (domain === companyDomain || domain.endsWith('.' + companyDomain) || companyDomain.endsWith('.' + domain))) {
            if (/sales|partner|biz|growth/i.test(local)) return 'SALES';
            if (/support|help|desk|billing/i.test(local)) return 'SUPPORT';
            if (/info|hello|hi|enquir|general|office|contact/i.test(local)) return 'GENERAL';
            return 'BUSINESS';
        }

        // 2. Check Strict Personal
        if (this.CONSUMER_PROVIDERS.has(domain)) return 'PERSONAL';

        // 3. Fallback
        if (/sales|partner|biz|growth/i.test(local)) return 'SALES';
        if (/support|help|desk|billing/i.test(local)) return 'SUPPORT';
        if (/info|hello|hi|enquir|general|office|contact/i.test(local)) return 'GENERAL';

        return 'BUSINESS';
    }

    private extractBrandName($: cheerio.CheerioAPI, domain: string): { name: string, source: string, confidence: 'HIGH' | 'MEDIUM' | 'LOW' } {
        // 1. OG Site Name (Highest)
        const ogSiteName = $('meta[property="og:site_name"]').attr('content');
        if (ogSiteName && ogSiteName.length > 2) {
            return { name: this.normalizeBrandName(ogSiteName), source: 'og_site_name', confidence: 'HIGH' };
        }

        // 2. Title Tag (Medium/High)
        const title = $('title').text();
        if (title) {
            const separators = ['|', '-', '–', '—', ':'];
            let bestPart = title;

            for (const sep of separators) {
                if (title.includes(sep)) {
                    const parts = title.split(sep);
                    if (['home', 'welcome', 'index'].includes(parts[0].trim().toLowerCase())) {
                        bestPart = parts[1];
                    } else {
                        bestPart = parts[0];
                    }
                    break;
                }
            }
            if (bestPart && bestPart.length < 50) {
                return { name: this.normalizeBrandName(bestPart), source: 'title', confidence: 'MEDIUM' };
            }
        }

        // 3. Logo Alt Text (Medium)
        const logoAlt = $('img[src*="logo"], img[alt*="logo"]').first().attr('alt');
        if (logoAlt) {
            const cleanAlt = logoAlt.replace(/logo/i, '').trim();
            if (cleanAlt && cleanAlt.length > 2 && cleanAlt.length < 30) {
                return { name: this.normalizeBrandName(cleanAlt), source: 'logo_alt', confidence: 'MEDIUM' };
            }
        }

        // 4. H1 (Medium/Low)
        const h1 = $('h1').first().text().trim();
        if (h1 && h1.length < 30 && !h1.includes(' ')) {
            return { name: this.normalizeBrandName(h1), source: 'h1', confidence: 'LOW' };
        }

        // 5. Domain Fallback (Low)
        if (domain) {
            const cleanDomain = domain.split('.')[0];
            const humanDomain = cleanDomain.charAt(0).toUpperCase() + cleanDomain.slice(1);
            return { name: humanDomain, source: 'domain_fallback', confidence: 'LOW' };
        }

        return { name: '', source: 'none', confidence: 'LOW' };
    }

    private normalizeBrandName(name: string): string {
        let clean = name.trim();
        // Remove Legal Entities
        clean = clean.replace(/\s+(ltd|limited|llp|plc|inc|corp|corporation|holdings|group)\.?$/i, '');
        // Remove "Home" if it leaked
        clean = clean.replace(/^home\s+[|:-]\s+/i, '');
        return clean.trim();
    }

    public deriveNameFromEmail(email: string): string | null {
        try {
            const [local] = email.split('@');
            if (!local) return null;

            // 1. Blocklist for Generics
            const generics = [
                'info', 'contact', 'admin', 'support', 'sales', 'hello', 'hi', 'enquiries', 'office', 'help',
                'billing', 'accounts', 'hr', 'jobs', 'careers', 'marketing', 'media', 'press', 'team', 'crew',
                'dev', 'developer', 'webmaster', 'hostmaster', 'postmaster', 'legal', 'finance', 'invoices',
                'noreply', 'no-reply'
            ];

            if (generics.includes(local.toLowerCase())) return null;

            // 2. Heuristic: Must contain separator or be longer than X chars?
            // "oscar" -> "Oscar". "john.doe" -> "John Doe". "jdoe" -> "Jdoe" (maybe skip?)

            // Reject short single words? 'tom' -> 'Tom' is fine. 'a' -> skip.
            if (local.length < 3) return null;

            // Separators: . _ -
            const parts = local.split(/[._-]/);

            // Capitalize parts
            const capitalized = parts
                .filter(p => p.length > 0)
                .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase());

            // If it looks like a number, skip (e.g. user123)
            if (/\d/.test(local)) return null;

            return capitalized.join(' ');

        } catch (e) {
            return null;
        }
    }

}

export const emailDiscovery = new EmailDiscoveryService();
