// Envelope Chrome Extension - Popup Script

const API_BASE = 'https://envelope-app-sage.vercel.app';

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

    fieldCompany: document.getElementById('field-company'),
    fieldWebsite: document.getElementById('field-website'),

    contactsList: document.getElementById('contacts-list'),
    contactsLoading: document.getElementById('contacts-loading'),
    contactsSelectAll: document.getElementById('contacts-select-all'),
    contactsError: document.getElementById('contacts-error'),
    contactsErrorMessage: document.getElementById('contacts-error-message'),

    btnFindContacts: document.getElementById('btn-find-contacts'),
    btnAddManual: document.getElementById('btn-add-manual'),
    btnSelectAll: document.getElementById('btn-select-all'),
    btnSelectNone: document.getElementById('btn-select-none'),
    btnSignin: document.getElementById('btn-signin'),
    btnAdd: document.getElementById('btn-add'),
    btnCompose: document.getElementById('btn-compose'),
    btnRetry: document.getElementById('btn-retry'),
    btnRetryContacts: document.getElementById('btn-retry-contacts'),
    btnConvert: document.getElementById('btn-convert'),
    btnConvertText: document.getElementById('btn-convert-text'),

    // Opportunity card
    opportunityCard: document.getElementById('opportunity-card'),
    opportunityScore: document.getElementById('opportunity-score'),
    opportunityAction: document.getElementById('opportunity-action'),
    scoreNeed: document.getElementById('score-need'),
    scoreAbility: document.getElementById('score-ability'),
    scoreConfidence: document.getElementById('score-confidence'),
    scoreNeedVal: document.getElementById('score-need-val'),
    scoreAbilityVal: document.getElementById('score-ability-val'),
    scoreConfidenceVal: document.getElementById('score-confidence-val'),

    btnEnrich: document.getElementById('btn-enrich'),
    btnEnrichText: document.getElementById('btn-enrich-text'),

    detailSource: document.getElementById('detail-source'),
    detailType: document.getElementById('detail-type'),

    // Debug elements
    debugRequestId: document.getElementById('debug-request-id'),
    debugDomain: document.getElementById('debug-domain'),
    debugApex: document.getElementById('debug-apex'),
    debugProviders: document.getElementById('debug-providers'),
    debugCount: document.getElementById('debug-count'),
    debugHeuristic: document.getElementById('debug-heuristic'),
    debugError: document.getElementById('debug-error'),

    successMessage: document.getElementById('success-message'),
    viewLink: document.getElementById('view-link'),
    errorMessage: document.getElementById('error-message')
};

// State
let currentData = null;
let authToken = null;
let contacts = [];
let contactIdCounter = 0;

// Email validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Show a specific state
function showState(stateName) {
    const states = ['authRequired', 'loading', 'captureCard', 'success', 'error', 'unsupported'];
    states.forEach(s => {
        elements[s]?.classList.toggle('hidden', s !== stateName);
    });
}

// Initialize - ALWAYS verify session via API (rock-solid approach)
async function init() {
    console.log('[Envelope] Popup init - verifying session via API...');

    // Always verify session via API call (not relying on stored token)
    const sessionVerified = await verifySessionViaAPI();

    if (!sessionVerified) {
        console.log('[Envelope] Session not verified - showing sign-in');
        showState('authRequired');
        return;
    }

    console.log('[Envelope] Session verified - proceeding');
    showState('loading');

    // Set up periodic session check (every 3 minutes while popup is open)
    setInterval(async () => {
        console.log('[Envelope] Periodic session check...');
        const stillValid = await verifySessionViaAPI();
        if (!stillValid) {
            console.log('[Envelope] Session expired during use');
            showState('authRequired');
            showSessionExpiredMessage();
        }
    }, 3 * 60 * 1000);

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const url = tab.url;

        const context = detectContext(url);

        if (context === 'unsupported') {
            showState('unsupported');
            return;
        }

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

// Show session expired message
function showSessionExpiredMessage() {
    const msgEl = document.getElementById('auth-message');
    if (msgEl) {
        msgEl.textContent = 'Session expired. Please sign in again.';
        msgEl.style.display = 'block';
    }
}

// Verify session using /api/health/auth (SINGLE SOURCE OF TRUTH)
// This is the deterministic approach - always returns auth state
async function verifySessionViaAPI() {
    const debugPanel = document.getElementById('auth-debug-panel');
    const debugOrigin = document.getElementById('debug-web-origin');
    const debugSession = document.getElementById('debug-session-status');
    const debugUser = document.getElementById('debug-user-email');
    const debugError = document.getElementById('debug-last-error');
    const btnCopyDebug = document.getElementById('btn-copy-debug');

    // Show debug panel
    if (debugPanel) debugPanel.style.display = 'block';

    const debugInfo = {
        timestamp: new Date().toISOString(),
        webOrigin: API_BASE,
        endpoint: `${API_BASE}/api/health/auth`,
        response: null,
        error: null,
        bucket: null
    };

    try {
        console.log('[Envelope] Checking auth health at:', debugInfo.endpoint);
        if (debugOrigin) debugOrigin.textContent = `Origin: ${API_BASE}`;
        if (debugSession) debugSession.textContent = 'Session: checking...';

        const response = await fetch(`${API_BASE}/api/health/auth`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Accept': 'application/json'
            }
        });

        console.log('[Envelope] Health API status:', response.status);
        debugInfo.responseStatus = response.status;

        if (!response.ok) {
            debugInfo.error = `HTTP ${response.status}`;
            debugInfo.bucket = 'BUCKET 4: API returned error';
            if (debugSession) debugSession.textContent = `Session: API error (${response.status})`;
            if (debugError) debugError.textContent = `Error: ${debugInfo.bucket}`;
            updateCopyDebugButton(btnCopyDebug, debugInfo);
            return false;
        }

        const data = await response.json();
        debugInfo.response = data;
        console.log('[Envelope] Health check response:', data);

        // Update debug panel
        if (debugSession) {
            debugSession.textContent = `Session: ${data.hasSession ? 'ACTIVE' : 'NONE'}`;
            debugSession.style.color = data.hasSession ? '#059669' : '#dc2626';
        }
        if (debugUser) {
            debugUser.textContent = `User: ${data.user?.email || 'none'}`;
        }

        // Analyze response for bucket classification
        if (data.hasSession && data.user) {
            debugInfo.bucket = 'SUCCESS';
            if (debugError) debugError.textContent = 'Error: none';

            // Store in chrome.storage
            await chrome.storage.local.set({
                authToken: 'verified',
                userEmail: data.user.email
            });

            // Update UI
            if (elements.userEmail) {
                elements.userEmail.textContent = data.user.email;
            }
            if (elements.userBadge) {
                elements.userBadge.classList.remove('hidden');
            }

            authToken = 'verified';
            updateCopyDebugButton(btnCopyDebug, debugInfo);
            return true;
        }

        // No session - classify the bucket
        if (!data.debug?.hasAuthCookies) {
            debugInfo.bucket = 'BUCKET 1: No auth cookies present';
        } else if (data.debug?.host !== new URL(API_BASE).host) {
            debugInfo.bucket = 'BUCKET 2: Cookie on wrong domain';
        } else {
            debugInfo.bucket = 'BUCKET 3/5: Cookie present but session not valid';
        }

        if (debugError) debugError.textContent = `Error: ${debugInfo.bucket}`;
        console.log('[Envelope] Auth failed -', debugInfo.bucket);

        // Clear stored auth
        await chrome.storage.local.remove(['authToken', 'userEmail']);
        updateCopyDebugButton(btnCopyDebug, debugInfo);
        return false;

    } catch (error) {
        console.error('[Envelope] Health check failed:', error);
        debugInfo.error = error.message;
        debugInfo.bucket = 'BUCKET 4: Network/CORS error';

        if (debugSession) debugSession.textContent = 'Session: NETWORK ERROR';
        if (debugError) debugError.textContent = `Error: ${error.message}`;

        updateCopyDebugButton(btnCopyDebug, debugInfo);
        return false;
    }
}

