// Envelope Chrome Extension - Website Content Script

// This script runs on generic websites to assist with data extraction

(function () {
    window.envelopeWebsiteParser = {

        parse: function () {
            const data = {
                companyName: '',
                website: window.location.origin,
                domain: window.location.hostname.replace(/^www\./, ''),
                email: '',
                phone: '',
                socialLinks: {},
                contactPage: null
            };

            // --- Brand Name Detection ---
            const brandSources = [
                // Meta tags (most reliable)
                () => document.querySelector('meta[property="og:site_name"]')?.content,
                () => document.querySelector('meta[name="application-name"]')?.content,
                () => document.querySelector('meta[property="og:title"]')?.content?.split(/[|\-–—]/)[0]?.trim(),

                // Structured data
                () => {
                    const ld = document.querySelector('script[type="application/ld+json"]');
                    if (ld) {
                        try {
                            const json = JSON.parse(ld.textContent);
                            return json.name || json.organization?.name || json.publisher?.name;
                        } catch (e) { }
                    }
                    return null;
                },

                // Logo alt text
                () => {
                    const logoSelectors = [
                        'header img[alt]',
                        '.logo img[alt]',
                        '[class*="logo"] img[alt]',
                        'a[href="/"] img[alt]',
                        '.navbar-brand img[alt]'
                    ];
                    for (const sel of logoSelectors) {
                        const el = document.querySelector(sel);
                        if (el?.alt && el.alt.length > 1 && el.alt.length < 50) {
                            return el.alt;
                        }
                    }
                    return null;
                },

                // Page title (fallback)
                () => {
                    const title = document.title;
                    if (title) {
                        // Clean common patterns
                        return title
                            .split(/[|\-–—:·]/)[0]
                            .replace(/home|homepage|welcome to/gi, '')
                            .trim();
                    }
                    return null;
                },

                // Domain name (last resort)
                () => {
                    const domain = data.domain.split('.')[0];
                    return domain.charAt(0).toUpperCase() + domain.slice(1);
                }
            ];

            for (const source of brandSources) {
                try {
                    const name = source();
                    if (name && name.length > 1 && name.length < 100) {
                        data.companyName = name.trim();
                        break;
                    }
                } catch (e) { }
            }

            // --- Email Detection ---
            const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

            // Check mailto links first (most reliable)
            const mailtoLinks = document.querySelectorAll('a[href^="mailto:"]');
            for (const link of mailtoLinks) {
                const email = link.href.replace('mailto:', '').split('?')[0];
                if (isValidBusinessEmail(email)) {
                    data.email = email;
                    break;
                }
            }

            // Scan page text if no mailto found
            if (!data.email) {
                const pageText = document.body.innerText || '';
                const emails = pageText.match(emailRegex) || [];

                for (const email of emails) {
                    if (isValidBusinessEmail(email)) {
                        data.email = email;
                        break;
                    }
                }
            }

            // --- Contact Page Detection ---
            const contactSelectors = [
                'a[href*="/contact"]',
                'a[href*="contact-us"]',
                'a[href*="get-in-touch"]',
                'a:contains("Contact")'
            ];

            for (const sel of contactSelectors) {
                try {
                    const el = document.querySelector(sel);
                    if (el?.href) {
                        data.contactPage = el.href;
                        break;
                    }
                } catch (e) { }
            }

            // --- Social Links ---
            const socialPatterns = {
                linkedin: /linkedin\.com\/(company|in)\//,
                twitter: /twitter\.com\/|x\.com\//,
                facebook: /facebook\.com\//,
                instagram: /instagram\.com\//
            };

            const allLinks = document.querySelectorAll('a[href]');
            for (const link of allLinks) {
                for (const [platform, pattern] of Object.entries(socialPatterns)) {
                    if (!data.socialLinks[platform] && pattern.test(link.href)) {
                        data.socialLinks[platform] = link.href;
                    }
                }
            }

            return data;
        }
    };

    function isValidBusinessEmail(email) {
        if (!email) return false;

        // Exclude common non-contact patterns
        const excludePatterns = [
            'example.com',
            'sentry.io',
            'github.com',
            'githubusercontent',
            'placeholder',
            'test@',
            'noreply',
            'no-reply',
            'donotreply'
        ];

        const lower = email.toLowerCase();
        return !excludePatterns.some(p => lower.includes(p));
    }

    console.log('[Envelope] Website parser ready');
})();
