// Envelope Chrome Extension - Background Service Worker

const API_BASE = 'https://envelope-app-git-main-oscar-richmonds-projects.vercel.app';

// Listen for tab updates to catch auth callback
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (!changeInfo.url) return;

    // Check if this is the extension callback page
    if (changeInfo.url.includes('/auth/extension-callback')) {
        console.log('[Envelope] Detected extension callback page');

        // Wait for page to load
        setTimeout(async () => {
            try {
                // Check if tab still exists
                const tabStillExists = await chrome.tabs.get(tabId).catch(() => null);
                if (!tabStillExists) {
                    console.log('[Envelope] Auth tab already closed');
                    return;
                }

                // Execute script to read token from page localStorage
                const results = await chrome.scripting.executeScript({
                    target: { tabId },
                    func: () => {
                        const token = localStorage.getItem('envelope-extension-token');
                        const email = localStorage.getItem('envelope-extension-email');
                        if (token && email) {
                            localStorage.removeItem('envelope-extension-token');
                            localStorage.removeItem('envelope-extension-email');
                            return { token, email };
                        }
                        return null;
                    }
                });

                const data = results[0]?.result;
                if (data?.token && data?.email) {
                    console.log('[Envelope] Token received, storing...');

                    // Store in extension storage
                    await chrome.storage.local.set({
                        authToken: data.token,
                        userEmail: data.email
                    });

                    // Close the auth tab
                    chrome.tabs.remove(tabId).catch(() => { });

                    console.log('[Envelope] Auth complete!');
                }
            } catch (e) {
                // Silently ignore - tab may be closed
                if (!e.message?.includes('No tab')) {
                    console.error('[Envelope] Token extraction failed:', e);
                }
            }
        }, 1500); // Wait 1.5s for page to fully load
    }
});

// Also listen for the page to complete loading
chrome.webNavigation?.onCompleted?.addListener(async (details) => {
    if (!details.url?.includes('/auth/extension-callback')) return;

    const tabId = details.tabId;

    // Try to extract token
    setTimeout(async () => {
        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId },
                func: () => {
                    const token = localStorage.getItem('envelope-extension-token');
                    const email = localStorage.getItem('envelope-extension-email');
                    if (token && email) {
                        localStorage.removeItem('envelope-extension-token');
                        localStorage.removeItem('envelope-extension-email');
                        return { token, email };
                    }
                    return null;
                }
            });

            const data = results[0]?.result;
            if (data?.token && data?.email) {
                await chrome.storage.local.set({
                    authToken: data.token,
                    userEmail: data.email
                });
                chrome.tabs.remove(tabId);
            }
        } catch (e) {
            console.error('[Envelope] onCompleted extraction failed:', e);
        }
    }, 500);
}, { url: [{ urlContains: 'extension-callback' }] });

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getAuthToken') {
        chrome.storage.local.get(['authToken'], (result) => {
            sendResponse({ token: result.authToken });
        });
        return true;
    }

    if (request.action === 'setAuthToken') {
        chrome.storage.local.set({
            authToken: request.token,
            userEmail: request.email
        }, () => {
            sendResponse({ success: true });
        });
        return true;
    }

    if (request.action === 'clearAuth') {
        chrome.storage.local.remove(['authToken', 'userEmail'], () => {
            sendResponse({ success: true });
        });
        return true;
    }

    // Handle capture requests from content script
    if (request.action === 'capture') {
        handleCapture(request.compose, request.data)
            .then(sendResponse)
            .catch(e => sendResponse({ success: false, error: e.message }));
        return true; // Keep channel open for async response
    }
});

// Capture handler for content script requests
async function handleCapture(compose, data) {
    // Get auth token
    const { authToken } = await chrome.storage.local.get(['authToken']);

    if (!authToken) {
        return { success: false, error: 'Not logged in', requiresAuth: true };
    }

    // Build payload
    const payload = {
        type: data.type,
        sourceUrl: data.sourceUrl,
        data: {
            companyName: data.companyName,
            website: data.website || '',
            contactName: data.contactName || '',
            jobTitle: data.jobTitle || '',
            email: data.email || '',
            linkedinUrl: data.linkedinUrl
        }
    };

    // Call capture API
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

    // Build response
    const response = {
        success: true,
        message: result.isNew
            ? `Added ${data.companyName} to Envelope`
            : `${data.companyName} updated`,
        leadId: result.leadId
    };

    // Add compose URL if requested
    if (compose && result.leadId) {
        response.composeUrl = `${API_BASE}/leads?leadId=${result.leadId}&compose=true`;
    }

    return response;
}

console.log('[Envelope] Service worker initialized');
