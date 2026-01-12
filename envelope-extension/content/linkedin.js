// Envelope Chrome Extension - LinkedIn Content Script

// This script runs on LinkedIn pages to assist with data extraction
// Most parsing is done via executeScript in popup.js for better control

(function () {
    // Expose helper functions to window for executeScript access
    window.envelopeLinkedInParser = {

        // Parse person profile
        parsePerson: function () {
            const data = {
                contactName: '',
                jobTitle: '',
                companyName: '',
                companyLinkedIn: '',
                personLinkedIn: window.location.href,
                location: ''
            };

            // Name - try multiple selectors
            const nameSelectors = [
                'h1.text-heading-xlarge',
                '.pv-text-details__left-panel h1',
                '.top-card-layout__title'
            ];

            for (const sel of nameSelectors) {
                const el = document.querySelector(sel);
                if (el?.textContent?.trim()) {
                    data.contactName = el.textContent.trim();
                    break;
                }
            }

            // Job title / headline
            const titleSelectors = [
                '.text-body-medium.break-words',
                '.pv-text-details__left-panel .text-body-medium',
                '.top-card-layout__headline'
            ];

            for (const sel of titleSelectors) {
                const el = document.querySelector(sel);
                if (el?.textContent?.trim()) {
                    data.jobTitle = el.textContent.trim();
                    break;
                }
            }

            // Location
            const locationSelectors = [
                '.pv-text-details__left-panel .text-body-small.inline',
                '.top-card-layout__first-subline'
            ];

            for (const sel of locationSelectors) {
                const el = document.querySelector(sel);
                if (el?.textContent?.trim()) {
                    data.location = el.textContent.trim();
                    break;
                }
            }

            // Company from experience
            const experienceSection = document.querySelector('#experience');
            if (experienceSection) {
                const companyEl = experienceSection.querySelector('.t-bold span[aria-hidden="true"]');
                if (companyEl?.textContent?.trim()) {
                    data.companyName = companyEl.textContent.trim();
                }

                // Company LinkedIn URL
                const companyLink = experienceSection.querySelector('a[href*="/company/"]');
                if (companyLink?.href) {
                    data.companyLinkedIn = companyLink.href.split('?')[0];
                }
            }

            // Fallback: parse company from headline
            if (!data.companyName && data.jobTitle) {
                const match = data.jobTitle.match(/(?:at|@)\s+(.+)$/i);
                if (match) {
                    data.companyName = match[1].trim();
                }
            }

            return data;
        },

        // Parse company page
        parseCompany: function () {
            const data = {
                companyName: '',
                website: '',
                industry: '',
                location: '',
                size: '',
                companyLinkedIn: window.location.href
            };

            // Company name - try multiple selectors
            const nameSelectors = [
                'h1.org-top-card-summary__title',
                '.org-top-card-summary__title span',
                'h1.top-card-layout__title'
            ];

            for (const sel of nameSelectors) {
                const el = document.querySelector(sel);
                if (el?.textContent?.trim()) {
                    data.companyName = el.textContent.trim();
                    break;
                }
            }

            // Website
            const websiteSelectors = [
                'a[data-test-id="about-us-link"]',
                '.org-top-card-primary-actions__inner a[href*="http"]',
                '.org-page-details__definition-text a'
            ];

            for (const sel of websiteSelectors) {
                const el = document.querySelector(sel);
                if (el?.href && !el.href.includes('linkedin.com')) {
                    data.website = el.href;
                    break;
                }
            }

            // Industry, location, size from info list
            const infoItems = document.querySelectorAll('.org-top-card-summary-info-list__info-item');
            infoItems.forEach((item, i) => {
                const text = item.textContent?.trim() || '';
                if (i === 0) data.industry = text;
                if (text.includes('employees')) data.size = text;
            });

            return data;
        }
    };

    console.log('[Envelope] LinkedIn parser ready');
})();
