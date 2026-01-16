// Envelope Chrome Extension - Background Service Worker

const API_BASE = 'https://envelope-app-sage.vercel.app';

// Debug toggle - set via environment or manually
const DEBUG = (() => {
    try {
        return self.localStorage?.getItem('envelope-debug') === 'true';
    } catch {
        return false; // Production default: off
    }
})();

function log(...args) {
    if (DEBUG) console.log('[Envelope]', ...args);
}

function logError(...args) {
    console.error('[Envelope]', ...args);
}

// Listen for tab updates to catch auth callback
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (!changeInfo.url) return;

    // Check if this is any extension auth page
    const isAuthPage = changeInfo.url.includes('/auth/extension-callback') ||
        changeInfo.url.includes('/auth/extension-signin') ||
        changeInfo.url.includes('/auth/extension');

    if (isAuthPage) {
        log('Detected extension auth page - starting token polling');

        // Poll for token multiple times
        let attempts = 0;
        const maxAttempts = 20;
        const pollInterval = 500;

        const pollForToken = async () => {
            attempts++;
            log(`Token poll attempt ${attempts}/${maxAttempts}`);

            try {
                // Check if tab still exists
                const tabStillExists = await chrome.tabs.get(tabId).catch(() => null);
                if (!tabStillExists) {
                    log('Auth tab closed');
                    return;
                }

                // Execute script safely with error handling
                const results = await chrome.scripting.executeScript({
                    target: { tabId },
                    func: () => {
                        const token = localStorage.getItem('envelope-extension-token');
                        const email = localStorage.getItem('envelope-extension-email');
                        const ready = localStorage.getItem('envelope-extension-ready');

                        console.log('[Envelope] Token check:', {
                            hasToken: !!token,
                            hasEmail: !!email,
                            ready
                        });

                        if (token && email) {
                            // Clear localStorage
                            localStorage.removeItem('envelope-extension-token');
                            localStorage.removeItem('envelope-extension-email');
                            localStorage.removeItem('envelope-extension-ready');
                            return { token, email };
                        }
                        return null;
                    }
                }).catch(error => {
                    // Handle script execution errors gracefully
                    const msg = error.message || '';
                    if (
                        msg.includes('No tab with id') ||
                        msg.includes('No frame with id') ||
                        msg.includes('cannot be scripted') ||
                        msg.includes('was removed')
                    ) {
                        log('Tab/frame gone during script execution (expected)');
                        return null; // Tab closed/navigated - stop polling
                    }
                    throw error; // Re-throw unexpected errors
                });

                // Check if we got results (tab might have closed)
                if (!results || !Array.isArray(results) || results.length === 0) {
                    log('No results from script execution - tab likely closed');
                    return; // Stop polling
                }

                const data = results[0]?.result || null;
                if (data?.token && data?.email) {
                    log('Token received from localStorage!');

                    // Store in extension storage
                    await chrome.storage.local.set({
                        authToken: data.token,
                        userEmail: data.email
                    });

                    log('Token stored in chrome.storage');

                    // Close the auth tab after a brief delay
                    setTimeout(async () => {
                        await chrome.tabs.remove(tabId).catch(() => { });
                        log('Auth complete!');
                    }, 500);

                    return; // Success - stop polling
                }

                // Continue polling
                if (attempts < maxAttempts) {
                    setTimeout(pollForToken, pollInterval);
                } else {
                    log('Max poll attempts reached - token not found');
                }

            } catch (e) {
                if (!e.message?.includes('No tab') && !e.message?.includes('cannot be scripted')) {
                    logError('Token extraction error:', e.message);
                }
                // Continue polling on error
                if (attempts < maxAttempts) {
                    setTimeout(pollForToken, pollInterval);
                }
            }
        };

        // Start polling after initial delay for page to load
        setTimeout(pollForToken, 1000);
    }
});

