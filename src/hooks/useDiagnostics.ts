/**
 * Diagnostics Mode Hook
 * 
 * Enables in-app diagnostics when NEXT_PUBLIC_DIAGNOSTICS=1
 * Supports URL params (?diag=1/0) and localStorage persistence
 */

'use client';

import { useEffect, useState } from 'react';

export function useDiagnostics(): boolean {
    const [enabled, setEnabled] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        // Only enable if env var is set
        if (process.env.NEXT_PUBLIC_DIAGNOSTICS !== '1') {
            setEnabled(false);
            return;
        }

        // Check URL params first (?diag=1 or ?diag=0)
        const params = new URLSearchParams(window.location.search);
        const diagParam = params.get('diag');

        if (diagParam === '1') {
            localStorage.setItem('diagnostics_enabled', 'true');
            setEnabled(true);
        } else if (diagParam === '0') {
            localStorage.removeItem('diagnostics_enabled');
            setEnabled(false);
        } else {
            // Check localStorage
            const stored = localStorage.getItem('diagnostics_enabled');
            setEnabled(stored === 'true');
        }
    }, []);

    return enabled;
}

export function toggleDiagnostics(): void {
    if (typeof window === 'undefined') return;

    const current = localStorage.getItem('diagnostics_enabled') === 'true';
    const newValue = !current;
    localStorage.setItem('diagnostics_enabled', String(newValue));

    // Reload to apply changes
    window.location.reload();
}
