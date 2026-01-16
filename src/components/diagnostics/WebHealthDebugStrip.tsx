/**
 * Web Health Debug Strip
 * 
 * Shows diagnostic info under Web Health displays when diagnostics enabled.
 */

'use client';

import { useState } from 'react';
import { useDiagnostics } from '@/hooks/useDiagnostics';
import type { WebHealthDisplay } from '@/lib/websiteHealth/displayHelper';

interface Props {
    company: {
        id: number;
        companyName?: string;
        // Canonical fields
        websiteHealthStatus?: string | null;
        websiteHealthScore?: number | null;
        websiteHealthLabel?: string | null;
        websiteHealthError?: string | null;
        websiteHealthVersion?: number | null;
        websiteHealthScannedAt?: Date | string | null;
        // Legacy fields
        stalenessScore?: number | null;
        lastAnalysedAt?: Date | string | null;
    };
    display: WebHealthDisplay;
}

export function WebHealthDebugStrip({ company, display }: Props) {
    const diagnostics = useDiagnostics();
    const [expanded, setExpanded] = useState(false);

    if (!diagnostics) return null;

    // Determine source
    const hasCanonical = company.websiteHealthScore !== undefined;
    const hasLegacy = company.stalenessScore !== undefined;
    const sourceUsed = hasCanonical ? 'canonical' : hasLegacy ? 'legacy' : 'none';

    // Determine reason for display
    let reason = '';
    if (display.isError && company.websiteHealthError === 'NO_WEBSITE_URL') {
        reason = 'Error: NO_WEBSITE_URL';
    } else if (display.score === null && display.label === 'Not scanned') {
        reason = 'Score null → Not Scanned';
    } else if (display.score === null && display.label === 'No website') {
        reason = 'NO_WEBSITE_URL → No website';
    } else if (display.score === 0 && company.websiteHealthScore === null) {
        reason = '⚠️ NULL COERCED TO 0';
    } else if (display.showScore) {
        reason = `Success: score=${display.score}`;
    } else {
        reason = 'Unknown state';
    }

    return (
        <div className="text-[9px] font-mono bg-yellow-50 border border-yellow-300 rounded p-1.5 mt-1">
            <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 text-yellow-800 hover:text-yellow-900"
            >
                <span>{expanded ? '▼' : '▶'}</span>
                <span className="font-semibold">Debug</span>
                <span className="text-[8px] ml-1">({sourceUsed})</span>
            </button>

            {expanded && (
                <div className="mt-1.5 space-y-0.5 text-gray-700">
                    <div><b>Source:</b> {sourceUsed}</div>
                    <div><b>Status:</b> {String(company.websiteHealthStatus ?? 'null')}</div>
                    <div><b>Score:</b> {String(company.websiteHealthScore ?? 'null')}</div>
                    <div><b>Label:</b> {String(company.websiteHealthLabel ?? 'null')}</div>
                    <div><b>Error:</b> {String(company.websiteHealthError ?? 'null')}</div>
                    <div><b>Version:</b> {String(company.websiteHealthVersion ?? 'null')}</div>
                    <div><b>Scanned:</b> {company.websiteHealthScannedAt ? String(company.websiteHealthScannedAt) : 'null'}</div>
                    <div className="border-t border-yellow-300 my-1 pt-1">
                        <b>Legacy:</b> {String(company.stalenessScore ?? 'null')}
                    </div>
                    <div className="border-t border-yellow-300 my-1 pt-1">
                        <b>Rendered Label:</b> {display.label}
                    </div>
                    <div><b>Rendered Score:</b> {String(display.score ?? 'null')}</div>
                    <div><b>Show Score:</b> {String(display.showScore)}</div>
                    <div className={`text-red-600 font-semibold mt-1 ${reason.includes('⚠️') ? 'bg-red-100 p-1 rounded' : ''}`}>
                        <b>Reason:</b> {reason}
                    </div>
                </div>
            )}
        </div>
    );
}
