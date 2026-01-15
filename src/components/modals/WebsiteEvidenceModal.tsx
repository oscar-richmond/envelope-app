'use client';

import { useState } from 'react';
import { X, RefreshCw, CheckCircle, AlertCircle, AlertTriangle, Loader2 } from 'lucide-react';

interface WebsiteEvidenceModalProps {
    isOpen: boolean;
    onClose: () => void;
    evidence: {
        signals?: string[];
        breakdown?: { label: string; points: number; text?: string; status?: 'good' | 'ok' | 'risk' }[];
        score?: number;
        label?: string;
        status?: string;
    } | string[];
    url?: string;
    lastChecked?: string;
    companyId?: number;
    onRefresh?: () => void;
}

export default function WebsiteEvidenceModal({
    isOpen,
    onClose,
    evidence,
    url,
    lastChecked,
    companyId,
    onRefresh
}: WebsiteEvidenceModalProps) {
    const [scanning, setScanning] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    // Normalize evidence data - support both old string[] and new structured format
    const isStructuredEvidence = !Array.isArray(evidence) && typeof evidence === 'object';
    const signals: string[] = isStructuredEvidence
        ? (evidence.signals || [])
        : (Array.isArray(evidence) ? evidence : []);
    const breakdown = isStructuredEvidence ? (evidence.breakdown || []) : [];
    const score = isStructuredEvidence ? evidence.score : undefined;
    const label = isStructuredEvidence ? evidence.label : undefined;
    const status = isStructuredEvidence ? evidence.status : (signals.length > 0 ? 'success' : 'never_scanned');

    const hasData = signals.length > 0 || breakdown.length > 0;

    const copyEvidence = () => {
        const text = `Website Evidence for ${url || 'Domain'}\n\n` + signals.join('\n');
        navigator.clipboard.writeText(text);
    };

    // Handle scan
    async function handleScanWebsite() {
        if (!companyId || scanning) return;

        setScanning(true);
        setError(null);

        try {
            const res = await fetch(`/api/companies/${companyId}/web-health/scan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to scan website');
            }

            // Notify parent to refresh
            onRefresh?.();

        } catch (e: any) {
            console.error('[WebsiteEvidenceModal] Scan error:', e);
            setError(e.message || 'Failed to scan website');
        } finally {
            setScanning(false);
        }
    }

    // Get status icon for breakdown items
    function getStatusIcon(itemStatus?: string, points?: number) {
        if (itemStatus === 'good' || (points && points > 10)) {
            return <CheckCircle size={14} className="text-emerald-500" />;
        }
        if (itemStatus === 'ok' || (points && points > 0)) {
            return <AlertCircle size={14} className="text-amber-500" />;
        }
        return <AlertTriangle size={14} className="text-gray-400" />;
    }

    // Get score color
    const getScoreColor = (s: number) => {
        if (s >= 70) return 'text-emerald-600';
        if (s >= 40) return 'text-amber-600';
        return 'text-rose-600';
    };

    const getLabelColor = (l?: string) => {
        if (l === 'Healthy' || l === 'Fresh') return 'bg-emerald-100 text-emerald-800';
        if (l === 'Needs Work' || l === 'Stale') return 'bg-amber-100 text-amber-800';
        return 'bg-rose-100 text-rose-800';
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Website Review</h3>
                        {url && <p className="text-xs text-gray-500 truncate max-w-sm">{url}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={copyEvidence}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-md hover:bg-gray-200 transition"
                            title="Copy Evidence"
                        >
                            <span className="sr-only">Copy</span>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        </button>
                        <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Score Section (if available) */}
                {score !== undefined && (
                    <div className="p-6 border-b border-gray-100">
                        <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <div>
                                <div className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">
                                    Website Health
                                </div>
                                <div className={`text-3xl font-black ${getScoreColor(score)}`}>
                                    {score} <span className="text-sm text-gray-400 font-medium">/ 100</span>
                                </div>
                            </div>
                            {label && (
                                <div className="text-right">
                                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${getLabelColor(label)}`}>
                                        {label}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="p-6 overflow-y-auto flex-1">
                    {/* Breakdown Section */}
                    {breakdown.length > 0 && (
                        <div className="mb-6">
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                Score Breakdown
                            </h4>
                            <div className="space-y-2">
                                {breakdown.map((item, idx) => (
                                    <div key={idx} className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded transition-colors">
                                        {getStatusIcon(item.status, item.points)}
                                        <div className="flex-1">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-medium text-gray-900">{item.label}</span>
                                                <span className={`text-xs font-mono font-bold ${item.points > 0 ? 'text-emerald-600' : item.points < 0 ? 'text-rose-600' : 'text-gray-500'}`}>
                                                    {item.points > 0 ? '+' : ''}{item.points}
                                                </span>
                                            </div>
                                            {item.text && (
                                                <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
                                                    {item.text}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Legacy Signals Section */}
                    {signals.length > 0 && breakdown.length === 0 && (
                        <div className="space-y-6">
                            <div>
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                    Content & Activity Signals
                                </h4>
                                <ul className="space-y-2">
                                    {signals.filter(r => r.match(/blog|sitemap|copyright|content update/i)).map((r: string, i: number) => (
                                        <li key={i} className="text-sm text-gray-700 bg-gray-50 p-2 rounded border border-gray-100">{r}</li>
                                    ))}
                                    {signals.filter(r => r.match(/blog|sitemap|copyright|content update/i)).length === 0 && (
                                        <li className="text-sm text-gray-400 italic pl-2">No strong content signals recorded.</li>
                                    )}
                                </ul>
                            </div>

                            <div className="border-t border-gray-100 pt-6">
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                    Design & Technical Opportunities
                                </h4>
                                <ul className="space-y-2">
                                    {signals.filter(r => !r.match(/blog|sitemap|copyright|Assumed Fresh|content update/i)).map((r: string, i: number) => (
                                        <li key={i} className="text-sm text-gray-700 bg-gray-50 p-2 rounded border border-gray-100">{r}</li>
                                    ))}
                                    {signals.filter(r => !r.match(/blog|sitemap|copyright|Assumed Fresh|content update/i)).length === 0 && (
                                        <li className="text-sm text-gray-400 italic pl-2">No specific design issues detected.</li>
                                    )}
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* Empty/Not Scanned State */}
                    {!hasData && (
                        <div className="text-center py-12">
                            <AlertTriangle size={32} className="mx-auto text-gray-300 mb-4" />
                            <p className="text-gray-500 font-medium">No website analysis available yet</p>
                            <p className="text-gray-400 text-sm mt-1 mb-6">Run a scan to generate detailed insights</p>
                            {companyId && (
                                <button
                                    onClick={handleScanWebsite}
                                    disabled={scanning}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 transition disabled:opacity-50"
                                >
                                    {scanning ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            Scanning...
                                        </>
                                    ) : (
                                        <>
                                            <RefreshCw size={16} />
                                            Scan Website
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    )}

                    {/* Error Display */}
                    {error && (
                        <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-center gap-2">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-between items-center text-xs text-gray-400">
                    <span>{lastChecked ? `Analysis date: ${new Date(lastChecked).toLocaleDateString()}` : 'Analysis pending'}</span>
                    <button
                        onClick={handleScanWebsite}
                        disabled={scanning || !companyId}
                        className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {scanning ? (
                            <>
                                <Loader2 size={12} className="animate-spin" />
                                Scanning...
                            </>
                        ) : (
                            <>
                                <RefreshCw size={12} />
                                Rescan
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
