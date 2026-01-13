// Envelope Chrome Extension - Popup Script

const API_BASE = 'https://envelope-app-git-main-oscar-richmonds-projects.vercel.app';

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

// Initialize
async function init() {
    const stored = await chrome.storage.local.get(['authToken', 'userEmail']);
    authToken = stored.authToken;

    if (!authToken) {
        showState('authRequired');
        return;
    }

    if (stored.userEmail) {
        elements.userEmail.textContent = stored.userEmail;
        elements.userBadge.classList.remove('hidden');
    }

    showState('loading');

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

// Detect page context
function detectContext(url) {
    if (!url) return 'unsupported';

    if (url.includes('linkedin.com/in/')) return 'linkedin_person';
    if (url.includes('linkedin.com/company/')) return 'linkedin_company';
    if (url.startsWith('http://') || url.startsWith('https://')) {
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
        if (context.startsWith('linkedin_')) {
            const results = await chrome.scripting.executeScript({
                target: { tabId },
                func: parseLinkedInPage,
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

    // Confidence badge
    const badgeClass = contact.confidence === 'verified' ? 'badge-verified' :
        contact.confidence === 'likely' ? 'badge-likely' :
            contact.confidence === 'guessed' ? 'badge-guessed' :
                hasEmail ? 'badge-unknown' : 'badge-missing';
    const badgeText = contact.confidence === 'verified' ? 'Verified' :
        contact.confidence === 'likely' ? 'Likely' :
            contact.confidence === 'guessed' ? 'Guessed' :
                hasEmail ? 'Unknown' : 'Missing';

    // Type indicator
    const typeLabel = contact.type === 'person' ? '👤' : '📧';

    // Source badge (PDF, generic inbox)
    let sourceBadge = '';
    if (contact.source === 'pdf') {
        sourceBadge = '<span class="badge badge-pdf">📄 PDF</span>';
    } else if (contact.isGeneric) {
        sourceBadge = '<span class="badge badge-generic">Generic inbox</span>';
    }

    // Evidence tooltip
    const evidenceHtml = contact.evidence?.url ?
        `<span class="contact-evidence" title="Found on: ${escapeHtml(contact.evidence.pageType || 'page')}&#10;${escapeHtml(contact.evidence.snippet || '')}">
            📍 ${escapeHtml(contact.evidence.pageType || contact.source || '')}
        </span>` : '';

    return `
        <div class="contact-row ${contact.isGeneric ? 'contact-generic' : ''}" data-contact-id="${contact.id}">
            <input type="checkbox" class="contact-checkbox" ${contact.selected ? 'checked' : ''}>
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
                    ${sourceBadge}
                </div>
                ${evidenceHtml}
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
    const verifyBtnText = contact.verificationStatus === 'pending' ? 'Verify' :
        contact.verificationStatus === 'valid' ? '✓ Valid' :
            contact.verificationStatus === 'invalid' ? '✗ Invalid' : 'Check';

    const verifyBtnClass = contact.verificationStatus === 'valid' ? 'btn-verified' :
        contact.verificationStatus === 'invalid' ? 'btn-invalid' : '';

    return `
        <div class="contact-row contact-suggested" data-contact-id="${contact.id}">
            <input type="checkbox" class="contact-checkbox" ${contact.selected ? 'checked' : ''}>
            <div class="contact-info">
                <div class="contact-name-row">
                    <span class="contact-type-icon" title="Director (Companies House)">🏛️</span>
                    <span class="contact-name-text">${escapeHtml(contact.name)}</span>
                </div>
                <span class="contact-role-text">${escapeHtml(contact.role || 'Director')}</span>
                <div class="contact-email-row">
                    <span class="contact-email-suggested">${escapeHtml(contact.email)}</span>
                    <span class="badge badge-suggested">Suggested</span>
                </div>
            </div>
            <div class="contact-actions">
                <button class="btn-verify ${verifyBtnClass}" onclick="verifyEmail(${contact.id})">${verifyBtnText}</button>
                <button class="btn-use" onclick="useSuggestedContact(${contact.id})">Use</button>
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

    // Use v3 endpoint
    const requestUrl = `${API_BASE}/api/email-discovery/v3`;
    updateDebug({
        requestId: 'pending...',
        domain: extractDomain(website),
        error: '-'
    });

    let responseRequestId = '';

    try {
        console.log('[Envelope V3] Starting discovery for:', website);

        const res = await fetch(requestUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                domain: extractDomain(website),
                seedUrl: website,
                options: { crawlSite: true, publicSearch: true }
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

            // If verified pattern exists, try Companies House enrichment
            const verifiedPattern = result.patterns.find(p => p.verified);
            if (verifiedPattern && result.emails?.length > 0) {
                await enrichWithDirectors(extractDomain(website), result.emails, verifiedPattern);
            }
        }

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
        // First resolve company
        const companyName = elements.fieldCompany.value.trim();
        if (!companyName) return;

        console.log('[Envelope V3] Attempting UK director enrichment for:', companyName);

        const resolveRes = await fetch(`${API_BASE}/api/enrichment/companies-house/resolve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ companyName })
        });

        const resolveData = await resolveRes.json();

        if (!resolveData.success || resolveData.status !== 'matched') {
            console.log('[Envelope V3] No CH match:', resolveData.status);
            return;
        }

        // Get suggestions
        const suggestRes = await fetch(`${API_BASE}/api/enrichment/email/suggest-from-officers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                companyNumber: resolveData.companyNumber,
                domain,
                foundEmails: foundEmails.map(e => ({ email: e.email, name: e.name }))
            })
        });

        const suggestData = await suggestRes.json();

        if (!suggestData.success || !suggestData.canSuggest) {
            console.log('[Envelope V3] Cannot suggest:', suggestData.reason);
            return;
        }

        // Add suggested contacts
        console.log('[Envelope V3] Adding', suggestData.suggestedContacts.length, 'suggested directors');

        for (const suggestion of suggestData.suggestedContacts) {
            // Skip if email already exists
            if (contacts.find(c => c.email === suggestion.emailSuggested)) continue;

            addSuggestedContact({
                name: suggestion.name,
                role: suggestion.role,
                email: suggestion.emailSuggested,
                patternType: suggestion.patternType,
                confidence: suggestion.confidence,
                source: 'companies_house'
            });
        }

        renderContacts();

    } catch (err) {
        console.log('[Envelope V3] Director enrichment error:', err.message);
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

// Show pattern info
function showPatternInfo(patterns) {
    for (const p of patterns) {
        const status = p.verified ? `✓ Verified (${p.matches} matches)` : `Likely (${p.matches} match)`;
        console.log(`[Envelope V3] Pattern: ${p.pattern} - ${status}`);
    }
}

// Update debug UI
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

// Sign in
function handleSignIn() {
    chrome.tabs.create({ url: `${API_BASE}/auth/extension-callback` });
}

// Event listeners
elements.btnSignin?.addEventListener('click', handleSignIn);
elements.btnAdd?.addEventListener('click', () => capture(false));
elements.btnCompose?.addEventListener('click', () => capture(true));
elements.btnRetry?.addEventListener('click', init);
elements.btnRetryContacts?.addEventListener('click', findContacts);
elements.btnFindContacts?.addEventListener('click', findContacts);

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