// Listen for messages from popup and content scripts
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

    // Log parsing errors
    if (request.action === 'logError') {
        logParsingError(request.data)
            .then(sendResponse)
            .catch(e => sendResponse({ success: false, error: e.message }));
        return true;
    }

    // Fetch lists
    if (request.action === 'getLists') {
        fetchLists()
            .then(sendResponse)
            .catch(e => sendResponse({ success: false, error: e.message }));
        return true;
    }

    // Create new list
    if (request.action === 'createList') {
        createList(request.name)
            .then(sendResponse)
            .catch(e => sendResponse({ success: false, error: e.message }));
        return true;
    }

    // Handle capture requests from content script
    if (request.action === 'capture') {
        handleCapture(request.compose, request.data, request.listId)
            .then(sendResponse)
            .catch(e => {
                logError('Capture handler error:', e);
                sendResponse({
                    success: false,
                    error: e.message || 'Capture failed',
                    errorCode: e.code || 'UNKNOWN'
                });
            });
        return true;
    }
});

// Log parsing errors to monitoring API
async function logParsingError(errorData) {
    try {
        await fetch(`${API_BASE}/api/extension/errors`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(errorData)
        });
        return { success: true };
    } catch (e) {
        return { success: false };
    }
}

// Fetch available lists
async function fetchLists() {
    const { authToken } = await chrome.storage.local.get(['authToken']);

    if (!authToken) {
        return { success: false, error: 'Not logged in', requiresAuth: true };
    }

    const res = await fetch(`${API_BASE}/api/lists`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (!res.ok) {
        if (res.status === 401) {
            return { success: false, error: 'Session expired', requiresAuth: true };
        }
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to fetch lists');
    }

    const data = await res.json();
    return { success: true, lists: data.lists };
}

// Create a new list
async function createList(name) {
    const { authToken } = await chrome.storage.local.get(['authToken']);

    if (!authToken) {
        return { success: false, error: 'Not logged in', requiresAuth: true };
    }

    const res = await fetch(`${API_BASE}/api/lists`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ name })
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to create list');
    }

    const data = await res.json();
    return { success: true, list: data.list };
}

// Capture handler for content script requests
async function handleCapture(compose, data, listId) {
    log('Capture request:', { compose, type: data.type, companyName: data.companyName });

    // Get auth token
    const { authToken } = await chrome.storage.local.get(['authToken']);

    if (!authToken) {
        log('No auth token found');
        const error = new Error('Sign in required');
        error.code = 'AUTH_REQUIRED';
        error.requiresAuth = true;
        throw error;
    }

    log('Auth token present, calling API...');
    log('API URL:', `${API_BASE}/api/extension/capture`);

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

    log('Payload:', JSON.stringify(payload).substring(0, 200));

    // Call capture API
    let res;
    try {
        res = await fetch(`${API_BASE}/api/extension/capture`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(payload)
        });
    } catch (fetchError) {
        logError('Fetch failed:', fetchError);
        const error = new Error('Network error - check your connection');
        error.code = 'NETWORK_ERROR';
        throw error;
    }

    log('Response status:', res.status);

    // Parse response
    let result;
    try {
        result = await res.json();
    } catch (parseError) {
        logError('Failed to parse response:', parseError);
        const error = new Error('Invalid server response');
        error.code = 'INVALID_RESPONSE';
        throw error;
    }

    log('Response body:', JSON.stringify(result).substring(0, 200));

    // Handle error responses with specific messages
    if (!res.ok) {
        const error = new Error(result.error || 'Capture failed');
        error.code = result.code || 'UNKNOWN';
        error.status = res.status;

        // Set requiresAuth for 401
        if (res.status === 401) {
            error.requiresAuth = true;
        }

        throw error;
    }

    // Add to list if listId provided
    let listName = 'Envelope';
    if (listId && result.prospectId) {
        try {
            const listRes = await fetch(`${API_BASE}/api/lists/add-company`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    listId: listId,
                    prospectId: result.prospectId
                })
            });

            if (listRes.ok) {
                const listResult = await listRes.json();
                listName = listResult.listName || 'List';
            }
        } catch (e) {
            logError('Failed to add to list:', e);
            // Don't fail the whole operation
        }
    }

    // Build response
    const response = {
        success: true,
        message: result.isNew
            ? `Added to ${listName}`
            : `${data.companyName} updated`,
        leadId: result.leadId,
        prospectId: result.prospectId,
        listName: listName,
        openUrl: `${API_BASE}/prospects?prospectId=${result.prospectId}`
    };

    // Add compose URL if requested
    if (compose && result.leadId) {
        response.composeUrl = `${API_BASE}/leads?leadId=${result.leadId}&compose=true`;
    }

    log('Capture success:', response);
    return response;
}

log('Service worker initialized');
log('API Base:', API_BASE);
