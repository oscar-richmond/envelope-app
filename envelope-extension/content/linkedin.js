// Envelope Chrome Extension - LinkedIn Content Script with Injected UI

(function () {
  // Only run on LinkedIn profile or company pages
  const url = window.location.href;
  const isProfilePage = url.includes('linkedin.com/in/');
  const isCompanyPage = url.includes('linkedin.com/company/');

  if (!isProfilePage && !isCompanyPage) return;

  // Don't inject if already present
  if (document.getElementById('envelope-capture-bar')) return;

  console.log('[Envelope] Injecting capture bar on LinkedIn page');

  // Constants
  const STORAGE_KEY = 'envelope-bar-state';
  const VIEWPORT_PADDING = 16;
  const EXTENSION_VERSION = '1.0.0';

  // Parsing error tracker
  const parsingErrors = [];

  // Load saved state
  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('[Envelope] Failed to load state:', e);
    }
    return { x: null, y: null, isCollapsed: false, selectedListId: null };
  }

  // Save state
  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('[Envelope] Failed to save state:', e);
    }
  }

  // Get current state
  let barState = loadState();
  let availableLists = [];
  let selectedListId = barState.selectedListId || null;
  let selectedListName = 'Target Accounts';

  // --- Robust Selector Helpers ---

  // Safe query - returns null on failure, logs error
  function safeQuery(selector, context = document) {
    try {
      return context.querySelector(selector);
    } catch (e) {
      parsingErrors.push({ selector, error: 'query_failed' });
      return null;
    }
  }

  // Safe text extraction
  function safeText(element) {
    try {
      return element?.textContent?.trim() || '';
    } catch (e) {
      return '';
    }
  }

  // Try multiple selectors in order, return first match
  function trySelectors(selectors, context = document) {
    for (const selector of selectors) {
      try {
        const el = context.querySelector(selector);
        if (el) return { element: el, selector };
      } catch (e) {
        parsingErrors.push({ selector, error: 'selector_failed' });
      }
    }
    return { element: null, selector: null };
  }

  // Extract from meta tags (most stable)
  function getMetaContent(names) {
    for (const name of names) {
      try {
        const meta = document.querySelector(`meta[property="${name}"], meta[name="${name}"]`);
        if (meta?.content) return meta.content.trim();
      } catch (e) { }
    }
    return '';
  }

  // Extract from JSON-LD structured data
  function getJsonLdData() {
    try {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of scripts) {
        try {
          const data = JSON.parse(script.textContent);
          if (data['@type'] === 'Organization' || data['@type'] === 'Person') {
            return data;
          }
          // Handle arrays
          if (Array.isArray(data)) {
            const org = data.find(d => d['@type'] === 'Organization' || d['@type'] === 'Person');
            if (org) return org;
          }
        } catch (e) { }
      }
    } catch (e) {
      parsingErrors.push({ selector: 'json-ld', error: 'parse_failed' });
    }
    return null;
  }

  // --- Robust Page Data Extraction ---
  function getPageData() {
    parsingErrors.length = 0; // Reset errors
    let confidence = 100;

    const data = {
      type: isProfilePage ? 'linkedin_person' : 'linkedin_company',
      sourceUrl: window.location.href,
      companyName: '',
      contactName: '',
      jobTitle: '',
      website: '',
      linkedinUrl: window.location.href,
      confidence: 100,
      parsingWarnings: []
    };

    // --- Company Page Parsing ---
    if (isCompanyPage) {
      // Priority 1: Meta tags (most stable)
      data.companyName = getMetaContent(['og:title', 'twitter:title']);
      if (data.companyName) {
        // Clean up "Company | LinkedIn" format
        data.companyName = data.companyName.split('|')[0].split(':')[0].trim();
      }

      // Priority 2: JSON-LD
      if (!data.companyName) {
        const jsonLd = getJsonLdData();
        if (jsonLd?.name) {
          data.companyName = jsonLd.name;
          confidence -= 5;
        }
      }

      // Priority 3: DOM selectors (multiple fallbacks)
      if (!data.companyName) {
        const companyNameSelectors = [
          'h1.org-top-card-summary__title',
          '.org-top-card-summary__title span',
          'h1[class*="top-card"] span',
          '.top-card-layout__title',
          'h1'
        ];
        const { element } = trySelectors(companyNameSelectors);
        if (element) {
          data.companyName = safeText(element);
          confidence -= 10;
        }
      }

      // Priority 4: URL extraction (last resort)
      if (!data.companyName) {
        const urlMatch = url.match(/linkedin\.com\/company\/([^\/?]+)/);
        if (urlMatch) {
          data.companyName = urlMatch[1]
            .replace(/-/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
          confidence -= 20;
          data.parsingWarnings.push('name_from_url');
        }
      }

      // Website extraction
      const websiteSelectors = [
        'a[data-test-id="about-us-link"]',
        '.org-top-card-primary-actions__inner a[href^="http"]',
        '.org-page-details__definition-text a'
      ];
      const { element: websiteEl } = trySelectors(websiteSelectors);
      data.website = websiteEl?.href || '';

      // --- Profile Page Parsing ---
    } else if (isProfilePage) {
      // Priority 1: Meta tags
      const metaTitle = getMetaContent(['og:title', 'twitter:title']);
      if (metaTitle) {
        // Format: "First Last - Title | LinkedIn"
        const namePart = metaTitle.split('-')[0].split('|')[0].trim();
        if (namePart && !namePart.includes('LinkedIn')) {
          data.contactName = namePart;
        }
      }

      // Priority 2: JSON-LD
      if (!data.contactName) {
        const jsonLd = getJsonLdData();
        if (jsonLd?.name) {
          data.contactName = jsonLd.name;
          confidence -= 5;
        }
      }

      // Priority 3: DOM selectors
      if (!data.contactName) {
        const nameSelectors = [
          'h1.text-heading-xlarge',
          'h1[class*="text-heading"]',
          '.pv-top-card--list li:first-child',
          'h1'
        ];
        const { element } = trySelectors(nameSelectors);
        if (element) {
          data.contactName = safeText(element);
          confidence -= 10;
        }
      }

      // Job title
      const titleSelectors = [
        '.text-body-medium.break-words',
        '.pv-top-card--list-bullet li',
        '[data-field="headline"]'
      ];
      const { element: titleEl } = trySelectors(titleSelectors);
      data.jobTitle = safeText(titleEl);

      // Company name - try multiple sources
      // From experience section
      const expSection = safeQuery('#experience');
      if (expSection) {
        const companySelectors = [
          '.t-bold span[aria-hidden="true"]',
          '.pv-entity__secondary-title',
          'a[data-field="experience_company_logo"]'
        ];
        const { element: compEl } = trySelectors(companySelectors, expSection);
        if (compEl) {
          data.companyName = safeText(compEl);
        }
      }

      // Fallback: extract from headline
      if (!data.companyName && data.jobTitle) {
        const match = data.jobTitle.match(/(?:at|@)\s+(.+?)(?:\s*[|·•]|$)/i);
        if (match) {
          data.companyName = match[1].trim();
          confidence -= 10;
        }
      }

      // Fallback: any company link
      if (!data.companyName) {
        const companyLink = safeQuery('a[href*="/company/"]');
        if (companyLink) {
          data.companyName = safeText(companyLink) || 'Unknown Company';
          confidence -= 15;
        }
      }
    }

    // Final fallback
    if (!data.companyName) {
      data.companyName = 'Unknown Company';
      confidence -= 30;
      data.parsingWarnings.push('name_unknown');
    }

    data.confidence = Math.max(0, confidence);

    // Log errors if any occurred
    if (parsingErrors.length > 0) {
      logParsingErrors(data.type, parsingErrors, data.confidence);
    }

    console.log('[Envelope] Extracted data:', data);
    return data;
  }

  // --- Error Logging ---
  async function logParsingErrors(pageType, errors, confidence) {
    try {
      await chrome.runtime.sendMessage({
        action: 'logError',
        data: {
          errorType: 'parsing_degraded',
          pageType: pageType,
          failedSelectors: errors.map(e => e.selector).filter(Boolean),
          parsingConfidence: confidence,
          timestamp: Date.now(),
          extensionVersion: EXTENSION_VERSION
        }
      });
    } catch (e) {
      console.warn('[Envelope] Failed to log errors:', e);
    }
  }

  // Create the floating capture bar
  const bar = document.createElement('div');
  bar.id = 'envelope-capture-bar';
  bar.innerHTML = `
    <style>
      #envelope-capture-bar {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 9999;
        font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
        user-select: none;
      }
      
      #envelope-capture-bar.has-position {
        bottom: auto;
        right: auto;
      }
      
      /* Expanded bar container */
      .envelope-bar-container {
        display: flex;
        align-items: center;
        gap: 8px;
        background: white;
        padding: 10px 14px;
        border-radius: 50px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05);
        animation: envelope-slide-in 0.3s ease-out;
      }
      
      .envelope-bar-container.is-dragging {
        cursor: grabbing !important;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.08);
      }
      
      /* Collapsed state - logo only */
      .envelope-collapsed {
        display: none;
        align-items: center;
        justify-content: center;
        width: 48px;
        height: 48px;
        background: linear-gradient(145deg, #1e2128 0%, #171a1f 100%);
        border-radius: 14px;
        box-shadow: 
          0 4px 16px rgba(0, 0, 0, 0.25),
          0 0 0 1px rgba(255, 255, 255, 0.08);
        cursor: pointer;
        transition: all 0.2s ease;
        animation: envelope-slide-in 0.3s ease-out;
      }
      
      .envelope-collapsed:hover {
        transform: scale(1.08);
        box-shadow: 
          0 6px 24px rgba(0, 0, 0, 0.3),
          0 0 0 1px rgba(84, 130, 237, 0.4),
          0 0 20px rgba(84, 130, 237, 0.15);
      }
      
      .envelope-collapsed:focus {
        outline: none;
        box-shadow: 
          0 4px 16px rgba(0, 0, 0, 0.25),
          0 0 0 2px rgba(84, 130, 237, 0.6);
      }
      
      .envelope-collapsed.is-dragging {
        cursor: grabbing !important;
        transform: scale(1.05);
      }
      
      .envelope-collapsed svg {
        width: 24px;
        height: 24px;
        color: white;
      }
      
      #envelope-capture-bar.collapsed .envelope-bar-container {
        display: none;
      }
      
      #envelope-capture-bar.collapsed .envelope-collapsed {
        display: flex;
      }
      
      @keyframes envelope-slide-in {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      /* Header / drag handle area */
      .envelope-header {
        display: flex;
        align-items: center;
        cursor: grab;
        padding-right: 4px;
      }
      
      .envelope-header:active {
        cursor: grabbing;
      }
      
      .envelope-logo {
        width: 28px;
        height: 28px;
        background: linear-gradient(135deg, #5482ED, #7C3AED);
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
      }
      
      .envelope-logo svg {
        width: 16px;
        height: 16px;
        color: white;
      }
      
      /* Editable company name input */
      .envelope-name-wrapper {
        position: relative;
        display: flex;
        align-items: center;
      }
      
      .envelope-name-input {
        width: 120px;
        padding: 6px 10px;
        font-size: 12px;
        font-weight: 500;
        color: #374151;
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 16px;
        outline: none;
        transition: all 0.15s ease;
      }
      
      .envelope-name-input:focus {
        background: white;
        border-color: #5482ED;
        box-shadow: 0 0 0 3px rgba(84, 130, 237, 0.1);
        width: 160px;
      }
      
      .envelope-name-input::placeholder {
        color: #9ca3af;
      }
      
      .envelope-name-input.warning {
        border-color: #f59e0b;
        background: #fffbeb;
      }
      
      .envelope-confidence-dot {
        position: absolute;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);
        width: 6px;
        height: 6px;
        border-radius: 50%;
        pointer-events: none;
      }
      
      .envelope-confidence-dot.high { background: #10b981; }
      .envelope-confidence-dot.medium { background: #f59e0b; }
      .envelope-confidence-dot.low { background: #ef4444; }
      
      /* List dropdown */
      .envelope-list-wrapper {
        position: relative;
      }
      
      .envelope-list-btn {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 6px 10px;
        font-size: 12px;
        font-weight: 500;
        color: #6b7280;
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 16px;
        cursor: pointer;
        transition: all 0.15s ease;
        white-space: nowrap;
        max-width: 140px;
      }
      
      .envelope-list-btn:hover {
        background: #f3f4f6;
        border-color: #d1d5db;
      }
      
      .envelope-list-btn .list-name {
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100px;
      }
      
      .envelope-list-btn svg {
        width: 12px;
        height: 12px;
        flex-shrink: 0;
      }
      
      .envelope-list-dropdown {
        position: absolute;
        bottom: calc(100% + 8px);
        left: 50%;
        transform: translateX(-50%);
        min-width: 180px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05);
        padding: 6px;
        display: none;
        z-index: 10001;
      }
      
      .envelope-list-dropdown.open {
        display: block;
        animation: envelope-fade-in 0.15s ease-out;
      }
      
      @keyframes envelope-fade-in {
        from { opacity: 0; transform: translateX(-50%) translateY(4px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
      
      .envelope-list-item {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 8px 10px;
        font-size: 13px;
        color: #374151;
        background: none;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        text-align: left;
        transition: background 0.1s ease;
      }
      
      .envelope-list-item:hover {
        background: #f3f4f6;
      }
      
      .envelope-list-item.selected {
        background: #eff6ff;
        color: #1d4ed8;
      }
      
      .envelope-list-item svg {
        width: 14px;
        height: 14px;
        flex-shrink: 0;
      }
      
      .envelope-list-divider {
        height: 1px;
        background: #e5e7eb;
        margin: 4px 0;
      }
      
      .envelope-list-item.create-new {
        color: #5482ED;
        font-weight: 500;
      }
      
      .envelope-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        font-size: 13px;
        font-weight: 600;
        border: none;
        border-radius: 20px;
        cursor: pointer;
        transition: all 0.15s ease;
        white-space: nowrap;
      }
      
      .envelope-btn-primary {
        background: #5482ED;
        color: white;
      }
      
      .envelope-btn-primary:hover {
        background: #4371DC;
        transform: scale(1.02);
      }
      
      .envelope-btn-secondary {
        background: #f3f4f6;
        color: #374151;
      }
      
      .envelope-btn-secondary:hover {
        background: #e5e7eb;
      }
      
      .envelope-btn svg {
        width: 14px;
        height: 14px;
      }
      
      .envelope-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      
      .envelope-divider {
        width: 1px;
        height: 24px;
        background: #e5e7eb;
        margin: 0 4px;
      }
      
      /* Minimise button */
      .envelope-minimise {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: none;
        background: transparent;
        color: #9ca3af;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-left: 4px;
        transition: all 0.15s ease;
      }
      
      .envelope-minimise:hover {
        background: #f3f4f6;
        color: #374151;
      }
      
      /* Reset position button */
      .envelope-reset {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: none;
        background: transparent;
        color: #d1d5db;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-left: 2px;
        transition: all 0.15s ease;
        opacity: 0;
      }
      
      .envelope-bar-container:hover .envelope-reset {
        opacity: 1;
      }
      
      .envelope-reset:hover {
        background: #f3f4f6;
        color: #6b7280;
      }
      
      .envelope-reset svg {
        width: 12px;
        height: 12px;
      }
      
      .envelope-toast {
        position: fixed;
        bottom: 90px;
        right: 24px;
        background: #10b981;
        color: white;
        padding: 12px 16px;
        border-radius: 12px;
        font-size: 13px;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        animation: envelope-slide-in 0.3s ease-out;
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 12px;
      }
      
      .envelope-toast.error {
        background: #ef4444;
        box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
      }
      
      .envelope-toast-link {
        color: white;
        font-weight: 600;
        text-decoration: underline;
        text-underline-offset: 2px;
      }
      
      .envelope-toast-link:hover {
        opacity: 0.9;
      }
    </style>
    
    <!-- Expanded State -->
    <div class="envelope-bar-container">
      <div class="envelope-header" title="Drag to move">
        <div class="envelope-logo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="4" width="20" height="16" rx="2"/>
            <path d="M22 6l-10 7L2 6"/>
          </svg>
        </div>
      </div>
      
      <!-- Editable Company Name -->
      <div class="envelope-name-wrapper">
        <input type="text" class="envelope-name-input" id="envelope-company-name" placeholder="Company name..." title="Edit company name">
        <span class="envelope-confidence-dot high" id="envelope-confidence-dot" title="Parsing confidence"></span>
      </div>
      
      <!-- List Dropdown -->
      <div class="envelope-list-wrapper">
        <button class="envelope-list-btn" id="envelope-list-toggle">
          <span class="list-name" id="envelope-selected-list">Target Accounts</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </button>
        <div class="envelope-list-dropdown" id="envelope-list-dropdown">
          <div id="envelope-list-items">
            <!-- Lists populated dynamically -->
          </div>
          <div class="envelope-list-divider"></div>
          <button class="envelope-list-item create-new" id="envelope-create-list">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Create new list
          </button>
        </div>
      </div>
      
      <button class="envelope-btn envelope-btn-primary" id="envelope-btn-save">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        Save
      </button>
      
      <button class="envelope-btn envelope-btn-secondary" id="envelope-btn-compose">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
        </svg>
        Compose
      </button>
      
      <div class="envelope-divider"></div>
      
      <button class="envelope-reset" id="envelope-btn-reset" title="Reset position">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
          <path d="M3 3v5h5"/>
        </svg>
      </button>
      
      <button class="envelope-minimise" id="envelope-btn-minimise" title="Minimise">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M5 12h14"/>
        </svg>
      </button>
    </div>
    
    <!-- Collapsed State (Logo Only) -->
    <button class="envelope-collapsed" id="envelope-btn-expand" title="Expand Envelope" tabindex="0">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="2" y="4" width="20" height="16" rx="2"/>
        <path d="M22 6l-10 7L2 6"/>
      </svg>
    </button>
  `;

  document.body.appendChild(bar);

  // Apply saved state
  if (barState.isCollapsed) {
    bar.classList.add('collapsed');
  }

  if (barState.x !== null && barState.y !== null) {
    bar.classList.add('has-position');
    bar.style.left = barState.x + 'px';
    bar.style.top = barState.y + 'px';
  }

  // --- Initialize with parsed data ---
  const companyInput = document.getElementById('envelope-company-name');
  const confidenceDot = document.getElementById('envelope-confidence-dot');
  let currentPageData = null;

  function initializePageData() {
    currentPageData = getPageData();
    companyInput.value = currentPageData.companyName;

    // Update confidence indicator
    const conf = currentPageData.confidence;
    confidenceDot.className = 'envelope-confidence-dot';
    if (conf >= 80) {
      confidenceDot.classList.add('high');
      confidenceDot.title = 'High confidence';
    } else if (conf >= 50) {
      confidenceDot.classList.add('medium');
      confidenceDot.title = 'Medium confidence - verify name';
      companyInput.classList.add('warning');
    } else {
      confidenceDot.classList.add('low');
      confidenceDot.title = 'Low confidence - please verify';
      companyInput.classList.add('warning');
    }
  }

  // Initialize on load
  initializePageData();

  // --- Fetch and populate lists ---
  async function loadLists() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getLists' });
      if (response.success && response.lists) {
        availableLists = response.lists;
        renderLists();

        // Set default selected list if none selected
        if (!selectedListId && availableLists.length > 0) {
          const defaultList = availableLists.find(l => l.isDefault) || availableLists[0];
          selectList(defaultList.id, defaultList.name);
        } else if (selectedListId) {
          // Restore previous selection
          const list = availableLists.find(l => l.id === selectedListId);
          if (list) {
            selectedListName = list.name;
            document.getElementById('envelope-selected-list').textContent = list.name;
          }
        }
      }
    } catch (e) {
      console.warn('[Envelope] Failed to load lists:', e);
    }
  }

  function renderLists() {
    const container = document.getElementById('envelope-list-items');
    container.innerHTML = availableLists.map(list => `
      <button class="envelope-list-item ${list.id === selectedListId ? 'selected' : ''}" data-list-id="${list.id}" data-list-name="${list.name}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 6h18M3 12h18M3 18h18"/>
        </svg>
        ${list.name}
      </button>
    `).join('');

    // Add click handlers
    container.querySelectorAll('.envelope-list-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const listId = parseInt(item.dataset.listId);
        const listName = item.dataset.listName;
        selectList(listId, listName);
        closeDropdown();
      });
    });
  }

  function selectList(listId, listName) {
    selectedListId = listId;
    selectedListName = listName;
    document.getElementById('envelope-selected-list').textContent = listName;
    barState.selectedListId = listId;
    saveState(barState);
    renderLists();
  }

  // --- Dropdown toggle ---
  const listToggle = document.getElementById('envelope-list-toggle');
  const listDropdown = document.getElementById('envelope-list-dropdown');

  function closeDropdown() {
    listDropdown.classList.remove('open');
  }

  listToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = listDropdown.classList.contains('open');
    if (isOpen) {
      closeDropdown();
    } else {
      listDropdown.classList.add('open');
      loadLists();
    }
  });

  document.addEventListener('click', (e) => {
    if (!listDropdown.contains(e.target) && e.target !== listToggle) {
      closeDropdown();
    }
  });

  document.getElementById('envelope-create-list').addEventListener('click', async (e) => {
    e.stopPropagation();
    const name = prompt('Enter list name:');
    if (name && name.trim()) {
      try {
        const response = await chrome.runtime.sendMessage({ action: 'createList', name: name.trim() });
        if (response.success && response.list) {
          selectList(response.list.id, response.list.name);
          loadLists();
        }
      } catch (e) {
        console.error('[Envelope] Failed to create list:', e);
      }
    }
    closeDropdown();
  });

  loadLists();

  // --- Drag Functionality ---
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let barStartX = 0;
  let barStartY = 0;

  const header = bar.querySelector('.envelope-header');
  const barContainer = bar.querySelector('.envelope-bar-container');
  const collapsedBtn = bar.querySelector('.envelope-collapsed');

  function startDrag(e) {
    if (e.button !== 0) return;

    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;

    const rect = bar.getBoundingClientRect();
    barStartX = rect.left;
    barStartY = rect.top;

    if (barState.isCollapsed) {
      collapsedBtn.classList.add('is-dragging');
    } else {
      barContainer.classList.add('is-dragging');
    }

    e.preventDefault();
  }

  function doDrag(e) {
    if (!isDragging) return;

    const deltaX = e.clientX - dragStartX;
    const deltaY = e.clientY - dragStartY;

    let newX = barStartX + deltaX;
    let newY = barStartY + deltaY;

    const barRect = bar.getBoundingClientRect();
    const maxX = window.innerWidth - barRect.width - VIEWPORT_PADDING;
    const maxY = window.innerHeight - barRect.height - VIEWPORT_PADDING;

    newX = Math.max(VIEWPORT_PADDING, Math.min(newX, maxX));
    newY = Math.max(VIEWPORT_PADDING, Math.min(newY, maxY));

    bar.classList.add('has-position');
    bar.style.left = newX + 'px';
    bar.style.top = newY + 'px';
  }

  function endDrag() {
    if (!isDragging) return;

    isDragging = false;
    barContainer.classList.remove('is-dragging');
    collapsedBtn.classList.remove('is-dragging');

    const rect = bar.getBoundingClientRect();
    barState.x = rect.left;
    barState.y = rect.top;
    saveState(barState);
  }

  header.addEventListener('mousedown', startDrag);
  collapsedBtn.addEventListener('mousedown', startDrag);
  document.addEventListener('mousemove', doDrag);
  document.addEventListener('mouseup', endDrag);

  // --- Minimise / Expand ---
  function minimise() {
    bar.classList.add('collapsed');
    barState.isCollapsed = true;
    saveState(barState);
  }

  function expand() {
    bar.classList.remove('collapsed');
    barState.isCollapsed = false;
    saveState(barState);
  }

  document.getElementById('envelope-btn-minimise').addEventListener('click', (e) => {
    e.stopPropagation();
    minimise();
  });

  document.getElementById('envelope-btn-expand').addEventListener('click', (e) => {
    if (!isDragging) {
      e.stopPropagation();
      expand();
    }
  });

  collapsedBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      expand();
    }
  });

  // --- Reset Position ---
  document.getElementById('envelope-btn-reset').addEventListener('click', (e) => {
    e.stopPropagation();
    bar.classList.remove('has-position');
    bar.style.left = '';
    bar.style.top = '';
    barState.x = null;
    barState.y = null;
    saveState(barState);
  });

  // API base for sign-in redirect
  const API_BASE = 'https://envelope-app-git-main-oscar-richmonds-projects.vercel.app';

  // Show toast with optional CTA and error details
  function showToast(message, options = {}) {
    const { isError = false, openUrl = null, showRetry = false, errorCode = null, onRetry = null, showSignIn = false } = options;

    const existing = document.querySelector('.envelope-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `envelope-toast${isError ? ' error' : ''}`;
    toast.style.cssText = `
      position: fixed;
      bottom: 90px;
      right: 24px;
      background: ${isError ? '#ef4444' : '#10b981'};
      color: white;
      padding: 12px 16px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 500;
      box-shadow: 0 4px 12px ${isError ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'};
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-width: 300px;
      animation: envelope-slide-in 0.3s ease-out;
    `;

    let html = `<div style="display: flex; align-items: center; gap: 12px;">
      <span>${message}</span>`;

    if (openUrl && !isError) {
      html += `<a href="${openUrl}" target="_blank" style="color: white; font-weight: 600; text-decoration: underline;">Open in Envelope</a>`;
    }

    html += `</div>`;

    // Error details and actions
    if (isError) {
      if (errorCode) {
        html += `<div style="font-size: 11px; opacity: 0.8;">Error: ${errorCode}</div>`;
      }

      html += `<div style="display: flex; gap: 8px; margin-top: 4px;">`;

      if (showSignIn) {
        html += `<button id="envelope-toast-signin" style="
          background: rgba(255,255,255,0.2);
          border: none;
          padding: 6px 12px;
          border-radius: 6px;
          color: white;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        ">Sign in</button>`;
      }

      if (showRetry) {
        html += `<button id="envelope-toast-retry" style="
          background: rgba(255,255,255,0.2);
          border: none;
          padding: 6px 12px;
          border-radius: 6px;
          color: white;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        ">Retry</button>`;
      }

      html += `</div>`;
    }

    toast.innerHTML = html;
    document.body.appendChild(toast);

    // Bind button handlers
    if (showSignIn) {
      const signInBtn = document.getElementById('envelope-toast-signin');
      if (signInBtn) {
        signInBtn.addEventListener('click', () => {
          window.open(`${API_BASE}/auth/signin`, '_blank');
          toast.remove();
        });
      }
    }

    if (showRetry && onRetry) {
      const retryBtn = document.getElementById('envelope-toast-retry');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => {
          toast.remove();
          onRetry();
        });
      }
    }

    // Auto-dismiss after longer time for errors (to allow reading)
    setTimeout(() => toast.remove(), isError ? 8000 : 4000);
  }

  // Get user-friendly error message based on error code/status
  function getErrorMessage(response) {
    const code = response?.errorCode || response?.code;
    const error = response?.error;

    if (response?.requiresAuth || code === 'AUTH_REQUIRED') {
      return { message: 'Sign in required', showSignIn: true, showRetry: false, code };
    }

    switch (code) {
      case 'NETWORK_ERROR':
        return { message: 'Network error - check connection', showRetry: true, code };
      case 'INVALID_RESPONSE':
        return { message: 'Server error - try again', showRetry: true, code };
      case 'MISSING_COMPANY_NAME':
        return { message: 'Enter a company name', showRetry: false, code };
      case 'DUPLICATE':
        return { message: error || 'Company already exists', showRetry: false, code };
      default:
        return { message: error || 'Capture failed', showRetry: true, code };
    }
  }

  // Track last action for retry
  let lastAction = null;

  // Handle actions via message passing to extension
  async function handleAction(action) {
    // Get the (possibly edited) company name from input
    const editedCompanyName = companyInput.value.trim();

    if (!editedCompanyName) {
      showToast('Please enter a company name', { isError: true });
      companyInput.focus();
      return;
    }

    // Use edited name, keep other data from parsing
    const data = { ...currentPageData, companyName: editedCompanyName };

    // Save for retry
    lastAction = action;

    // Disable buttons
    const saveBtn = document.getElementById('envelope-btn-save');
    const composeBtn = document.getElementById('envelope-btn-compose');
    saveBtn.disabled = true;
    composeBtn.disabled = true;

    try {
      console.log('[Envelope] Sending capture request...');

      const response = await chrome.runtime.sendMessage({
        action: 'capture',
        compose: action === 'compose',
        data: data,
        listId: selectedListId
      });

      console.log('[Envelope] Capture response:', response);

      if (response?.success) {
        const toastMessage = response.message || `Added to ${selectedListName}`;
        showToast(toastMessage, { openUrl: response.openUrl });

        if (action === 'compose' && response.composeUrl) {
          window.open(response.composeUrl, '_blank');
        }
      } else {
        // Get specific error info
        const errorInfo = getErrorMessage(response);

        showToast(errorInfo.message, {
          isError: true,
          errorCode: errorInfo.code,
          showRetry: errorInfo.showRetry,
          showSignIn: errorInfo.showSignIn,
          onRetry: () => handleAction(lastAction)
        });
      }
    } catch (e) {
      console.error('[Envelope] Capture error:', e);
      showToast(e.message || 'Failed to save', {
        isError: true,
        showRetry: true,
        onRetry: () => handleAction(lastAction)
      });
    } finally {
      saveBtn.disabled = false;
      composeBtn.disabled = false;
    }
  }

  document.getElementById('envelope-btn-save').addEventListener('click', (e) => {
    e.stopPropagation();
    handleAction('save');
  });
  document.getElementById('envelope-btn-compose').addEventListener('click', (e) => {
    e.stopPropagation();
    handleAction('compose');
  });

  console.log('[Envelope] Capture bar ready');
})();
