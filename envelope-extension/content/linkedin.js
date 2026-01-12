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
      }
      
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
      
      .envelope-logo {
        width: 28px;
        height: 28px;
        background: linear-gradient(135deg, #5482ED, #7C3AED);
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 4px;
      }
      
      .envelope-logo svg {
        width: 16px;
        height: 16px;
        color: white;
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
      
      .envelope-close {
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
      }
      
      .envelope-close:hover {
        background: #f3f4f6;
        color: #374151;
      }
      
      .envelope-toast {
        position: fixed;
        bottom: 90px;
        right: 24px;
        background: #10b981;
        color: white;
        padding: 12px 20px;
        border-radius: 12px;
        font-size: 13px;
        font-weight: 600;
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        animation: envelope-slide-in 0.3s ease-out;
        z-index: 10000;
      }
      
      .envelope-toast.error {
        background: #ef4444;
        box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
      }
    </style>
    
    <div class="envelope-bar-container">
      <div class="envelope-logo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="4" width="20" height="16" rx="2"/>
          <path d="M22 6l-10 7L2 6"/>
        </svg>
      </div>
      
      <button class="envelope-btn envelope-btn-primary" id="envelope-btn-save">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        Save
      </button>
      
      <button class="envelope-btn envelope-btn-secondary" id="envelope-btn-compose">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        Compose
      </button>
      
      <div class="envelope-divider"></div>
      
      <button class="envelope-close" id="envelope-btn-close" title="Hide">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
  `;

    document.body.appendChild(bar);

    // Get page data
    function getPageData() {
        const data = {
            type: isProfilePage ? 'linkedin_person' : 'linkedin_company',
            sourceUrl: window.location.href,
            companyName: '',
            contactName: '',
            jobTitle: '',
            website: '',
            linkedinUrl: window.location.href
        };

        if (isProfilePage) {
            // Person profile
            const nameEl = document.querySelector('h1.text-heading-xlarge');
            const titleEl = document.querySelector('.text-body-medium.break-words');

            data.contactName = nameEl?.textContent?.trim() || '';
            data.jobTitle = titleEl?.textContent?.trim() || '';

            // Get company from experience
            const experienceSection = document.querySelector('#experience');
            if (experienceSection) {
                const companyEl = experienceSection.querySelector('.t-bold span[aria-hidden="true"]');
                data.companyName = companyEl?.textContent?.trim() || '';
            }

            // Fallback
            if (!data.companyName && data.jobTitle) {
                const match = data.jobTitle.match(/at\s+(.+)$/i);
                if (match) data.companyName = match[1].trim();
            }
        } else {
            // Company page
            const nameEl = document.querySelector('h1.org-top-card-summary__title');
            const websiteEl = document.querySelector('a[data-test-id="about-us-link"]');

            data.companyName = nameEl?.textContent?.trim() || '';
            if (!data.companyName) {
                const altName = document.querySelector('.org-top-card-summary__title span');
                data.companyName = altName?.textContent?.trim() || '';
            }
            data.website = websiteEl?.href || '';
        }

        return data;
    }

    // Show toast
    function showToast(message, isError = false) {
        const existing = document.querySelector('.envelope-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `envelope-toast${isError ? ' error' : ''}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => toast.remove(), 3000);
    }

    // Handle actions via message passing to extension
    async function handleAction(action) {
        const data = getPageData();

        // Disable buttons
        document.getElementById('envelope-btn-save').disabled = true;
        document.getElementById('envelope-btn-compose').disabled = true;

        try {
            // Send message to extension
            const response = await chrome.runtime.sendMessage({
                action: 'capture',
                compose: action === 'compose',
                data: data
            });

            if (response?.success) {
                showToast(response.message || 'Saved to Envelope!');

                if (action === 'compose' && response.composeUrl) {
                    window.open(response.composeUrl, '_blank');
                }
            } else {
                throw new Error(response?.error || 'Capture failed');
            }
        } catch (e) {
            console.error('[Envelope] Capture error:', e);
            showToast(e.message || 'Failed to save', true);
        } finally {
            document.getElementById('envelope-btn-save').disabled = false;
            document.getElementById('envelope-btn-compose').disabled = false;
        }
    }

    // Event listeners
    document.getElementById('envelope-btn-save').addEventListener('click', () => handleAction('save'));
    document.getElementById('envelope-btn-compose').addEventListener('click', () => handleAction('compose'));
    document.getElementById('envelope-btn-close').addEventListener('click', () => {
        bar.remove();
        // Remember dismissal for this session
        sessionStorage.setItem('envelope-bar-dismissed', 'true');
    });

    // Check if dismissed this session
    if (sessionStorage.getItem('envelope-bar-dismissed') === 'true') {
        bar.style.display = 'none';
    }

    console.log('[Envelope] Capture bar ready');
})();
