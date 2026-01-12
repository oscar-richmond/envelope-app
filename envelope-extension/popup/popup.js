// Envelope Chrome Extension - Popup Script

const API_BASE = 'http://localhost:3000'; // Update for production

// DOM Elements
const elements = {
    authRequired: document.getElementById('auth-required'),
    loading: document.getElementById('loading'),
    captureCard: document.getElementById('capture-card'),
    success: document.getElementById('success'),
    error: document.getElementById('error'),
    unsupported: document.getElementById('unsupported'),

    userBadge: document.getElementById('user-badge'),
    userEmail: document.getElementById('user-email'),

    contextBadge: document.getElementById('context-badge'),
    contextType: document.getElementById('context-type'),

    fieldCompany: document.getElementById('field-company'),
    fieldContact: document.getElementById('field-contact'),
    fieldContactRow: document.getElementById('field-contact-row'),
    fieldTitle: document.getElementById('field-title'),
    fieldTitleRow: document.getElementById('field-title-row'),
    fieldWebsite: document.getElementById('field-website'),
    fieldEmail: document.getElementById('field-email'),
    fieldEmailRow: document.getElementById('field-email-row'),
    fieldSource: document.getElementById('field-source'),

    btnSignin: document.getElementById('btn-signin'),
    btnAdd: document.getElementById('btn-add'),
    btnAddCompose: document.getElementById('btn-add-compose'),
    btnRetry: document.getElementById('btn-retry'),

    successMessage: document.getElementById('success-message'),
    viewLink: document.getElementById('view-link'),
    errorMessage: document.getElementById('error-message')
};

// State
let currentData = null;
let authToken = null;

// Show a specific state
function showState(stateName) {
    const states = ['authRequired', 'loading', 'captureCard', 'success', 'error', 'unsupported'];
    states.forEach(s => {
        elements[s]?.classList.toggle('hidden', s !== stateName);
    });
}

// Initialize
async function init() {
    // Check auth
    const stored = await chrome.storage.local.get(['authToken', 'userEmail']);
    authToken = stored.authToken;

    if (!authToken) {
        showState('authRequired');
        return;
    }

    // Show user badge
    if (stored.userEmail) {
        elements.userEmail.textContent = stored.userEmail;
        elements.userBadge.classList.remove('hidden');
    }

    // Get current tab
    showState('loading');

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const url = tab.url;

        // Detect context and parse page
        const context = detectContext(url);

        if (context === 'unsupported') {
            showState('unsupported');
            return;
        }

        // Inject content script and get data
        const data = await getPageData(tab.id, context, url);

        if (!data) {
            showState('unsupported');
            return;
        }

        currentData = { ...data, context, sourceUrl: url };
        populateForm(currentData);
        showState('captureCard');

    } catch (e) {
        console.error('Init error:', e);
        showError('Failed to analyze page');
    }
}

// Detect page context
function detectContext(url) {
    if (!url) return 'unsupported';

    if (url.includes('linkedin.com/in/')) {
        return 'linkedin_person';
    }
    if (url.includes('linkedin.com/company/')) {
        return 'linkedin_company';
    }
    if (url.startsWith('http://') || url.startsWith('https://')) {
        // Exclude browser internal pages
        if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
            return 'unsupported';
        }
        return 'website';
    }
    return 'unsupported';
}

// Get page data via content script
async function getPageData(tabId, context, url) {
    try {
        // For LinkedIn, inject and run the parser
        if (context.startsWith('linkedin_')) {
            const results = await chrome.scripting.executeScript({
                target: { tabId },
                func: parseLinkedInPage,
                args: [context]
            });
            return results[0]?.result;
        }

        // For generic websites
        if (context === 'website') {
            const results = await chrome.scripting.executeScript({
                target: { tabId },
                func: parseWebsitePage
            });
            return results[0]?.result;
        }
    } catch (e) {
        console.error('Script injection failed:', e);
        // Fallback: extract from URL
        return extractFromUrl(url);
    }

    return null;
}

// LinkedIn page parser (injected into page)
function parseLinkedInPage(context) {
    const data = {
        companyName: '',
        contactName: '',
        jobTitle: '',
        website: '',
        email: '',
        linkedinUrl: window.location.href
    };

    if (context === 'linkedin_person') {
        // Person profile
        const nameEl = document.querySelector('h1.text-heading-xlarge');
        const titleEl = document.querySelector('.text-body-medium.break-words');
        const companyLink = document.querySelector('button[aria-label*="Current company"]');

        data.contactName = nameEl?.textContent?.trim() || '';
        data.jobTitle = titleEl?.textContent?.trim() || '';

        // Try to get company from experience section
        const experienceSection = document.querySelector('#experience');
        if (experienceSection) {
            const companyEl = experienceSection.querySelector('.t-bold span[aria-hidden="true"]');
            data.companyName = companyEl?.textContent?.trim() || '';
        }

        // Fallback: parse from title
        if (!data.companyName && data.jobTitle) {
            const match = data.jobTitle.match(/at\s+(.+)$/i);
            if (match) data.companyName = match[1].trim();
        }
    }

    if (context === 'linkedin_company') {
        // Company page
        const nameEl = document.querySelector('h1.org-top-card-summary__title');
        const websiteEl = document.querySelector('a[data-test-id="about-us-link"]');
        const industryEl = document.querySelector('.org-top-card-summary-info-list__info-item');

        data.companyName = nameEl?.textContent?.trim() || '';
        data.website = websiteEl?.href || '';

        // Try alternate selectors
        if (!data.companyName) {
            const altName = document.querySelector('.org-top-card-summary__title span');
            data.companyName = altName?.textContent?.trim() || '';
        }
    }

    return data;
}