// Helper to set up copy debug button
function updateCopyDebugButton(btn, debugInfo) {
    if (!btn) return;
    btn.onclick = () => {
        const text = JSON.stringify(debugInfo, null, 2);
        navigator.clipboard.writeText(text).then(() => {
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.textContent = 'Copy Debug Info'; }, 2000);
        });
    };
}

// Detect page context - enhanced for Phase 9
function detectContext(url) {
    if (!url) return 'unsupported';

    // Chrome internal pages
    if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
        return 'unsupported';
    }

    // LinkedIn
    if (url.includes('linkedin.com/in/')) return 'linkedin_person';
    if (url.includes('linkedin.com/company/')) return 'linkedin_company';

    // Google Maps / Places
    if (url.includes('google.com/maps') || url.includes('maps.google')) {
        return 'google_maps';
    }

    // Directories
    if (url.includes('clutch.co/profile/')) return 'directory_clutch';
    if (url.includes('yelp.com/biz/')) return 'directory_yelp';
    if (url.includes('yell.com/biz/')) return 'directory_yell';
    if (url.includes('trustpilot.com/review/')) return 'directory_trustpilot';
    if (url.includes('g2.com/products/')) return 'directory_g2';
    if (url.includes('capterra.com/')) return 'directory_capterra';

    // Any website
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return 'website';
    }

    return 'unsupported';
}

// Get page data via content script - enhanced for Phase 9
async function getPageData(tabId, context, url) {
    try {
        if (context.startsWith('linkedin_')) {
            const results = await chrome.scripting.executeScript({
                target: { tabId },
                func: parseLinkedInPage,
                args: [context]
            });
            return results[0]?.result;
        }

        if (context === 'google_maps') {
            const results = await chrome.scripting.executeScript({
                target: { tabId },
                func: parseGoogleMapsPage
            });
            return results[0]?.result;
        }

        if (context.startsWith('directory_')) {
            const results = await chrome.scripting.executeScript({
                target: { tabId },
                func: parseDirectoryPage,
                args: [context]
            });
            return results[0]?.result;
        }

        if (context === 'website') {
            const results = await chrome.scripting.executeScript({
                target: { tabId },
                func: parseWebsitePage
            });
            return results[0]?.result;
        }
    } catch (e) {
        console.error('Script injection failed:', e);
        return extractFromUrl(url);
    }
    return null;
}

// LinkedIn page parser
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
        const nameEl = document.querySelector('h1.text-heading-xlarge');
        const titleEl = document.querySelector('.text-body-medium.break-words');

        data.contactName = nameEl?.textContent?.trim() || '';
        data.jobTitle = titleEl?.textContent?.trim() || '';

        const experienceSection = document.querySelector('#experience');
        if (experienceSection) {
            const companyEl = experienceSection.querySelector('.t-bold span[aria-hidden="true"]');
            data.companyName = companyEl?.textContent?.trim() || '';
        }

        if (!data.companyName && data.jobTitle) {
            const match = data.jobTitle.match(/at\s+(.+)$/i);
            if (match) data.companyName = match[1].trim();
        }
    }

    if (context === 'linkedin_company') {
        const nameEl = document.querySelector('h1.org-top-card-summary__title');
        const websiteEl = document.querySelector('a[data-test-id="about-us-link"]');

        data.companyName = nameEl?.textContent?.trim() || '';
        data.website = websiteEl?.href || '';

        if (!data.companyName) {
            const altName = document.querySelector('.org-top-card-summary__title span');
            data.companyName = altName?.textContent?.trim() || '';
        }
    }

    return data;
}

