import * as cheerio from 'cheerio';
import { URL } from 'url';

interface DiscoveredEmail {
    email: string;
    type: 'GENERAL' | 'SALES' | 'SUPPORT' | 'PERSONAL';
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    sourceUrl: string;
    contextSnippet: string;
}

export class EmailDiscoveryService {

    private readonly MAX_PAGES = 5;
    private readonly TIMEOUT_MS = 5000;

    async discoverEmails(baseUrl: string): Promise<DiscoveredEmail[]> {
        if (!baseUrl) return [];

        let startUrl = baseUrl;
        if (!startUrl.startsWith('http')) startUrl = 'https://' + startUrl;

        const visited = new Set<string>();
        const queue: string[] = [startUrl];
        const emails = new Map<string, DiscoveredEmail>();

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

                // A. Extract Emails from this page
                this.extractFromPage($, currentUrl, emails);

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
        return Array.from(emails.values()).sort((a, b) => {
            const priority = { 'PERSONAL': 4, 'SALES': 3, 'GENERAL': 2, 'SUPPORT': 1 };
            return (priority[b.type] || 0) - (priority[a.type] || 0);
        });
    }

    private extractFromPage($: cheerio.CheerioAPI, url: string, emails: Map<string, DiscoveredEmail>) {
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

            // Classify
            const type = this.classify(email);

            // Context Snippet (simple 50 chars around)
            const index = bodyText.indexOf(rawEmail);
            const snippet = index > -1 ? bodyText.substring(Math.max(0, index - 30), Math.min(bodyText.length, index + rawEmail.length + 30)).replace(/\s+/g, ' ').trim() : 'Found in link';

            // Confidence
            const isContactPage = /contact|team/i.test(url);
            const confidence = isContactPage ? 'HIGH' : 'MEDIUM';

            emails.set(email, {
                email,
                type,
                confidence,
                sourceUrl: url,
                contextSnippet: snippet
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

    private classify(email: string): 'GENERAL' | 'SALES' | 'SUPPORT' | 'PERSONAL' {
        const local = email.split('@')[0];
        if (/sales|partner|biz|growth/i.test(local)) return 'SALES';
        if (/support|help|desk|billing/i.test(local)) return 'SUPPORT';
        if (/info|hello|hi|enquir|general|office|contact/i.test(local)) return 'GENERAL';
        return 'PERSONAL';
    }

}

export const emailDiscovery = new EmailDiscoveryService();
