'use client';

/**
 * Website Health Debug Overlay
 * 
 * Shows debug info when NEXT_PUBLIC_DEBUG_HEALTH=1
 * Helps identify Score differences between Search and Lead Board
 */

import { WebsiteHealthDisplay } from '@/lib/scoring/websiteHealthUtils';

interface WebsiteHealthDebugProps {
    companyId?: number | string | null;
    websiteUrl?: string | null;
    display: WebsiteHealthDisplay;
    source?: string;
    recordId?: number | string | null;
}

export function WebsiteHealthDebug({
    companyId,
    websiteUrl,
    display,
    source = 'canonical',
    recordId
}: WebsiteHealthDebugProps) {
    // Only show in debug mode
    if (typeof window !== 'undefined') {
        const debugEnabled = process.env.NEXT_PUBLIC_DEBUG_HEALTH === '1' ||
            new URLSearchParams(window.location.search).get('debugHealth') === '1';
        if (!debugEnabled) return null;
    } else {
        if (process.env.NEXT_PUBLIC_DEBUG_HEALTH !== '1') return null;
    }

    return (
        <div
            className="mt-1 px-2 py-1 bg-yellow-50 border border-yellow-200 rounded text-[9px] font-mono text-yellow-800"
            style={{ maxWidth: '180px' }}
        >
            <div><strong>DEBUG</strong></div>
            <div>id: {companyId ?? 'null'}</div>
            <div>state: {display.status}</div>
            <div>score: {display.score ?? 'null'}</div>
            <div>scanned: {display.isScanned ? 'YES' : 'NO'}</div>
            <div>source: {source}</div>
            {recordId && <div>recId: {recordId}</div>}
            {websiteUrl && <div className="truncate">url: {websiteUrl}</div>}
        </div>
    );
}

export default WebsiteHealthDebug;
