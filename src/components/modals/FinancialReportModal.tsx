'use client';

import { useState, useEffect, useCallback } from 'react';
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
    companyId: number;
    companyName?: string;
    onDataUpdated?: () => void; // Callback when data changes
    // Legacy props (optional, for backwards compat - will be overwritten by fetch)
    score?: number | null;
    band?: string;
    evidence?: any;
}

type ScanStatus = 'loading' | 'not_synced' | 'syncing' | 'complete' | 'failed';

export default function FinancialReportModal({
    isOpen,
    onClose,
    companyId,
    companyName,
    onDataUpdated,
    score: legacyScore,
    band: legacyBand,
    evidence: legacyEvidence
}: FinancialReportModalProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [score, setScore] = useState<number | null>(legacyScore ?? null);
    const [band, setBand] = useState<string>(legacyBand ?? 'Unknown');
    const [factors, setFactors] = useState<FinancialIndicator[]>([]);
    const [lastChecked, setLastChecked] = useState<string | Date | null>(null);
    const [scanStatus, setScanStatus] = useState<ScanStatus>('loading');

    // Fetch data from API on open
    const fetchData = useCallback(async () => {
        if (!companyId) return;

        setIsLoading(true);
        setError(null);

        try {
            console.log(`[FinancialReportModal] Fetching data for company ${companyId}`);
            const res = await fetch(`/api/companies/${companyId}/financials/sync`);
            const json = await res.json();

            if (!res.ok) {
                console.error('[FinancialReportModal] API error:', json);
                setError(json.error || 'Failed to load financial data');
                setScanStatus('failed');
                return;
            }

            console.log('[FinancialReportModal] API response:', json);

            // Map factors from API response
            const apiFactors: FinancialIndicator[] = (json.factors || []).map((f: any) => ({
                label: f.label || f.title || '',
                points: f.points || 0,
                text: f.description || f.text || '',
                status: f.status || (f.points && f.points > 10 ? 'good' : f.points && f.points > 0 ? 'ok' : 'risk')
            }));

            // Update state
            setScore(json.score ?? null);
            setBand(json.band || getBandFromScore(json.score));
            setFactors(apiFactors);
            setLastChecked(json.syncedAt || json.lastSyncedAt || null);

            // Determine status
            if (json.syncState === 'not_synced' || (json.score === null && apiFactors.length === 0)) {
                setScanStatus('not_synced');
            } else if (json.syncState === 'failed') {
                setScanStatus('failed');
            } else {
                setScanStatus('complete');
            }

        } catch (e: any) {
            console.error('[FinancialReportModal] Fetch error:', e);
            setError(e.message || 'Failed to load financial data');
            setScanStatus('failed');
        } finally {
            setIsLoading(false);
        }
    }, [companyId]);

    // Fetch on mount/open
    useEffect(() => {
        if (isOpen && companyId) {
            fetchData();
        }
    }, [isOpen, companyId, fetchData]);

    if (!isOpen) return null;

    // Helper to get band from score
    function getBandFromScore(s: number | null): string {
        if (s === null) return 'Unknown';
        if (s >= 75) return 'Very Strong';
        if (s >= 60) return 'Strong';
        if (s >= 40) return 'Medium';
        if (s >= 25) return 'Weak';
        return 'Very Weak';
    }

    // Handle sync
    async function handleSyncFinancials() {
        if (!companyId || syncing) return;

        setSyncing(true);
        setScanStatus('syncing');
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

            const newFactors: FinancialIndicator[] = (data.factors || []).map((f: any) => ({
                label: f.label || f.title || '',
                points: f.points || 0,
                text: f.description || f.text || '',
                status: f.status || (f.points && f.points > 10 ? 'good' : f.points && f.points > 0 ? 'ok' : 'risk')
            }));
            setFactors(newFactors);
            setLastChecked(new Date());
            setScanStatus('complete');

            // Notify parent to refresh
            onDataUpdated?.();

        } catch (e: any) {
            console.error('[FinancialReportModal] Sync error:', e);
            setError(e.message || 'Failed to sync financials');
            setScanStatus('failed');
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

    // Loading state
    if (isLoading) {
        return (
            <div
                className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200"
                onClick={onClose}
            >
                <div
                    className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-8 flex flex-col items-center gap-4"
                    onClick={e => e.stopPropagation()}
                >
                    <Loader2 size={32} className="animate-spin text-indigo-600" />
                    <p className="text-sm text-gray-600">Loading financial data...</p>
                </div>
            </div>
        );
    }

    // Not synced state
    if (scanStatus === 'not_synced') {
        return (
            <div
                className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200"
                onClick={onClose}
            >
                <div
                    className="bg-white rounded-xl shadow-2xl max-w-lg w-full"
                    onClick={e => e.stopPropagation()}
                >
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
                    <div className="p-8 text-center">
                        <TrendingUp size={48} className="mx-auto text-gray-300 mb-4" />
                        <h4 className="text-lg font-semibold text-gray-900 mb-2">No Financial Data Yet</h4>
                        <p className="text-sm text-gray-600 mb-6">
                            Sync Companies House data to see financial health indicators.
                        </p>
                        <button
                            onClick={handleSyncFinancials}
                            disabled={syncing}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium disabled:opacity-50"
                        >
                            {syncing ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Syncing...
                                </>
                            ) : (
                                <>
                                    <RefreshCw size={16} />
                                    Sync Financials
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        );
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
                                {score ?? '--'} <span className="text-sm text-gray-400 font-medium">/ 100</span>
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

                        {factors.length > 0 ? (
                            factors.map((item, idx) => (
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
                        ) : (
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