// Google Maps page parser
function parseGoogleMapsPage() {
    const data = {
        companyName: '',
        website: '',
        phone: '',
        address: '',
        email: '',
        contactName: '',
        jobTitle: ''
    };

    // Try to get business name from heading
    const nameEl = document.querySelector('h1.DUwDvf, h1[data-attrid="title"]');
    if (nameEl) data.companyName = nameEl.textContent.trim();

    // Try to get website link
    const websiteEl = document.querySelector('a[data-item-id="authority"]');
    if (websiteEl) data.website = websiteEl.href;

    // Try to get phone
    const phoneEl = document.querySelector('button[data-item-id^="phone"]');
    if (phoneEl) data.phone = phoneEl.textContent.replace(/[^\d+]/g, '');

    // Try to get address
    const addressEl = document.querySelector('button[data-item-id="address"]');
    if (addressEl) data.address = addressEl.textContent.trim();

    return data;
}

// Directory page parser (Clutch, Yelp, Yell, Trustpilot, G2, Capterra)
function parseDirectoryPage(context) {
    const data = {
        companyName: '',
        website: '',
        phone: '',
        email: '',
        contactName: '',
        jobTitle: '',
        rating: '',
        reviews: ''
    };

    // Generic selectors that work across directories
    const nameSelectors = [
        'h1',
        '.company-name',
        '.biz-page-title',
        '[data-testid="biz-name"]',
        '.profile-header h1',
    ];

    for (const sel of nameSelectors) {
        const el = document.querySelector(sel);
        if (el && el.textContent.trim().length > 1) {
            data.companyName = el.textContent.trim();
            break;
        }
    }

    // Try to find website link
    const websiteSelectors = [
        'a[href^="http"][rel*="nofollow"]',
        '.website-link',
        '.biz-website a',
        'a[data-tracking-element-type="cta_url"]',
    ];

    for (const sel of websiteSelectors) {
        const el = document.querySelector(sel);
        if (el && el.href && !el.href.includes(window.location.hostname)) {
            data.website = el.href;
            break;
        }
    }

    // Try to find phone
    const phoneSelectors = [
        'a[href^="tel:"]',
        '.phone-number',
        '.biz-phone',
    ];

    for (const sel of phoneSelectors) {
        const el = document.querySelector(sel);
        if (el) {
            data.phone = el.href?.replace('tel:', '') || el.textContent.trim();
            break;
        }
    }

    return data;
}

