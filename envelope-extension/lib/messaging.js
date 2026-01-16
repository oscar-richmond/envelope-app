// Envelope Chrome Extension - Safe Messaging Utilities
// Handles tab/frame lifecycle errors gracefully

const DEBUG = false; // Set via localStorage: envelope-debug

function log(...args) {
    if (DEBUG || (typeof localStorage !== 'undefined' && localStorage.getItem('envelope-debug') === 'true')) {
        console.log('[Envelope Messaging]', ...args);
    }
}

/**
 * Safely send a message to a tab
 * @param {number} tabId - Chrome tab ID
 * @param {object} message - Message to send
 * @param {object} options - Optional configuration
 * @returns {Promise<{ok: boolean, data?: any, reason?: string}>}
 */
export async function safeSendToTab(tabId, message, options = {}) {
    try {
        // Validate tabId
        if (typeof tabId !== 'number') {
            log('Invalid tab ID:', tabId);
            return { ok: false, reason: 'invalid_tab_id' };
        }

        // Check if tab still exists
        const tab = await chrome.tabs.get(tabId).catch(() => null);
        if (!tab) {
            log('Tab not found:', tabId);
            return { ok: false, reason: 'tab_missing' };
        }

        // Send message
        const response = await chrome.tabs.sendMessage(tabId, message);
        log('Message sent successfully to tab', tabId);
        return { ok: true, data: response };

    } catch (error) {
        // Handle expected lifecycle errors silently
        const errorMsg = error.message || '';
        if (
            errorMsg.includes('No tab with id') ||
            errorMsg.includes('No frame with id') ||
            errorMsg.includes('Frame with ID') ||
            errorMsg.includes('was removed') ||
            errorMsg.includes('Receiving end does not exist')
        ) {
            log('Tab/frame lifecycle error (expected):', errorMsg);
            return { ok: false, reason: 'tab_or_frame_gone' };
        }

        // Log unexpected errors
        console.error('[Envelope] Unexpected messaging error:', error);
        return { ok: false, reason: 'unexpected_error', error: errorMsg };
    }
}

/**
 * Safely execute a script in a tab
 * @param {number} tabId - Chrome tab ID
 * @param {object} scriptConfig - Script configuration (func, args, etc.)
 * @param {object} options - Optional configuration
 * @returns {Promise<{ok: boolean, results: Array, reason?: string}>}
 */
export async function safeExecuteScript(tabId, scriptConfig, options = {}) {
    try {
        // Validate tabId
        if (typeof tabId !== 'number') {
            log('Invalid tab ID:', tabId);
            return { ok: false, reason: 'invalid_tab_id', results: [] };
        }

        // Check if tab still exists
        const tab = await chrome.tabs.get(tabId).catch(() => null);
        if (!tab) {
            log('Tab not found:', tabId);
            return { ok: false, reason: 'tab_missing', results: [] };
        }

        // Execute script
        const results = await chrome.scripting.executeScript({
            target: { tabId },
            ...scriptConfig
        });

        // Safely access results with default
        const resultsArray = Array.isArray(results) ? results : [];
        log('Script executed successfully, results:', resultsArray.length);
        return { ok: true, results: resultsArray };

    } catch (error) {
        const errorMsg = error.message || '';

        // Handle expected lifecycle errors
        if (
            errorMsg.includes('No tab with id') ||
            errorMsg.includes('No frame with id') ||
            errorMsg.includes('Frame with ID') ||
            errorMsg.includes('was removed') ||
            errorMsg.includes('Cannot access') ||
            errorMsg.includes('cannot be scripted')
        ) {
            log('Script execution lifecycle error (expected):', errorMsg);
            return { ok: false, reason: 'tab_or_frame_gone', results: [] };
        }

        console.error('[Envelope] Script execution error:', error);
        return { ok: false, reason: 'script_failed', error: errorMsg, results: [] };
    }
}

/**
 * Check if a tab exists
 * @param {number} tabId - Chrome tab ID
 * @returns {Promise<boolean>}
 */
export async function tabExists(tabId) {
    try {
        const tab = await chrome.tabs.get(tabId);
        return !!tab;
    } catch {
        return false;
    }
}
