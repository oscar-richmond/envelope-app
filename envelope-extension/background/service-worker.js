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
                    chrome.tabs.remove(tabId);

                    console.log('[Envelope] Auth complete!');
                }
            } catch (e) {
                console.error('[Envelope] Token extraction failed:', e);
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
});

console.log('[Envelope] Service worker initialized');