// Website parser
function parseWebsitePage() {
    const data = {
        companyName: '',
        website: window.location.origin,
        email: '',
        contactName: '',
        jobTitle: ''
    };

    const sources = [
        () => document.querySelector('meta[property="og:site_name"]')?.content,
        () => document.querySelector('meta[name="application-name"]')?.content,
        () => {
            const title = document.title;
            return title.split(/[|\-–—]/)[0].trim();
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

    return data;
}

// URL fallback
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

// Populate form
function populateForm(data) {
    elements.fieldCompany.value = data.companyName || '';
    elements.fieldWebsite.value = data.website || '';
    elements.detailSource.textContent = data.sourceUrl || '';
    elements.detailType.textContent = data.context || '';

    // If person profile, add them as initial contact
    if (data.context === 'linkedin_person' && data.contactName) {
        addContact({
            name: data.contactName,
            role: data.jobTitle || '',
            email: data.email || '',
            confidence: data.email ? 'likely' : 'missing',
            source: 'linkedin'
        });
    }

    updateComposeButton();
}

// Render contacts list
function renderContacts() {
    if (contacts.length === 0) {
        elements.contactsList.innerHTML = `
            <div class="contacts-empty">
                <p>No contacts yet</p>
                <span>Click "Find contacts" to search</span>
            </div>
        `;
        elements.contactsSelectAll.classList.add('hidden');
    } else {
        elements.contactsList.innerHTML = contacts.map(c => createContactRow(c)).join('');

        // Show select all/none if 4+ contacts
        elements.contactsSelectAll.classList.toggle('hidden', contacts.length < 4);

        // Attach event listeners
        contacts.forEach(c => {
            const row = document.querySelector(`[data-contact-id="${c.id}"]`);
            if (!row) return;

            const checkbox = row.querySelector('.contact-checkbox');
            const nameInput = row.querySelector('.contact-name');
            const roleInput = row.querySelector('.contact-role');
            const emailInput = row.querySelector('.contact-email');
            const removeBtn = row.querySelector('.contact-remove');

            checkbox?.addEventListener('change', (e) => {
                c.selected = e.target.checked;
                updateComposeButton();
            });

            nameInput?.addEventListener('input', (e) => {
                c.name = e.target.value;
            });

            roleInput?.addEventListener('input', (e) => {
                c.role = e.target.value;
            });

            emailInput?.addEventListener('input', (e) => {
                c.email = e.target.value;
                validateEmail(emailInput, c);
                updateComposeButton();
            });

            removeBtn?.addEventListener('click', () => {
                removeContact(c.id);
            });
        });
    }

    updateComposeButton();
}

// Create contact row HTML
function createContactRow(contact) {
    const hasEmail = contact.email && contact.email.length > 0;
    const isValidEmail = hasEmail && emailRegex.test(contact.email);

    // For suggested contacts, use different styling
    if (contact.isSuggested) {
        return createSuggestedContactRow(contact);
    }

    // Confidence/verification badge
    let badgeClass, badgeText;
    if (contact.verificationStatus === 'valid') {
        badgeClass = 'badge-valid';
        badgeText = '✓ Verified';
    } else if (contact.verificationStatus === 'invalid') {
        badgeClass = 'badge-invalid';
        badgeText = '✗ Invalid';
    } else if (contact.verificationStatus === 'risky') {
        badgeClass = 'badge-risky';
        badgeText = '⚠ Risky';
    } else if (contact.confidence === 'verified') {
        badgeClass = 'badge-verified';
        badgeText = 'Verified';
    } else if (contact.confidence === 'likely') {
        badgeClass = 'badge-likely';
        badgeText = 'Likely';
    } else {
        badgeClass = hasEmail ? 'badge-unknown' : 'badge-missing';
        badgeText = hasEmail ? 'Unknown' : 'Missing';
    }

    // Type indicator
    const typeLabel = contact.type === 'person' ? '👤' : '📧';

    // Source/extra badges
    let extraBadges = '';
    if (contact.isBestContact) {
        extraBadges += '<span class="badge badge-best">⭐ Best</span>';
    }
    if (contact.isCatchAll) {
        extraBadges += '<span class="badge badge-catchall">Catch-all</span>';
    }
    if (contact.source === 'pdf') {
        extraBadges += '<span class="badge badge-pdf">📄 PDF</span>';
    } else if (contact.isGeneric) {
        extraBadges += '<span class="badge badge-generic">Generic</span>';
    }

    // Evidence tooltip
    const evidenceHtml = contact.evidence?.url ?
        `<span class="contact-evidence" title="Found on: ${escapeHtml(contact.evidence.pageType || 'page')}&#10;${escapeHtml(contact.evidence.snippet || '')}">
            📍 ${escapeHtml(contact.evidence.pageType || contact.source || '')}
        </span>` : '';

    // Deliverability warning
    let warningHtml = '';
    if (contact.verificationStatus === 'invalid') {
        warningHtml = '<div class="contact-warning">⚠️ This email may not be deliverable</div>';
    }

    return `
        <div class="contact-row ${contact.isGeneric ? 'contact-generic' : ''} ${contact.isBestContact ? 'contact-best' : ''} ${contact.verificationStatus === 'invalid' ? 'contact-invalid' : ''}" data-contact-id="${contact.id}">
            <input type="checkbox" class="contact-checkbox" ${contact.selected ? 'checked' : ''} ${contact.verificationStatus === 'invalid' ? 'disabled' : ''}>
            <div class="contact-info">
                <div class="contact-name-row">
                    <span class="contact-type-icon" title="${contact.type === 'person' ? 'Person' : 'Generic'}">${typeLabel}</span>
                    <input type="text" class="contact-name" value="${escapeHtml(contact.name)}" placeholder="Name">
                </div>
                <input type="text" class="contact-role" value="${escapeHtml(contact.role || '')}" placeholder="Role / Title">
                <div class="contact-email-row">
                    <input type="email" class="contact-email ${!isValidEmail && hasEmail ? 'error' : ''}" 
                           value="${escapeHtml(contact.email || '')}" placeholder="email@example.com">
                    <span class="badge ${badgeClass}">${badgeText}</span>
                    ${extraBadges}
                </div>
                ${evidenceHtml}
                ${warningHtml}
            </div>
            <button class="contact-remove" title="Remove">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
            </button>
        </div>
    `;
}

// Create suggested contact row (from Companies House)
function createSuggestedContactRow(contact) {
    const hasEmail = contact.hasEmail !== false && !contact.email.startsWith('[');

    const verifyBtnText = !hasEmail ? '' :
        contact.verificationStatus === 'pending' ? 'Verify' :
            contact.verificationStatus === 'valid' ? '✓ Valid' :
                contact.verificationStatus === 'invalid' ? '✗ Invalid' : 'Check';

    const verifyBtnClass = contact.verificationStatus === 'valid' ? 'btn-verified' :
        contact.verificationStatus === 'invalid' ? 'btn-invalid' : '';

    const badgeText = hasEmail ? 'Suggested' : 'Director';
    const badgeClass = hasEmail ? 'badge-suggested' : 'badge-info';

    return `
        <div class="contact-row contact-suggested ${!hasEmail ? 'contact-info-only' : ''}" data-contact-id="${contact.id}">
            ${hasEmail ? `<input type="checkbox" class="contact-checkbox" ${contact.selected ? 'checked' : ''}>` : '<span class="contact-checkbox-placeholder"></span>'}
            <div class="contact-info">
                <div class="contact-name-row">
                    <span class="contact-type-icon" title="Director (Companies House)">🏛️</span>
                    <span class="contact-name-text">${escapeHtml(contact.name)}</span>
                </div>
                <span class="contact-role-text">${escapeHtml(contact.role || 'Director')}</span>
                <div class="contact-email-row">
                    <span class="contact-email-suggested">${hasEmail ? escapeHtml(contact.email) : 'No verified email pattern'}</span>
                    <span class="badge ${badgeClass}">${badgeText}</span>
                </div>
            </div>
            <div class="contact-actions">
                ${hasEmail ? `<button class="btn-verify ${verifyBtnClass}" onclick="verifyEmail(${contact.id})">${verifyBtnText}</button>` : ''}
                ${hasEmail ? `<button class="btn-use" onclick="useSuggestedContact(${contact.id})">Use</button>` : ''}
            </div>
        </div>
    `;
}

// Escape HTML
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Add contact
function addContact(data) {
    const contact = {
        id: ++contactIdCounter,
        name: data.name || '',
        role: data.role || '',
        email: data.email || '',
        type: data.type || 'person',
        confidence: data.confidence || 'unknown',
        source: data.source || 'manual',
        evidence: data.evidence || null,
        isGeneric: data.isGeneric || false,
        selected: data.email && !data.isGeneric ? true : false
    };
    contacts.push(contact);
    renderContacts();
}

// Remove contact
function removeContact(id) {
    contacts = contacts.filter(c => c.id !== id);
    renderContacts();
}

// Validate email field
function validateEmail(input, contact) {
    const value = input.value.trim();
    if (value && !emailRegex.test(value)) {
        input.classList.add('error');
        contact.confidence = 'unknown';
    } else {
        input.classList.remove('error');
        if (value) {
            contact.confidence = contact.confidence === 'missing' ? 'unknown' : contact.confidence;
        } else {
            contact.confidence = 'missing';
        }
    }
}

// Update compose button state
function updateComposeButton() {
    const selectedWithValidEmail = contacts.filter(c =>
        c.selected && c.email && emailRegex.test(c.email)
    );
    elements.btnCompose.disabled = selectedWithValidEmail.length === 0;
}

// Find contacts using Phase 3 email discovery v3
async function findContacts() {
    const website = elements.fieldWebsite.value.trim();

    if (!website) {
        elements.fieldWebsite.classList.add('error');
        elements.fieldWebsite.focus();
        return;
    }
    elements.fieldWebsite.classList.remove('error');

    // Hide any previous error
    elements.contactsError?.classList.add('hidden');

    elements.btnFindContacts.disabled = true;
    elements.contactsList.classList.add('hidden');
    elements.contactsLoading.classList.remove('hidden');

    // Update loading text
    const loadingText = elements.contactsLoading.querySelector('p');
    if (loadingText) {
        loadingText.textContent = 'Scanning company site + public web...';
    }

    // Use unified v3 endpoint (people-first)
    const requestUrl = `${API_BASE}/api/contact-discovery/run`;
    updateDebug({
        requestId: 'pending...',
        domain: extractDomain(website),
        error: '-'
    });

    let responseRequestId = '';

    try {
        console.log('[Envelope V3] Starting people-first discovery for:', website);

        const res = await fetch(requestUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                domain: extractDomain(website),
                includeWebsiteCrawl: true,
                includeCompaniesHouse: true,
                verifyTopN: 10
            })
        });

        responseRequestId = res.headers.get('x-request-id') || '';
        const result = await res.json();

        console.log('[Envelope V3] Result:', result);

        // Update debug info
        updateDebug({
            requestId: result.requestId || responseRequestId || '-',
            domain: extractDomain(website),
            pages: result.stats?.pagesCrawled || '-',
            public: result.stats?.publicResultsFetched || 0,
            pdfs: result.stats?.pdfsParsed || 0,
            duration: result.stats?.durationMs ? `${result.stats.durationMs}ms` : '-',
            pattern: result.patterns?.length > 0
                ? result.patterns.map(p => `${p.pattern} (${p.verified ? 'verified' : 'likely'})`).join(', ')
                : 'none',
            error: result.error || result.warnings?.join(', ') || '-'
        });

        // Handle error
        if (!result.success) {
            showContactsError(result.error || 'Discovery failed');
            return;
        }

        // Clear existing contacts (except manual)
        contacts = contacts.filter(c => c.source === 'manual');

        // Add best contacts first (highlighted)
        if (result.bestContacts?.length > 0) {
            console.log('[Envelope V3] Best contacts:', result.bestContacts.length);
            result.bestContacts.forEach(c => {
                if (!contacts.find(existing => existing.email === c.email)) {
                    addContact({
                        name: c.name || '',
                        role: c.role || '',
                        email: c.email,
                        type: 'person',
                        confidence: c.confidence || 'high',
                        source: c.sources?.[0]?.type || 'website',
                        evidence: c.sources?.[0] || null,
                        isGeneric: false,
                        isBestContact: true
                    });
                }
            });
        }

        // Add other emails
        if (result.emails?.length > 0) {
            result.emails.forEach(e => {
                if (!contacts.find(existing => existing.email === e.email)) {
                    addContact({
                        name: e.name || '',
                        role: e.role || '',
                        email: e.email,
                        type: e.isGeneric ? 'generic' : 'person',
                        confidence: e.confidence || 'medium',
                        source: e.sources?.[0]?.type || 'website',
                        evidence: e.sources?.[0] || null,
                        isGeneric: e.isGeneric || false
                    });
                }
            });
        }

        // Show patterns
        if (result.patterns?.length > 0) {
            showPatternInfo(result.patterns);
        }

        // Always try Companies House enrichment for UK companies
        const verifiedPattern = result.patterns?.find(p => p.verified) || null;
        await enrichWithDirectors(extractDomain(website), result.emails || [], verifiedPattern);

        // Auto-verify top 8 contacts
        await autoVerifyTopContacts(8);

        // Auto-select best contact
        autoSelectBestContact();

    } catch (e) {
        console.error('[Envelope V3] Error:', e.message || e);
        showContactsError(`Network error: ${e.message || 'Connection failed'}`);
        updateDebug({ error: e.message || 'Network error', requestId: responseRequestId || 'N/A' });
    } finally {
        elements.btnFindContacts.disabled = false;
        elements.contactsLoading.classList.add('hidden');
        elements.contactsList.classList.remove('hidden');
        renderContacts();
    }
}

