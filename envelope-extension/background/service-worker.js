// Envelope Chrome Extension - Background Service Worker

const API_BASE = 'https://envelope-app-git-main-oscar-richmonds-projects.vercel.app';

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getAuthToken') {
        chrome.storage.local.get(['authToken'], (result) => {
            sendResponse({ token: result.authToken });
        });
        return true; // Keep channel open for async response
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

// Listen for extension auth callback
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url && changeInfo.url.includes('/auth/extension-callback')) {
        try {
            const url = new URL(changeInfo.url);
            const token = url.searchParams.get('token');
            const email = url.searchParams.get('email');

            if (token) {
                chrome.storage.local.set({ authToken: token, userEmail: email }, () => {
                    // Close the auth tab
                    chrome.tabs.remove(tabId);

                    // Notify any open popups
                    chrome.runtime.sendMessage({ action: 'authComplete' });
                });
            }
        } catch (e) {
            console.error('Auth callback error:', e);
        }
    }
});

// Periodic token validation (optional)
async function validateToken() {
    const { authToken } = await chrome.storage.local.get(['authToken']);
    if (!authToken) return;

    try {
        const res = await fetch(`${API_BASE}/api/extension/validate`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!res.ok) {
            // Token invalid, clear it
            chrome.storage.local.remove(['authToken', 'userEmail']);
        }
    } catch (e) {
        // Network error, keep token
    }
}

// Validate token on startup
chrome.runtime.onStartup.addListener(validateToken);
