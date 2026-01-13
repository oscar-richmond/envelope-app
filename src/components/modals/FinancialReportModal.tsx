'use client';

import { useState } from 'react';
import { X, RefreshCw, TrendingUp, AlertTriangle, CheckCircle, AlertCircle, Info, Loader2 } from 'lucide-react';

interface FinancialIndicator {
    label: string;
    value?: string;
    points?: number;
    text?: string;
    status?: 'good' | 'ok' | 'risk';
}

interface FinancialReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    score: number;
    band: string;
    evidence: any;
    companyName?: string;
    companyId?: number;
    lastChecked?: string | Date | null;
    onRefresh?: () => void;
}

export default function FinancialReportModal({
    isOpen,
    onClose,
    score: initialScore,
    band: initialBand,
    evidence: initialEvidence,
    companyName,
    companyId,
    lastChecked: initialLastChecked,
    onRefresh
}: FinancialReportModalProps) {
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [score, setScore] = useState(initialScore ?? 0);
    const [band, setBand] = useState(initialBand ?? 'Unknown');
    const [evidence, setEvidence] = useState(initialEvidence);
    const [lastChecked, setLastChecked] = useState<string | Date | null>(initialLastChecked ?? null);

    if (!isOpen) return null;

    // Normalize evidence data
    const isRichData = !Array.isArray(evidence) && evidence?.breakdown && Array.isArray(evidence.breakdown);
    const breakdown: FinancialIndicator[] = isRichData
        ? evidence.breakdown
        : [];
    const listData: string[] = Array.isArray(evidence)
        ? evidence
        : (evidence?.details || []);

    const hasBreakdown = breakdown.length > 0 || listData.length > 0;

    // Handle sync
    async function handleSyncFinancials() {
        if (!companyId || syncing) return;

        setSyncing(true);
        setError(null);

        console.log(`[FinancialReportModal] Syncing financials for company ${companyId}...`);

        try {
            const res = await fetch(`/api/companies/${companyId}/financials/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await res.json();
            console.log(`[FinancialReportModal] Sync response:`, { status: res.status, data });

            if (!res.ok) {
                throw new Error(data.error || 'Failed to sync financials');
            }

            // Update state with new data
            if (data.score !== undefined) setScore(data.score);
            if (data.band) setBand(data.band);
            if (data.evidence) setEvidence(data.evidence);
            if (data.breakdown) setEvidence({ breakdown: data.breakdown, details: data.details });
            setLastChecked(new Date());

            // Notify parent to refresh
            onRefresh?.();

        } catch (e: any) {
            console.error('[FinancialReportModal] Sync error:', e);
            setError(e.message || 'Failed to sync financials');
        } finally {
            setSyncing(false);
        }
    }

    // Format last checked
    function formatLastChecked(date: string | Date | null): string {
        if (!date) return 'Never';
        const d = new Date(date);
        if (isNaN(d.getTime())) return 'Unknown';
        return d.toLocaleDateString(undefined, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // Get status icon
    function getStatusIcon(status?: string, points?: number) {
        if (status === 'good' || (points && points > 10)) {
            return <CheckCircle size={14} className="text-emerald-500" />;
        }
        if (status === 'ok' || (points && points > 0)) {
            return <AlertCircle size={14} className="text-amber-500" />;
        }
        return <AlertTriangle size={14} className="text-gray-400" />;
    }

    return (
        <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Financial Report</h3>
                        {companyName && <p className="text-xs text-gray-500">{companyName}</p>}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Score Section */}
                <div className="p-6">
                    <div className="flex items-center justify-between mb-8 bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <div>
                            <div className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">
                                Health Score
                            </div>
                            <div className={`text-3xl font-black ${band === 'Very Strong' || band === 'Strong' ? 'text-emerald-600' :
                                    band === 'Medium' ? 'text-amber-600' : 'text-rose-600'
                                }`}>
                                {score} <span className="text-sm text-gray-400 font-medium">/ 100</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${band === 'Very Strong' || band === 'Strong' ? 'bg-emerald-100 text-emerald-800' :
                                    band === 'Medium' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                                }`}>
                                {band}
                            </span>
                        </div>
                    </div>

                    {/* Analysis Breakdown */}
                    <div className="space-y-4 overflow-y-auto max-h-[40vh] pr-2">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-4">
                            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                                Analysis Breakdown
                            </h4>
                            <div className="group relative">
                                <Info size={14} className="text-gray-400 cursor-help" />
                                <div className="absolute right-0 top-6 w-48 p-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                    Shows financial health indicators from Companies House filings.
                                </div>
                            </div>
                        </div>

                        {breakdown.length > 0 ? (
                            // Rich breakdown data
                            breakdown.map((item, idx) => (
                                <div key={idx} className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded transition-colors">
                                    {getStatusIcon(item.status, item.points)}
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm font-medium text-gray-900">{item.label}</span>
                                            {item.points !== undefined && (
                                                <span className="text-xs font-mono font-bold text-gray-500">
                                                    +{item.points}
                                                </span>
                                            )}
                                            {item.value && (
                                                <span className="text-xs font-medium text-gray-600">
                                                    {item.value}
                                                </span>
                                            )}
                                        </div>
                                        {item.text && (
                                            <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
                                                {item.text}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : listData.length > 0 ? (
                            // Simple list data
                            listData.map((d, idx) => (
                                <div key={idx} className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded transition-colors">
                                    <TrendingUp size={14} className="mt-1 text-gray-400 shrink-0" />
                                    <span className="text-sm text-gray-600">{d}</span>
                                </div>
                            ))
                        ) : (
                            // Empty state
                            <div className="text-center py-8 text-gray-400 flex flex-col items-center gap-3">
                                <AlertTriangle size={28} className="opacity-30" />
                                <div>
                                    <p className="text-sm font-medium text-gray-500">
                                        No detailed breakdown available yet
                                    </p>
                                    <p className="text-xs mt-1">
                                        Click "Sync Financials" to generate a breakdown from Companies House data.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Error Display */}
                {error && (
                    <div className="mx-6 mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-center gap-2">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-between items-center">
                    <span className="text-xs text-gray-400">
                        Last verified: {formatLastChecked(lastChecked)}
                    </span>
                    <button
                        onClick={handleSyncFinancials}
                        disabled={syncing || !companyId}
                        className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-700 font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {syncing ? (
                            <>
                                <Loader2 size={14} className="animate-spin" />
                                Syncing...
                            </>
                        ) : (
                            <>
                                <RefreshCw size={14} />
                                Sync Financials
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