// Enrich with UK directors from Companies House
async function enrichWithDirectors(domain, foundEmails, pattern) {
    try {
        const companyName = elements.fieldCompany.value.trim();
        if (!companyName) return;

        console.log('[Envelope V3] Attempting UK director enrichment for:', companyName);

        // Resolve company
        const resolveRes = await fetch(`${API_BASE}/api/enrichment/companies-house/resolve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ companyName })
        });

        const resolveData = await resolveRes.json();

        // Accept matched or uncertain (with candidates)
        let companyNumber = resolveData.companyNumber;
        if (!companyNumber && resolveData.candidates?.length > 0) {
            // Use top candidate
            companyNumber = resolveData.candidates[0].companyNumber;
            console.log('[Envelope V3] Using top CH candidate:', companyNumber);
        }

        if (!companyNumber) {
            console.log('[Envelope V3] No CH match found');
            return;
        }

        // Fetch officers directly
        const officersRes = await fetch(`${API_BASE}/api/enrichment/companies-house/officers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ companyNumber })
        });

        const officersData = await officersRes.json();

        if (!officersData.success || !officersData.decisionMakers?.length) {
            console.log('[Envelope V3] No decision makers found');
            return;
        }

        console.log('[Envelope V3] Found', officersData.decisionMakers.length, 'decision makers');
        updateDebug({ directors: officersData.decisionMakers.length });

        // If we have a verified pattern, generate email suggestions
        // Otherwise show directors as informational only (no email)
        const canSuggestEmails = pattern?.verified && foundEmails?.length > 0;

        for (const officer of officersData.decisionMakers) {
            // Generate suggested email if pattern exists
            let suggestedEmail = null;
            if (canSuggestEmails && pattern) {
                suggestedEmail = generatePatternEmail(officer.firstName, officer.lastName, pattern.pattern, domain);
            }

            // Skip if email already exists
            if (suggestedEmail && contacts.find(c => c.email === suggestedEmail)) continue;

            addSuggestedContact({
                name: officer.fullName,
                role: officer.role,
                email: suggestedEmail || `[${officer.role}]`, // Show role if no email
                patternType: canSuggestEmails ? 'pattern' : 'info',
                confidence: canSuggestEmails ? 'likely' : 'info',
                source: 'companies_house',
                hasEmail: !!suggestedEmail
            });
        }

        renderContacts();

    } catch (err) {
        console.log('[Envelope V3] Director enrichment error:', err.message);
    }
}

