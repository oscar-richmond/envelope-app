/**
 * Diagnostics Toggle Button
 * 
 * Global toggle for diagnostics mode (only visible when DIAGNOSTICS env flag is set).
 */

'use client';

import { useState, useEffect } from 'react';
import { toggleDiagnostics } from '@/hooks/useDiagnostics';

export function DiagnosticsToggle() {
    const [enabled, setEnabled] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        setEnabled(localStorage.getItem('diagnostics_enabled') === 'true');
    }, []);

    if (!mounted || process.env.NEXT_PUBLIC_DIAGNOSTICS !== '1') {
        return null;
    }

    return (
        <button
            onClick={toggleDiagnostics}
            className={`
                px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                ${enabled
                    ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                    : 'bg-gray-100 text-gray-600 border border-gray-300'
                }
            `}
            title="Toggle diagnostics mode (requires page reload)"
        >
            {enabled ? '🔍 Diagnostics ON' : '🔍 Diagnostics OFF'}
        </button>
    );
}
