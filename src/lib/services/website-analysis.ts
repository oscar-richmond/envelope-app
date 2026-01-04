import { JSDOM } from 'jsdom';

export interface WebsiteAnalysisResult {
    stalenessScore: number; // 0-100 (100 = Very Stale)
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    reasons: string[];
    designOpportunity?: boolean;
    signals: {
        copyrightYear?: number;
        sitemapLastMod?: string; // ISO
        blogLastPost?: string; // ISO
        viewport?: boolean;
        generator?: string;
        headersLastMod?: string;
        checkedUrls?: string[];
        // Design Signals
        hasJQuery?: boolean;
        hasBootstrap?: boolean;
        inlineStyleCount?: number;
        tableCount?: number;
        nonSolarImages?: number; // Images without srcset/lazy
        hasModernTags?: boolean; // main, article, etc
        htmlSizeKb?: number;
    };
}

export class WebsiteAnalysisService {

    // Timeout for requests (polite)
    private TIMEOUT_MS = 10000;
    private USER_AGENT = 'Mozilla/5.0 (compatible; LeadGenBot/1.0; +http://example.com)';

    async analyze(url: string): Promise<WebsiteAnalysisResult> {
        const signals: WebsiteAnalysisResult['signals'] = { checkedUrls: [] };

        try {
            // Normalize URL
            let baseUrl = url.replace(/\/$/, '');
            if (!baseUrl.startsWith('http')) baseUrl = 'https://' + baseUrl;

            // 1. Fetch Homepage (Signals: Copyright, Viewport, Tech Hints, Headers)
            const homeRes = await this.safeFetch(baseUrl);
            signals.checkedUrls?.push(baseUrl);

            if (homeRes) {
                const html = await homeRes.text();
                signals.htmlSizeKb = Math.round(html.length / 1024);

                const dom = new JSDOM(html);
                const doc = dom.window.document;

                signals.headersLastMod = homeRes.headers.get('last-modified') || undefined;
                signals.copyrightYear = this.extractCopyrightYear(doc.body.textContent || '');
                signals.viewport = !!doc.querySelector('meta[name="viewport"]');
                signals.generator = doc.querySelector('meta[name="generator"]')?.getAttribute('content') || undefined;

                // --- Design & UX Signals ---

                // Legacy libs
                const scripts = Array.from(doc.querySelectorAll('script'));
                const links = Array.from(doc.querySelectorAll('link'));
                const allSources = [...scripts.map(s => s.src), ...links.map(l => l.href)].join(' ').toLowerCase();

                signals.hasJQuery = allSources.includes('jquery');
                signals.hasBootstrap = allSources.includes('bootstrap');

                // Structure
                signals.hasModernTags = !!doc.querySelector('main, article, section, header, footer');
                signals.tableCount = doc.querySelectorAll('table').length;

                // Inline styles
                signals.inlineStyleCount = doc.querySelectorAll('[style]').length;

                // Image Optimization (check first 20 images)
                const images = Array.from(doc.querySelectorAll('img')).slice(0, 20);
                if (images.length > 0) {
                    let badImages = 0;
                    images.forEach(img => {
                        if (!img.hasAttribute('srcset') && !img.hasAttribute('loading')) {
                            badImages++;
                        }
                    });
                    signals.nonSolarImages = badImages;
                }
            }

            // 2. Check Sitemap (Strong Signal)
            const sitemapUrl = `${baseUrl}/sitemap.xml`;
            const sitemapDate = await this.checkSitemap(sitemapUrl);
            if (sitemapDate) {
                signals.sitemapLastMod = sitemapDate.toISOString();
                signals.checkedUrls?.push(sitemapUrl);
            }

            // 3. Check Blog/News (Strong Signal) + RSS
            const blogDate = await this.checkBlogRecency(baseUrl);
            if (blogDate) {
                signals.blogLastPost = blogDate.toISOString();
            }

            return this.calculateScore(signals);

        } catch (error) {
            console.error("Analysis failed", error);
            return {
                stalenessScore: 0,
                confidence: 'LOW',
                reasons: ['Analysis failed or timed out'],
                signals
            };
        }
    }