// Generate email from pattern
function generatePatternEmail(firstName, lastName, patternStr, domain) {
    if (!firstName || !lastName) return null;

    const first = firstName.toLowerCase().replace(/[^a-z]/g, '');
    const last = lastName.toLowerCase().replace(/[^a-z]/g, '');
    const fInitial = first[0] || '';

    // Pattern is like "first.last@domain.com", extract the format
    const format = patternStr.split('@')[0];

    switch (format) {
        case 'first.last': return `${first}.${last}@${domain}`;
        case 'first': return `${first}@${domain}`;
        case 'f.last': return `${fInitial}.${last}@${domain}`;
        case 'firstlast': return `${first}${last}@${domain}`;
        case '{f}last': return `${fInitial}${last}@${domain}`;
        case '{f}.last': return `${fInitial}.${last}@${domain}`;
        default: return `${first}.${last}@${domain}`;
    }
}

// Add suggested contact (separate from found contacts)
function addSuggestedContact(data) {
    const contact = {
        id: ++contactIdCounter,
        name: data.name || '',
        role: data.role || '',
        email: data.email || '',
        type: 'suggested',
        confidence: data.confidence || 'likely',
        source: data.source || 'companies_house',
        patternType: data.patternType,
        isSuggested: true,
        hasEmail: data.hasEmail !== false, // true unless explicitly false
        verificationStatus: 'pending',
        selected: false // Suggested contacts not selected by default
    };
    contacts.push(contact);
}

// Verify a suggested email
async function verifyEmail(contactId) {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact || !contact.isSuggested) return;

    const btn = document.querySelector(`[data-contact-id="${contactId}"] .btn-verify`);
    if (btn) btn.textContent = '...';

    try {
        const res = await fetch(`${API_BASE}/api/enrichment/email/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: contact.email })
        });

        const data = await res.json();

        if (data.success) {
            contact.verificationStatus = data.status;
            if (data.status === 'valid') {
                contact.confidence = 'verified';
                contact.selected = true;
            }
            renderContacts();
        }
    } catch (err) {
        console.log('[Envelope V3] Verify error:', err.message);
    }
}

// Use a suggested contact (promote to regular)
function useSuggestedContact(contactId) {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;

    contact.isSuggested = false;
    contact.selected = true;
    contact.type = 'person';
    renderContacts();
}

// Auto-verify top N contacts (budget control)
async function autoVerifyTopContacts(n = 8) {
    console.log(`[Envelope V3] Auto-verifying top ${n} contacts`);

    // Get valid email contacts (not suggested without email)
    const verifiable = contacts.filter(c =>
        c.email &&
        !c.email.startsWith('[') &&
        c.verificationStatus === 'pending'
    );

    // Score and sort to get top N
    const scored = verifiable.map(c => ({
        ...c,
        score: scoreContact(c)
    })).sort((a, b) => b.score - a.score);

    const toVerify = scored.slice(0, n);

    for (const contact of toVerify) {
        try {
            const res = await fetch(`${API_BASE}/api/email/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: contact.email })
            });

            const data = await res.json();

            if (data.success) {
                contact.verificationStatus = data.status;
                contact.isCatchAll = data.isCatchAll;
                contact.isRoleAccount = data.isRoleAccount;

                if (data.status === 'valid') {
                    contact.confidence = 'verified';
                }

                console.log(`[Envelope V3] Verified ${contact.email}: ${data.status}`);
            }
        } catch (err) {
            console.log(`[Envelope V3] Verify failed for ${contact.email}`);
        }
    }

    renderContacts();
}

// Contact scoring for best selection
function scoreContact(contact) {
    let score = 0;

    // Role scoring (0-40)
    const role = (contact.role || '').toLowerCase();
    if (role.includes('ceo') || role.includes('founder') || role.includes('director')) score += 40;
    else if (role.includes('marketing') || role.includes('growth')) score += 38;
    else if (role.includes('partner') || role.includes('business')) score += 35;
    else if (role.includes('operations')) score += 25;
    else if (role) score += 15;
    else score += 8;

    // Email quality scoring (0-40)
    if (contact.verificationStatus === 'valid') {
        score += contact.isGeneric ? 25 : 40;
    } else if (contact.verificationStatus === 'risky') {
        score += 8;
    } else if (contact.verificationStatus === 'invalid') {
        score += 0;
    } else if (contact.isSuggested) {
        score += 10;
    } else {
        score += contact.isGeneric ? 20 : 25;
    }

    // Evidence scoring (0-20)
    if (contact.evidence?.pageType?.includes('team')) score += 20;
    else if (contact.evidence?.type === 'contact') score += 15;
    else if (contact.evidence?.type === 'pdf') score += 15;
    else if (contact.isSuggested) score += 10;
    else score += 12;

    return score;
}

// Auto-select best contact
function autoSelectBestContact() {
    if (contacts.length === 0) return;

    // Score all contacts
    const scored = contacts.map(c => ({
        contact: c,
        score: scoreContact(c)
    })).sort((a, b) => b.score - a.score);

    // Mark best contact
    scored.forEach(({ contact }, index) => {
        contact.isBestContact = index === 0;

        // Auto-select best contact (if valid and not invalid)
        if (index === 0 && contact.verificationStatus !== 'invalid') {
            contact.selected = true;
        }
    });

    console.log(`[Envelope V3] Best contact: ${scored[0]?.contact.email} (score: ${scored[0]?.score})`);

    renderContacts();
    updateComposeButton();
}

