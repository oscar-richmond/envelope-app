/**
 * Diagnostics Mode Hook
 * 
 * Enables in-app diagnostics when NEXT_PUBLIC_DIAGNOSTICS=1
 * and user has enabled the toggle (persisted in localStorage).
 */

'use client';

import { useEffect, useState } from 'react';

export function useDiagnostics(): boolean {
    const [enabled, setEnabled] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const stored = localStorage.getItem('diagnostics_enabled');
        setEnabled(stored === 'true');
    }, []);

    // Only enable if env flag is set AND user toggled on
    return process.env.NEXT_PUBLIC_DIAGNOSTICS === '1' && enabled;
}

export function toggleDiagnostics(): void {
    if (typeof window === 'undefined') return;

    const current = localStorage.getItem('diagnostics_enabled') === 'true';
    const newValue = !current;
    localStorage.setItem('diagnostics_enabled', String(newValue));

    // Reload to apply changes
    window.location.reload();
}