    private async safeFetch(url: string): Promise<Response | null> {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

            const res = await fetch(url, {
                signal: controller.signal,
                headers: { 'User-Agent': this.USER_AGENT }
            });
            clearTimeout(timeout);

            if (!res.ok) return null;
            return res;
        } catch (e) {
            return null;
        }
    }

    private extractCopyrightYear(text: string): number | undefined {
        const regex = /(?:©|copyright|all\s+rights\s+reserved).*?(\d{4})/i;
        const match = text.match(regex);

        if (match && match[1]) {
            const year = parseInt(match[1]);
            const currentYear = new Date().getFullYear();
            if (year > 1990 && year <= currentYear + 1) return year;
        }
        return undefined;
    }

    private async checkSitemap(url: string): Promise<Date | undefined> {
        const res = await this.safeFetch(url);
        if (!res) return undefined;

        try {
            const xml = await res.text();
            const regex = /<lastmod>(.*?)<\/lastmod>/g;
            const matches = [...xml.matchAll(regex)];

            if (matches.length === 0) return undefined;

            let maxDate: Date | undefined;
            for (const m of matches.slice(0, 10)) {
                const dateStr = m[1];
                const d = new Date(dateStr);
                if (!isNaN(d.getTime())) {
                    if (!maxDate || d > maxDate) maxDate = d;
                }
            }
            return maxDate;
        } catch (e) {
            return undefined;
        }
    }

    private async checkBlogRecency(baseUrl: string): Promise<Date | undefined> {
        const paths = ['/blog', '/news', '/insights', '/feed', '/rss.xml'];
        let maxDate: Date | undefined;

        for (const path of paths) {
            const url = `${baseUrl}${path}`;
            const res = await this.safeFetch(url);
            if (!res) continue;

            try {
                const contentType = res.headers.get('content-type') || '';
                const text = await res.text();

                if (contentType.includes('xml') || text.startsWith('<?xml') || path.includes('feed') || path.includes('rss')) {
                    const dateTags = text.match(/<(?:pubDate|updated|dc:date)>(.*?)<\//g);
                    if (dateTags) {
                        for (const tag of dateTags.slice(0, 5)) {
                            const inner = tag.replace(/<\/?.*?>/g, '');
                            const d = new Date(inner);
                            if (!isNaN(d.getTime())) {
                                if (!maxDate || d > maxDate) maxDate = d;
                            }
                        }
                    }
                } else {
                    const dom = new JSDOM(text);
                    const doc = dom.window.document;

                    const times = doc.querySelectorAll('time');
                    times.forEach(t => {
                        const dt = t.getAttribute('datetime');
                        if (dt) {
                            const d = new Date(dt);
                            if (!isNaN(d.getTime())) {
                                if (d.getFullYear() > 2000 && d < new Date(Date.now() + 86400000)) {
                                    if (!maxDate || d > maxDate) maxDate = d;
                                }
                            }
                        }
                    });

                    if (maxDate) break;
                }
            } catch (e) {
                continue;
            }
        }
        return maxDate;
    }

    private calculateScore(signals: WebsiteAnalysisResult['signals']): WebsiteAnalysisResult {
        let score = 0;
        const reasons: string[] = [];
        const NOW = Date.now();
        const MONTH = 1000 * 60 * 60 * 24 * 30; // 30 days
        const currentYear = new Date().getFullYear();

        // --- Content Signals (Base) ---

        // A) Blog Recency vs Content Channel Missing
        let contentUpdateChannelMissing = false;

        if (signals.blogLastPost) {
            const blogDate = new Date(signals.blogLastPost);
            const ageMonths = (NOW - blogDate.getTime()) / MONTH;
            const dateStr = blogDate.toISOString().split('T')[0];

            if (ageMonths >= 24) {
                score += 35;
                reasons.push(`Blog inactive since ${dateStr} (+35)`);
            } else if (ageMonths >= 12) {
                score += 25;
                reasons.push(`Blog inactive since ${dateStr} (+25)`);
            } else if (ageMonths >= 6) {
                score += 10;
                reasons.push(`Blog slowing down (${dateStr}) (+10)`);
            } else {
                reasons.push(`Active blog found (${dateStr})`);
            }
        } else {
            // No blog/news date found
            contentUpdateChannelMissing = true;
            // Note: We do NOT add the string here yet. We check logical conditions later.
        }

        // B) Sitemap
        if (signals.sitemapLastMod) {
            const sitemapDate = new Date(signals.sitemapLastMod);
            const ageMonths = (NOW - sitemapDate.getTime()) / MONTH;

            if (ageMonths >= 18) {
                score += 25;
                reasons.push(`Sitemap dormant (>18m) (+25)`);
            } else if (ageMonths >= 12) {
                score += 15;
                reasons.push(`Sitemap dormant (>12m) (+15)`);
            }
        }

        // C) Copyright
        if (signals.copyrightYear) {
            const age = currentYear - signals.copyrightYear;
            if (age >= 2) {
                score += 10;
                reasons.push(`Copyright outdated (${signals.copyrightYear}) (+10)`);
            }
        } else {
            reasons.push(`Copyright year not found`);
        }

        // --- Design & UX Signals (Additions) ---

        // 1. Mobile Readiness
        if (signals.viewport === false) {
            score += 15;
            reasons.push(`Missing viewport meta tag (+15)`);
        }

        // 2. Legacy Frontend Patterns
        let legacyCount = 0;
        if (signals.hasJQuery) legacyCount++;
        if (signals.hasBootstrap) legacyCount++;
        if ((signals.tableCount || 0) > 2) legacyCount++; // Heuristic for layout tables if many
        if ((signals.inlineStyleCount || 0) > 20) legacyCount++;

        if (legacyCount >= 2) {
            score += 10;
            reasons.push(`Legacy frontend patterns detected (jQuery/Bootstrap/Tables) (+10)`);
        }

        // 3. Image Optimization
        if ((signals.nonSolarImages || 0) > 5) {
            score += 10;
            reasons.push(`Unoptimized images detected (No srcset/lazy) (+10)`);
        }

        // 4. Semantic Structure
        if (signals.hasModernTags === false) {
            score += 10;
            reasons.push(`Lack of modern semantic HTML (+10)`);
        }

        // 5. Performance Indicators
        if ((signals.htmlSizeKb || 0) > 150) { // >150kb HTML is large
            score += 5;
            reasons.push(`Large HTML payload (${signals.htmlSizeKb}kb) (+5)`);
        }

        // --- Conditional Signal: Missing Content Channel ---
        if (contentUpdateChannelMissing) {
            // Apply +5 ONLY if there are OTHER staleness signals (score > 0 so far)
            if (score > 0) {
                score += 5;
                reasons.push(`No visible content update channel detected (+5 supporting signal)`);
            } else {
                // If score is 0, we don't penalize.
                // We could add a neutral note, or nothing. 
                // User requirement: "Modern, minimalist sites remain low score"
                // Let's add a neutral note for clarity only if debugging, but generally sparse is better.
                reasons.push(`No visible content update channel detected (Neutral)`);
            }
        }

        // Clamp Score
        score = Math.min(score, 100);

        // --- Confidence Calculation ---
        let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
        const hasStrongvidence = !!signals.blogLastPost || !!signals.sitemapLastMod;
        const hasDesignEvidence = !!signals.viewport || legacyCount > 0 || (signals.nonSolarImages || 0) > 0;

        if (hasStrongvidence) {
            confidence = 'HIGH';
        } else if (hasDesignEvidence) {
            confidence = 'MEDIUM';
        }

        return {
            stalenessScore: score,
            confidence,
            reasons,
            signals
        };
    }
}

export const websiteAnalysisService = new WebsiteAnalysisService();