// Show pattern info
function showPatternInfo(patterns) {
    for (const p of patterns) {
        const status = p.verified ? `✓ Verified (${p.matches} matches)` : `Likely (${p.matches} match)`;
        console.log(`[Envelope V3] Pattern: ${p.pattern} - ${status}`);
    }
}

// Update debug UI with enhanced diagnostics
function updateDebug(info) {
    if (info.requestId !== undefined && elements.debugRequestId) {
        elements.debugRequestId.textContent = info.requestId;
    }
    if (info.domain !== undefined && elements.debugDomain) {
        elements.debugDomain.textContent = info.domain;
    }
    if (info.apex !== undefined && elements.debugApex) {
        elements.debugApex.textContent = info.apex;
    }
    if (info.providers !== undefined && elements.debugProviders) {
        elements.debugProviders.textContent = info.providers;
    }
    if (info.count !== undefined && elements.debugCount) {
        elements.debugCount.textContent = info.count.toString();
    }
    if (info.heuristic !== undefined && elements.debugHeuristic) {
        elements.debugHeuristic.textContent = info.heuristic;
    }
    if (info.error !== undefined && elements.debugError) {
        elements.debugError.textContent = info.error;
    }

    // Enhanced diagnostics
    if (info.pages !== undefined) {
        const el = document.getElementById('debug-pages');
        if (el) el.textContent = info.pages;
    }
    if (info.public !== undefined) {
        const el = document.getElementById('debug-public');
        if (el) el.textContent = info.public.toString();
    }
    if (info.pdfs !== undefined) {
        const el = document.getElementById('debug-pdfs');
        if (el) el.textContent = info.pdfs.toString();
    }
    if (info.duration !== undefined) {
        const el = document.getElementById('debug-duration');
        if (el) el.textContent = info.duration;
    }
    if (info.pattern !== undefined) {
        const el = document.getElementById('debug-pattern');
        if (el) el.textContent = info.pattern;
    }
    if (info.cache !== undefined) {
        const el = document.getElementById('debug-cache');
        if (el) el.textContent = info.cache ? 'HIT' : 'MISS';
    }
    if (info.directors !== undefined) {
        const el = document.getElementById('debug-directors');
        if (el) el.textContent = info.directors.toString();
    }
}

// Show inline error for contacts
function showContactsError(message) {
    if (elements.contactsError && elements.contactsErrorMessage) {
        elements.contactsErrorMessage.textContent = message;
        elements.contactsError.classList.remove('hidden');
    }
}

// Extract domain from URL
function extractDomain(url) {
    try {
        const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
        return parsed.hostname.replace(/^www\./, '');
    } catch (e) {
        return url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
    }
}

// Capture (add to envelope)
async function capture(compose = false) {
    const companyName = elements.fieldCompany.value.trim();
    const website = elements.fieldWebsite.value.trim();

    if (!companyName) {
        elements.fieldCompany.classList.add('error');
        elements.fieldCompany.focus();
        return;
    }
    elements.fieldCompany.classList.remove('error');

    // Get selected contacts with valid emails
    const selectedContacts = contacts.filter(c => c.selected);

    if (compose) {
        const validEmailContacts = selectedContacts.filter(c => c.email && emailRegex.test(c.email));
        if (validEmailContacts.length === 0) {
            return; // Button should be disabled but double-check
        }
    }

    elements.btnAdd.disabled = true;
    elements.btnCompose.disabled = true;

    try {
        const payload = {
            type: currentData.context,
            sourceUrl: currentData.sourceUrl,
            data: {
                companyName,
                website,
                linkedinUrl: currentData.linkedinUrl
            },
            contacts: selectedContacts.map(c => ({
                name: c.name,
                role: c.role,
                email: c.email || null,
                confidence: c.confidence,
                source: c.source
            }))
        };

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
        elements.successMessage.textContent = `Added ${companyName} to Envelope`;
        elements.viewLink.href = `${API_BASE}/prospects?prospectId=${result.prospectId}`;

        if (compose) {
            // Get first selected contact with valid email
            const toEmail = selectedContacts.find(c => c.email && emailRegex.test(c.email))?.email;
            if (toEmail && result.prospectId) {
                chrome.tabs.create({
                    url: `${API_BASE}/compose?prospectId=${result.prospectId}&to=${encodeURIComponent(toEmail)}`
                });
            }
        }

        showState('success');

    } catch (e) {
        console.error('Capture error:', e);
        showError(e.message || 'Failed to add to Envelope');
    } finally {
        elements.btnAdd.disabled = false;
        updateComposeButton();
    }
}

function showError(message) {
    elements.errorMessage.textContent = message;
    showState('error');
}

// Sign in - opens dedicated extension auth page
function handleSignIn() {
    console.log('[Envelope] Starting sign-in flow...');
    // Use the new /auth/extension page that handles sign-in properly
    chrome.tabs.create({ url: `${API_BASE}/auth/extension` });
}

