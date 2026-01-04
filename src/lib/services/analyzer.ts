import * as cheerio from 'cheerio';

type AnalysisResult = {
    stalenessScore: number;
    scoreConfidence: 'LOW' | 'MEDIUM' | 'HIGH';
    scoreReasons: string[];
    copyrightYear: number | null;
    hasSitemap: boolean;
    sitemapLastMod: Date | null;
    blogLastPost: Date | null;
    metaViewport: boolean;
    generatorTag: string | null;
    title: string | null;
};

export async function analyzeUrl(url: string): Promise<AnalysisResult> {
    const needsProtocol = !url.startsWith('http');
    const targetUrl = needsProtocol ? `https://${url}` : url;

    const signals = {
        copyrightYear: null as number | null,
        metaViewport: false,
        generatorTag: null as string | null,
        sslValid: targetUrl.startsWith('https:'),
        title: null as string | null,
        accessible: false,
        sitemapLastMod: null as Date | null,
        blogLastPost: null as Date | null,
    };

    // 1. Fetch Homepage
    let html = '';
    try {
        const res = await fetch(targetUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeadGenBot/1.0; +http://example.com/bot)' },
            signal: AbortSignal.timeout(10000)
        });
        if (res.ok) {
            signals.accessible = true;
            html = await res.text();
            if (res.url.startsWith('http:')) signals.sslValid = false;
        }
    } catch (error) {
        if (needsProtocol) {
            try {
                // Fallback to HTTP
                const res = await fetch(`http://${url}`, { signal: AbortSignal.timeout(10000) });
                if (res.ok) {
                    signals.accessible = true;
                    signals.sslValid = false;
                    html = await res.text();
                }
            } catch (e) { }
        }
    }

    // 2. Parse Homepage Signals
    if (signals.accessible && html) {
        const $ = cheerio.load(html);
        signals.title = $('title').text().trim() || null;
        if ($('meta[name="viewport"]').length > 0) signals.metaViewport = true;
        signals.generatorTag = $('meta[name="generator"]').attr('content') || null;

        // Copyright Year
        const text = $('body').text();
        const copyrightPattern = /(?:copyright|©)\s*(?:[^.]{0,40})\s*(20\d{2})/i;
        const matches = text.match(copyrightPattern);
        if (matches && matches[1]) {
            const yr = parseInt(matches[1]);
            const curr = new Date().getFullYear();
            if (yr <= curr + 1) signals.copyrightYear = yr;
        }

        // Blog Date detection (heuristic scan on homepage for common date patterns nearby "blog" or "news")
        // Simple regex for "Jan 2024", "2024-01-01", etc.
        // This is weak but better than nothing for MVP.
        const datePattern = /(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})|((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4})/gi;
        const datesFound: Date[] = [];
        // To save time/compute, we scan only text nodes or specific sections? Text scan whole body is OK for small pages.
        const dateMatches = text.match(datePattern);
        if (dateMatches) {
            dateMatches.forEach(d => {
                const dt = new Date(d);
                if (!isNaN(dt.getTime()) && dt.getFullYear() > 2000 && dt.getFullYear() <= new Date().getFullYear()) {
                    datesFound.push(dt);
                }
            });
        }
        if (datesFound.length > 0) {
            // Sort desc
            datesFound.sort((a, b) => b.getTime() - a.getTime());
            // Take the most recent date found *anywhere* as a hint, but this is noisy.
            // Better: Look specifically for <time> tags or common blog classes?
            // For MVP, we'll be conservative. Use only if we see "blog" or "news" in URL or nearby.
            // Let's rely on Sitemap for strong signal, this is backup.
            signals.blogLastPost = datesFound[0];
        }
    }

    // 3. Fetch Sitemap (Best Effort)
    if (signals.accessible) {
        try {
            // Guess sitemap location
            const domain = new URL(targetUrl).origin;
            const sitemapUrl = `${domain}/sitemap.xml`;
            const smRes = await fetch(sitemapUrl, { signal: AbortSignal.timeout(5000) });
            if (smRes.ok) {
                const smText = await smRes.text();
                // Regex/Cheerio for <lastmod>
                const $sm = cheerio.load(smText, { xmlMode: true });
                let latestMod: number = 0;
                $sm('lastmod').each((_, el) => {
                    const txt = $sm(el).text();
                    const d = new Date(txt).getTime();
                    if (!isNaN(d) && d > latestMod) latestMod = d;
                });
                if (latestMod > 0) {
                    signals.sitemapLastMod = new Date(latestMod);
                }
            }
        } catch (e) { }
    }

    // --- SCORING RUBRIC (Deterministic) ---
    let score = 0;
    let confidence: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    const reasons: string[] = [];
    const now = new Date();
    const monthDiff = (d1: Date, d2: Date) => (d1.getFullYear() - d2.getFullYear()) * 12 + (d1.getMonth() - d2.getMonth());

    if (!signals.accessible) {
        return {
            stalenessScore: 100, scoreConfidence: 'LOW', scoreReasons: ["Site Inaccessible"],
            copyrightYear: null, hasSitemap: false, sitemapLastMod: null,
            blogLastPost: null, metaViewport: false, generatorTag: null, title: null
        };
    }

    // Signal 1: Blog/News Last Post (Strongest) - or Sitemap LastMod
    // We take the Freshest of Blog or Sitemap as "Last Content Update"
    let lastUpdate = signals.blogLastPost;
    let lastUpdateSource = "Blog/News";

    if (signals.sitemapLastMod) {
        if (!lastUpdate || signals.sitemapLastMod > lastUpdate) {
            lastUpdate = signals.sitemapLastMod;
            lastUpdateSource = "Sitemap";
        }
    }

    if (lastUpdate) {
        const monthsOld = monthDiff(now, lastUpdate);
        if (monthsOld >= 24) {
            score += 35;
            reasons.push(`Last content update (${lastUpdateSource}) was >2 years ago.`);
            confidence = 'HIGH';
        } else if (monthsOld >= 12) {
            score += 25;
            reasons.push(`Last content update (${lastUpdateSource}) was over a year ago.`);
            confidence = 'HIGH';
        } else if (monthsOld >= 6) {
            score += 10;
            reasons.push(`Last content update (${lastUpdateSource}) was over 6 months ago.`);
            confidence = 'HIGH';
        } else {
            reasons.push(`Active content updates detected (${lastUpdateSource} is fresh).`);
            confidence = 'HIGH';
        }
    } else {
        reasons.push("No content update dates found (Sitemap/Blog missing).");
    }

    // Signal 2: Copyright Year
    if (signals.copyrightYear) {
        const age = now.getFullYear() - signals.copyrightYear;
        if (age >= 2) {
            score += 10;
            reasons.push(`Copyright year is outdated (${signals.copyrightYear}).`);
            // If we had no other date, this boosts confidence
            if (confidence === 'LOW') confidence = 'MEDIUM';
        } else {
            // Current or last year is fine
        }
    }

    // Signal 3: Mobile/Perf
    if (!signals.metaViewport) {
        score += 10;
        reasons.push("Legacy mobile experience (No viewport tag).");
    }

    // Signal 4: Legacy Tech Hints (Generator)
    // Simple check for old CMS versions if visible, else ignored for MVP
    if (signals.generatorTag && /wordPress\s*[0-4]\./i.test(signals.generatorTag)) {
        score += 10;
        reasons.push("Detected legacy CMS version.");
    }

    // Signal 5: SSL (Implicit "Legacy Tech")
    if (!signals.sslValid) {
        score += 10; // "Legacy tech hints" bucket
        reasons.push("Not using HTTPS.");
    }

    // Calculate Confidence if not correctly set by primary dates
    if (confidence === 'LOW') {
        let weakSignals = 0;
        if (signals.copyrightYear) weakSignals++;
        if (signals.metaViewport) weakSignals++; // presence is a signal
        if (signals.sslValid) weakSignals++;

        if (weakSignals >= 2) confidence = 'MEDIUM';
    }

    return {
        stalenessScore: Math.min(score, 100),
        scoreConfidence: confidence,
        scoreReasons: reasons,
        copyrightYear: signals.copyrightYear,
        hasSitemap: !!signals.sitemapLastMod,
        sitemapLastMod: signals.sitemapLastMod,
        blogLastPost: signals.blogLastPost,
        metaViewport: signals.metaViewport,
        generatorTag: signals.generatorTag,
        title: signals.title
    };
}
