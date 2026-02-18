'use client';

/**
 * Website Health Truth Panel
 * 
 * Dev-only expandable debug panel that shows:
 * - Client environment info
 * - Feature flag state from server
 * - Raw API fields (new + legacy)
 * - Display decision with reasoning
 * 
 * Enable with NEXT_PUBLIC_DEBUG_HEALTH=1
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp, Bug, Copy, Check } from 'lucide-react';

interface TruthPanelProps {
    companyId: string | number;
    companyName?: string;
    // Raw data from API
    rawData: {
        // New fields
        websiteHealthStatus?: string | null;
        websiteHealthScore?: number | null;
        websiteHealthScannedAt?: string | null;
        websiteHealthError?: string | null;
        websiteHealthVersion?: number | null;
        // Legacy fields
        stalenessScore?: number | null;
        lastAnalysedAt?: string | null;
        lastAnalyzedAt?: string | null;
        // Debug info from API
        _debug?: {
            ffNewWebsiteHealth: boolean;
            apiRoute: string;
            activeSchema: 'new' | 'legacy';
        };
    };
    // Computed display values (from getWebsiteHealthDisplay)
    displayResult: {
        status: string;
        score: number | null;
        label: string;
        showScore: boolean;
        isScanned: boolean;
    };
    // Optional: where this panel is being shown
    surface?: 'search' | 'leadboard' | 'profile' | 'popup';
}

export default function WebsiteHealthTruthPanel({
    companyId,
    companyName,
    rawData,
    displayResult,
    surface = 'popup'
}: TruthPanelProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [copied, setCopied] = useState(false);

    // Only show if debug flag enabled
    if (typeof window !== 'undefined' && !process.env.NEXT_PUBLIC_DEBUG_HEALTH) {
        return null;
    }

    const debugInfo = rawData._debug;
    const selectedSource = debugInfo?.activeSchema || (debugInfo?.ffNewWebsiteHealth ? 'new' : 'legacy');

    // Build reason string
    const buildReason = () => {
        const parts: string[] = [];

        if (selectedSource === 'new') {
            parts.push('FF=true → new fields');
            parts.push(`status=${rawData.websiteHealthStatus ?? 'null'}`);

            // Heal-on-read case: status null but scannedAt + legacy score exist
            if (!rawData.websiteHealthStatus && rawData.websiteHealthScannedAt && rawData.stalenessScore != null) {
                parts.push('→ heal-on-read: using legacy score');
            } else if (displayResult.status !== 'success') {
                parts.push('→ score hidden');
            }
        } else {
            parts.push('FF=false → legacy fields');
            const hasDate = rawData.lastAnalysedAt || rawData.lastAnalyzedAt;
            parts.push(`lastAnalysed=${hasDate ? 'set' : 'null'}`);
        }

        return parts.join('; ');
    };

    const handleCopy = async () => {
        const debugData = {
            companyId,
            companyName,
            surface,
            timestamp: new Date().toISOString(),
            url: typeof window !== 'undefined' ? window.location.href : '',
            featureFlag: debugInfo,
            rawFields: {
                new: {
                    websiteHealthStatus: rawData.websiteHealthStatus,
                    websiteHealthScore: rawData.websiteHealthScore,
                    websiteHealthScannedAt: rawData.websiteHealthScannedAt,
                    websiteHealthError: rawData.websiteHealthError
                },
                legacy: {
                    stalenessScore: rawData.stalenessScore,
                    lastAnalysedAt: rawData.lastAnalysedAt || rawData.lastAnalyzedAt
                }
            },
            displayResult,
            selectedSource,
            reason: buildReason()
        };

        await navigator.clipboard.writeText(JSON.stringify(debugData, null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div
            className="mt-2 rounded-md overflow-hidden text-xs"
            style={{
                background: 'rgba(251, 191, 36, 0.1)',
                border: '1px dashed rgba(251, 191, 36, 0.5)'
            }}
        >
            {/* Header - always visible */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between px-2 py-1 hover:bg-amber-100/20 transition"
            >
                <span className="flex items-center gap-1 font-mono text-amber-700">
                    <Bug size={12} />
                    Debug
                </span>
                <span className="flex items-center gap-2">
                    <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                        style={{
                            background: selectedSource === 'new' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                            color: selectedSource === 'new' ? 'rgb(22, 163, 74)' : 'rgb(220, 38, 38)'
                        }}
                    >
                        {selectedSource}
                    </span>
                    {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </span>
            </button>

            {/* Expanded content */}
            {isExpanded && (
                <div className="px-2 pb-2 pt-1 space-y-2 font-mono text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                    {/* Client Info */}
                    <div className="space-y-0.5">
                        <div className="font-semibold text-amber-700">Client</div>
                        <div>Surface: <span className="text-amber-600">{surface}</span></div>
                        <div>URL: <span className="text-gray-500 truncate">{typeof window !== 'undefined' ? window.location.pathname : '-'}</span></div>
                    </div>

                    {/* Server Flag */}
                    <div className="space-y-0.5">
                        <div className="font-semibold text-amber-700">Server Flag</div>
                        <div>
                            FF_NEW_WEBSITE_HEALTH:
                            <span className={debugInfo?.ffNewWebsiteHealth ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                                {debugInfo?.ffNewWebsiteHealth ? ' true' : ' false'}
                            </span>
                        </div>
                        <div>API: {debugInfo?.apiRoute || '-'}</div>
                    </div>

                    {/* Raw Fields - New */}
                    <div className="space-y-0.5">
                        <div className="font-semibold text-amber-700">New Fields</div>
                        <div>status: <span className="text-blue-600">{String(rawData.websiteHealthStatus ?? 'null')}</span></div>
                        <div>score: <span className="text-blue-600">{String(rawData.websiteHealthScore ?? 'null')}</span></div>
                        <div>scannedAt: <span className="text-gray-500">{rawData.websiteHealthScannedAt ? new Date(rawData.websiteHealthScannedAt).toLocaleString() : 'null'}</span></div>
                        <div>error: <span className="text-gray-500">{String(rawData.websiteHealthError ?? 'null')}</span></div>
                    </div>

                    {/* Raw Fields - Legacy */}
                    <div className="space-y-0.5">
                        <div className="font-semibold text-amber-700">Legacy Fields</div>
                        <div>stalenessScore: <span className="text-purple-600">{String(rawData.stalenessScore ?? 'null')}</span></div>
                        <div>lastAnalysedAt: <span className="text-gray-500">{rawData.lastAnalysedAt || rawData.lastAnalyzedAt ? new Date(String(rawData.lastAnalysedAt || rawData.lastAnalyzedAt)).toLocaleString() : 'null'}</span></div>
                    </div>

                    {/* Display Decision */}
                    <div className="space-y-0.5 p-1.5 rounded" style={{ background: 'rgba(0,0,0,0.05)' }}>
                        <div className="font-semibold text-amber-700">Display Decision</div>
                        <div>Source: <span className="font-bold text-amber-600">{selectedSource}</span></div>
                        <div>Status: <span className="font-bold">{displayResult.status}</span></div>
                        <div>Score: <span className="font-bold">{displayResult.showScore ? displayResult.score : `hidden (${displayResult.score})`}</span></div>
                        <div>Label: <span className="font-bold">{displayResult.label}</span></div>
                        <div className="mt-1 text-gray-500 italic">{buildReason()}</div>
                    </div>

                    {/* Copy button */}
                    <button
                        onClick={handleCopy}
                        className="w-full flex items-center justify-center gap-1 py-1 rounded hover:bg-amber-100/30 transition"
                    >
                        {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                        {copied ? 'Copied!' : 'Copy Debug JSON'}
                    </button>
                </div>
            )}
        </div>
    );
}