// Convert to Lead (full pipeline)
async function convertToLead() {
    const companyName = elements.fieldCompany.value.trim();
    const website = elements.fieldWebsite.value.trim();

    if (!companyName || !website) {
        alert('Company name and website required');
        return;
    }

    const domain = extractDomain(website);

    if (elements.btnConvert) elements.btnConvert.disabled = true;
    if (elements.btnConvertText) elements.btnConvertText.textContent = 'Converting...';

    try {
        console.log('[Envelope] Starting conversion pipeline...');

        // Step 1: Update UI
        if (elements.btnConvertText) elements.btnConvertText.textContent = 'Discovering...';

        const res = await fetch(`${API_BASE}/api/prospects/convert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prospectId: `ext_${Date.now()}`,
                companyName,
                domain,
                website,
            }),
        });

        const data = await res.json();

        if (!data.success) {
            throw new Error(data.error || 'Conversion failed');
        }

        console.log('[Envelope] Conversion complete:', data);

        // Show opportunity card
        showOpportunityScore(data.opportunityScore, data.recommendedAction, data.summary);

        // Update contacts if found
        if (data.contacts?.length > 0) {
            contacts = [];
            data.contacts.forEach(c => {
                addContact({
                    name: c.name || '',
                    role: c.role || '',
                    email: c.email,
                    type: 'person',
                    confidence: c.verified ? 'verified' : 'medium',
                    verificationStatus: c.verified ? 'valid' : 'pending',
                });
            });
            renderContacts();
        }

        // Success
        if (elements.btnConvertText) {
            elements.btnConvertText.textContent = '✓ Converted';
        }

    } catch (err) {
        console.error('[Envelope] Convert error:', err);
        if (elements.btnConvertText) elements.btnConvertText.textContent = 'Convert failed';
    } finally {
        if (elements.btnConvert) elements.btnConvert.disabled = false;
    }
}

// Display opportunity score
function showOpportunityScore(score, action, summary) {
    if (!elements.opportunityCard || !score) return;

    elements.opportunityCard.classList.remove('hidden');

    // Total score
    if (elements.opportunityScore) {
        elements.opportunityScore.textContent = score.total;
        elements.opportunityScore.className = `opportunity-score score-${getScoreClass(score.total)}`;
    }

    // Breakdown bars
    if (elements.scoreNeed) elements.scoreNeed.style.width = `${(score.need / 40) * 100}%`;
    if (elements.scoreAbility) elements.scoreAbility.style.width = `${(score.ability / 35) * 100}%`;
    if (elements.scoreConfidence) elements.scoreConfidence.style.width = `${(score.confidence / 25) * 100}%`;

    if (elements.scoreNeedVal) elements.scoreNeedVal.textContent = score.need + '/40';
    if (elements.scoreAbilityVal) elements.scoreAbilityVal.textContent = score.ability + '/35';
    if (elements.scoreConfidenceVal) elements.scoreConfidenceVal.textContent = score.confidence + '/25';

    // Action recommendation
    if (elements.opportunityAction && action) {
        const actionClass = action.type === 'compose' ? 'action-compose' :
            action.type === 'add_pipeline' ? 'action-add' : 'action-review';

        elements.opportunityAction.innerHTML = `
            <div class="action-recommendation ${actionClass}">
                <span class="action-label">${action.label}</span>
                ${action.reason?.length > 0 ? `<span class="action-reason">${action.reason[0]}</span>` : ''}
            </div>
        `;

        // If summary available
        if (summary) {
            elements.opportunityAction.innerHTML += `
                <div class="action-summary">
                    ${summary.contactsFound} contacts • ${summary.contactsVerified} verified • ${Math.round(summary.durationMs / 1000)}s
                </div>
            `;
        }
    }
}

function getScoreClass(score) {
    if (score >= 70) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
}

// Enrich company (Phase 9) - runs Phase 1-5 in one click
async function enrichCompany() {
    const companyName = elements.fieldCompany.value.trim();
    const website = elements.fieldWebsite.value.trim();

    if (!website) {
        alert('Website required for enrichment');
        return;
    }

    const domain = extractDomain(website);

    if (elements.btnEnrich) elements.btnEnrich.disabled = true;
    if (elements.btnEnrichText) elements.btnEnrichText.textContent = 'Finding emails...';

    try {
        // Step 1: Find contacts (Phase 1-3)
        await findContacts();

        // Step 2: Auto-verify top contacts (Phase 4-5)
        if (elements.btnEnrichText) elements.btnEnrichText.textContent = 'Verifying...';
        await autoVerifyTopContacts();

        // Step 3: Auto-select best contact
        autoSelectBestContact();

        // Step 4: Get opportunity score
        if (elements.btnEnrichText) elements.btnEnrichText.textContent = 'Scoring...';

        try {
            const res = await fetch(`${API_BASE}/api/prospects/convert`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyName, domain, website }),
            });
            const data = await res.json();
            if (data.success && data.opportunityScore) {
                showOpportunityScore(data.opportunityScore, data.recommendedAction, data.summary);
            }
        } catch (err) {
            console.log('[Enrich] Scoring skipped:', err.message);
        }

        // Success
        if (elements.btnEnrichText) elements.btnEnrichText.textContent = '✓ Enriched';

        // Enable compose if we have valid contacts
        const hasValidContact = contacts.some(c => c.verificationStatus === 'valid' || c.selected);
        if (hasValidContact && elements.btnCompose) {
            elements.btnCompose.disabled = false;
        }

    } catch (err) {
        console.error('[Enrich] Error:', err);
        if (elements.btnEnrichText) elements.btnEnrichText.textContent = 'Enrich failed';
    } finally {
        if (elements.btnEnrich) elements.btnEnrich.disabled = false;
    }
}

// Event listeners
elements.btnSignin?.addEventListener('click', handleSignIn);
elements.btnAdd?.addEventListener('click', () => capture(false));
elements.btnCompose?.addEventListener('click', () => capture(true));
elements.btnRetry?.addEventListener('click', init);
elements.btnRetryContacts?.addEventListener('click', findContacts);
elements.btnFindContacts?.addEventListener('click', findContacts);
elements.btnConvert?.addEventListener('click', convertToLead);
elements.btnEnrich?.addEventListener('click', enrichCompany);

elements.btnAddManual?.addEventListener('click', () => {
    addContact({ name: '', role: '', email: '', confidence: 'missing', source: 'manual' });
});

elements.btnSelectAll?.addEventListener('click', () => {
    contacts.forEach(c => c.selected = true);
    renderContacts();
});

elements.btnSelectNone?.addEventListener('click', () => {
    contacts.forEach(c => c.selected = false);
    renderContacts();
});

// Start
init();