// Generic website parser (injected into page)
function parseWebsitePage() {
    const data = {
        companyName: '',
        website: window.location.origin,
        email: '',
        contactName: '',
        jobTitle: ''
    };

    // Try multiple sources for brand name
    const sources = [
        () => document.querySelector('meta[property="og:site_name"]')?.content,
        () => document.querySelector('meta[name="application-name"]')?.content,
        () => document.querySelector('meta[name="author"]')?.content,
        () => {
            const title = document.title;
            // Clean common suffixes
            return title.split(/[|\-–—]/)[0].trim();
        },
        () => {
            // Try logo alt text
            const logo = document.querySelector('header img[alt], .logo img[alt], [class*="logo"] img[alt]');
            return logo?.alt;
        }
    ];

    for (const source of sources) {
        try {
            const name = source();
            if (name && name.length > 1 && name.length < 100) {
                data.companyName = name;
                break;
            }
        } catch (e) { }
    }

    // Detect emails on page
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const pageText = document.body.innerText || '';
    const emails = pageText.match(emailRegex) || [];

    // Filter out common non-contact emails
    const filtered = emails.filter(e =>
        !e.includes('example.com') &&
        !e.includes('sentry.io') &&
        !e.includes('githubusercontent')
    );

    if (filtered.length > 0) {
        data.email = filtered[0];
    }

    return data;
}

// Fallback URL extraction
function extractFromUrl(url) {
    try {
        const parsed = new URL(url);
        const domain = parsed.hostname.replace(/^www\./, '');
        const name = domain.split('.')[0];

        return {
            companyName: name.charAt(0).toUpperCase() + name.slice(1),
            website: parsed.origin,
            email: '',
            contactName: '',
            jobTitle: ''
        };
    } catch (e) {
        return null;
    }
}

// Populate form with extracted data
function populateForm(data) {
    // Context badge
    const contextLabels = {
        linkedin_person: 'LinkedIn Person',
        linkedin_company: 'LinkedIn Company',
        website: 'Website'
    };
    elements.contextType.textContent = contextLabels[data.context] || 'Unknown';

    // Fields
    elements.fieldCompany.value = data.companyName || '';
    elements.fieldWebsite.value = data.website || '';
    elements.fieldSource.value = data.sourceUrl || '';

    // Person-specific fields
    if (data.context === 'linkedin_person') {
        elements.fieldContact.value = data.contactName || '';
        elements.fieldTitle.value = data.jobTitle || '';
        elements.fieldContactRow.classList.remove('hidden');
        elements.fieldTitleRow.classList.remove('hidden');
    } else {
        elements.fieldContactRow.classList.add('hidden');
        elements.fieldTitleRow.classList.add('hidden');
    }

    // Email
    if (data.email) {
        elements.fieldEmail.value = data.email;
        elements.fieldEmailRow.classList.remove('hidden');
    } else {
        elements.fieldEmailRow.classList.add('hidden');
    }
}

// Capture lead
async function captureLead(compose = false) {
    const payload = {
        type: currentData.context,
        sourceUrl: currentData.sourceUrl,
        data: {
            companyName: elements.fieldCompany.value,
            website: elements.fieldWebsite.value,
            contactName: elements.fieldContact.value,
            jobTitle: elements.fieldTitle.value,
            email: elements.fieldEmail.value,
            linkedinUrl: currentData.linkedinUrl
        }
    };

    elements.btnAdd.disabled = true;
    elements.btnAddCompose.disabled = true;

    try {
        const res = await fetch(`${API_BASE}/api/extension/capture`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(payload)
        });

        const result = await res.json();

        if (!res.ok) {
            throw new Error(result.error || 'Capture failed');
        }

        // Success
        elements.successMessage.textContent = `Added ${payload.data.companyName} to Lead Board`;
        elements.viewLink.href = `${API_BASE}/leads`;

        if (compose && result.leadId) {
            // Open compose in Envelope
            chrome.tabs.create({ url: `${API_BASE}/leads?compose=${result.leadId}` });
        }

        showState('success');

    } catch (e) {
        console.error('Capture error:', e);
        showError(e.message || 'Failed to capture lead');
    }
}

function showError(message) {
    elements.errorMessage.textContent = message;
    showState('error');
}

// Sign in handler
async function handleSignIn() {
    // Open Envelope login page
    chrome.tabs.create({ url: `${API_BASE}/auth/extension-login` });
}

// Event listeners
elements.btnSignin?.addEventListener('click', handleSignIn);
elements.btnAdd?.addEventListener('click', () => captureLead(false));
elements.btnAddCompose?.addEventListener('click', () => captureLead(true));
elements.btnRetry?.addEventListener('click', init);

// Start
init();
