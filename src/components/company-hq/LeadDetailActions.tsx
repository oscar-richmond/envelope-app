'use client';

import { useState, useCallback } from 'react';
import { RefreshCw, ExternalLink, FileText, Globe, TrendingUp, Loader2, AlertCircle, Play } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ScoreDisplay, FactorsList, getStatusFromScore, type Factor } from '@/components/reports/shared';

// Scan states
type ScanStatus = 'UNSCANNED' | 'SCANNING' | 'SCANNED' | 'FAILED';

interface LeadDetailActionsProps {
    leadId: number;
    companyProspectId: number | null;
    websiteUrl: string;
}

// Refresh Data Button - refreshes ALL company data
export function RefreshDataButton({ leadId, companyProspectId }: { leadId: number; companyProspectId: number | null }) {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const router = useRouter();

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            const promises = [];

            // Use correct company endpoints if we have companyProspectId
            if (companyProspectId) {
                // Website scan - use company endpoint for real breakdown data
                promises.push(
                    fetch(`/api/companies/${companyProspectId}/web-health/scan`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ force: true })
                    })
                );
                // Financial scan - use company endpoint for real breakdown data
                promises.push(
                    fetch(`/api/companies/${companyProspectId}/financials/sync`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ force: true })
                    })
                );
                // Contacts scan
                promises.push(
                    fetch(`/api/companies/${companyProspectId}/contacts/scan`, { method: 'POST' })
                );
            } else {
                // Fallback to old endpoints if no companyProspectId
                promises.push(
                    fetch('/api/scan/website', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ leadId })
                    }),
                    fetch('/api/scan/financials', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ leadId })
                    })
                );
            }

            // Wait for all to complete
            await Promise.allSettled(promises);

            // Refresh the page to get updated data
            router.refresh();
        } catch (error) {
            console.error('[RefreshData] Error:', error);
        } finally {
            setIsRefreshing(false);
        }
    };

    return (
        <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="btn btn-secondary flex items-center gap-2"
            style={{ opacity: isRefreshing ? 0.7 : 1 }}
        >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
        </button>
    );
}

// Report Modal Component
interface ReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    onRescan?: () => void;
    isScanning?: boolean;
}

function ReportModal({ isOpen, onClose, title, children, onRescan, isScanning }: ReportModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div
                className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-hidden"
                style={{ border: '1px solid var(--border-soft)' }}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
                    <div className="flex items-center gap-2">
                        {onRescan && (
                            <button
                                onClick={onRescan}
                                disabled={isScanning}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors disabled:opacity-50"
                            >
                                <RefreshCw size={12} className={isScanning ? 'animate-spin' : ''} />
                                Rescan
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
                        >
                            ×
                        </button>
                    </div>
                </div>
                <div className="overflow-y-auto max-h-[calc(85vh-80px)] p-6">
                    {children}
                </div>
            </div>
        </div>
    );
}

// Website Review Card with proper state management
interface WebsiteReviewCardProps {
    factors?: Factor[];
    signals?: string[]; // Legacy support
    websiteUrl: string;
    score?: number | null;
    leadId?: number;
    companyProspectId?: number | null;
}

export function WebsiteReviewCard({ factors = [], signals = [], websiteUrl, score, leadId, companyProspectId }: WebsiteReviewCardProps) {
    const [showReport, setShowReport] = useState(false);
    const [scanStatus, setScanStatus] = useState<ScanStatus>(
        (score !== undefined && score !== null) || factors.length > 0 || signals.length > 0 ? 'SCANNED' : 'UNSCANNED'
    );
    const [error, setError] = useState<string | null>(null);
    const [reportData, setReportData] = useState<{
        score: number | null;
        factors: Factor[];
        statusLabel: string;
    } | null>(null);
    const [isLoadingReport, setIsLoadingReport] = useState(false);
    const router = useRouter();

    // Initial display factors from props
    const initialFactors: Factor[] = factors.length > 0 ? factors : signals.map((s, i) => ({
        id: `signal-${i}`,
        label: s,
        points: 0,
        polarity: 'positive' as const
    }));

    // Use fetched report data if available, otherwise use props
    const displayScore = reportData?.score ?? score ?? null;
    const displayFactors = reportData?.factors ?? initialFactors;

    // Determine if we have valid scan data
    const hasValidData = scanStatus === 'SCANNED' && (displayScore !== null);

    // Fetch report data from API when opening modal
    const fetchReportData = async () => {
        if (!companyProspectId) return;

        setIsLoadingReport(true);
        try {
            const res = await fetch(`/api/companies/${companyProspectId}/web-health/scan`);
            if (res.ok) {
                const data = await res.json();
                setReportData({
                    score: data.score,
                    factors: data.factors || [],
                    statusLabel: data.statusLabel || 'Unknown'
                });
                if (data.score !== null && data.score !== undefined) {
                    setScanStatus('SCANNED');
                }
            }
        } catch (e) {
            console.error('[WebsiteReviewCard] Failed to fetch report:', e);
        } finally {
            setIsLoadingReport(false);
        }
    };

    const handleViewReport = async () => {
        setShowReport(true);
        // Fetch fresh data from API
        if (companyProspectId) {
            await fetchReportData();
        }
    };

    const handleScan = async () => {
        if (!companyProspectId && !leadId) return;

        setScanStatus('SCANNING');
        setError(null);

        try {
            const endpoint = companyProspectId
                ? `/api/companies/${companyProspectId}/web-health/scan`
                : `/api/scan/website`;

            const body = companyProspectId
                ? { force: true }
                : { leadId, companyProspectId };

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Scan failed');
            }

            // Get the fresh data from scan response
            const data = await res.json();
            setReportData({
                score: data.score,
                factors: data.factors || [],
                statusLabel: data.label || 'Unknown'
            });

            setScanStatus('SCANNED');
            router.refresh();
        } catch (e: any) {
            console.error('[WebsiteReviewCard] Scan error:', e);
            setError(e.message || 'Scan failed');
            setScanStatus('FAILED');
        }
    };

    return (
        <>
            <div
                className="rounded-xl border bg-white shadow-sm"
                style={{ borderColor: 'var(--border-soft)' }}
            >
                {/* Header */}
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center bg-indigo-50">
                            <Globe size={14} className="text-indigo-600" />
                        </div>
                        <h3 className="text-sm font-semibold text-gray-900">Website Review</h3>
                    </div>
                    {hasValidData ? (
                        <button
                            onClick={handleViewReport}
                            className="text-xs font-medium text-indigo-600 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
                        >
                            View report
                        </button>
                    ) : scanStatus === 'UNSCANNED' ? (
                        <button
                            onClick={handleScan}
                            className="text-xs font-medium text-indigo-600 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
                        >
                            Run scan
                        </button>
                    ) : null}
                </div>

                {/* Content */}
                <div className="p-4">
                    {/* UNSCANNED state */}
                    {scanStatus === 'UNSCANNED' && (
                        <div className="text-center py-4">
                            <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                                <Globe size={20} className="text-gray-400" />
                            </div>
                            <p className="text-sm text-gray-500">Not scanned yet</p>
                            <p className="text-xs text-gray-400 mt-1">Run scan to generate score & breakdown.</p>
                        </div>
                    )}

                    {/* SCANNING state */}
                    {scanStatus === 'SCANNING' && (
                        <div className="text-center py-4">
                            <Loader2 size={24} className="mx-auto mb-3 text-indigo-600 animate-spin" />
                            <p className="text-sm font-medium text-gray-700">Scanning website...</p>
                            <p className="text-xs text-gray-400 mt-1">Analyzing design, trust signals, and technical factors</p>
                        </div>
                    )}

                    {/* FAILED state */}
                    {scanStatus === 'FAILED' && (
                        <div className="text-center py-4">
                            <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-red-100 flex items-center justify-center">
                                <AlertCircle size={20} className="text-red-500" />
                            </div>
                            <p className="text-sm text-red-600 mb-1">Scan failed</p>
                            {error && <p className="text-xs text-gray-400 mb-3">{error}</p>}
                            <button
                                onClick={handleScan}
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition"
                            >
                                <RefreshCw size={14} />
                                Retry Scan
                            </button>
                        </div>
                    )}

                    {/* SCANNED state */}
                    {scanStatus === 'SCANNED' && hasValidData && (
                        <div className="space-y-3">
                            {/* Score */}
                            <ScoreDisplay score={displayScore} showTooltip={true} size="small" />

                            {/* Quick preview of factors */}
                            {displayFactors.filter(f => f.points !== 0).slice(0, 3).map((factor, idx) => (
                                <div key={factor.id || idx} className="flex items-center justify-between text-xs py-0.5">
                                    <span className="text-gray-600 truncate flex-1 mr-2">{factor.label}</span>
                                    <span
                                        className="font-medium flex-shrink-0"
                                        style={{ color: factor.points > 0 ? 'rgb(22, 163, 74)' : 'rgb(220, 38, 38)' }}
                                    >
                                        {factor.points > 0 ? '+' : ''}{factor.points}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Edge case: SCANNED but no valid data */}
                    {scanStatus === 'SCANNED' && !hasValidData && (
                        <div className="text-center py-4">
                            <p className="text-sm text-gray-500">Insufficient data to produce a score.</p>
                            <p className="text-xs text-gray-400 mt-1 mb-3">Try rescanning to gather more signals.</p>
                            <button
                                onClick={handleScan}
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition"
                            >
                                <RefreshCw size={14} />
                                Rescan
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Report Modal */}
            <ReportModal
                isOpen={showReport}
                onClose={() => setShowReport(false)}
                title="Website Review Report"
                onRescan={handleScan}
                isScanning={scanStatus === 'SCANNING'}
            >
                <div className="space-y-6">
                    <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-indigo-600 hover:underline">
                        {websiteUrl} <ExternalLink size={12} />
                    </a>

                    {isLoadingReport ? (
                        <div className="text-center py-8">
                            <Loader2 size={24} className="mx-auto mb-3 text-indigo-600 animate-spin" />
                            <p className="text-sm text-gray-500">Loading report...</p>
                        </div>
                    ) : (
                        <>
                            {/* Score with status pill */}
                            <ScoreDisplay score={displayScore} showTooltip={true} />

                            {/* Factors list */}
                            <FactorsList
                                factors={displayFactors}
                                score={displayScore}
                                isPartial={displayFactors.length < 3}
                            />
                        </>
                    )}
                </div>
            </ReportModal>
        </>
    );
}

// Financial Health Card with proper state management
interface FinancialHealthCardProps {
    factors?: Factor[];
    signals?: string[]; // Legacy support
    score?: number | null;
    band?: string;
    leadId?: number;
    companyProspectId?: number | null;
}

export function FinancialHealthCard({ factors = [], signals = [], score, band, leadId, companyProspectId }: FinancialHealthCardProps) {
    const [showReport, setShowReport] = useState(false);
    const [scanStatus, setScanStatus] = useState<ScanStatus>(
        (score !== undefined && score !== null) || factors.length > 0 || signals.length > 0 ? 'SCANNED' : 'UNSCANNED'
    );
    const [error, setError] = useState<string | null>(null);
    const [reportData, setReportData] = useState<{
        score: number | null;
        factors: Factor[];
        statusLabel: string;
    } | null>(null);
    const [isLoadingReport, setIsLoadingReport] = useState(false);
    const router = useRouter();

    // Initial display factors from props
    const initialFactors: Factor[] = factors.length > 0 ? factors : signals.map((s, i) => ({
        id: `signal-${i}`,
        label: s,
        points: 0,
        polarity: 'positive' as const
    }));

    // Use fetched report data if available, otherwise use props
    const displayScore = reportData?.score ?? score ?? null;
    const displayFactors = reportData?.factors ?? initialFactors;

    // Determine if we have valid scan data
    const hasValidData = scanStatus === 'SCANNED' && (displayScore !== null);

    // Fetch report data from API when opening modal
    const fetchReportData = async () => {
        if (!companyProspectId) return;

        setIsLoadingReport(true);
        try {
            const res = await fetch(`/api/companies/${companyProspectId}/financials/sync`);
            if (res.ok) {
                const data = await res.json();
                setReportData({
                    score: data.score,
                    factors: data.factors || [],
                    statusLabel: data.statusLabel || 'Unknown'
                });
                if (data.score !== null && data.score !== undefined) {
                    setScanStatus('SCANNED');
                }
            }
        } catch (e) {
            console.error('[FinancialHealthCard] Failed to fetch report:', e);
        } finally {
            setIsLoadingReport(false);
        }
    };

    const handleViewReport = async () => {
        setShowReport(true);
        // Fetch fresh data from API
        if (companyProspectId) {
            await fetchReportData();
        }
    };

    const handleScan = async () => {
        if (!companyProspectId && !leadId) return;

        setScanStatus('SCANNING');
        setError(null);

        try {
            const endpoint = companyProspectId
                ? `/api/companies/${companyProspectId}/financials/sync`
                : `/api/scan/financials`;

            const body = companyProspectId
                ? { force: true }
                : { leadId, companyProspectId };

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Scan failed');
            }

            // Get the fresh data from scan response
            const data = await res.json();
            setReportData({
                score: data.score,
                factors: data.factors || [],
                statusLabel: data.band || 'Unknown'
            });

            setScanStatus('SCANNED');
            router.refresh();
        } catch (e: any) {
            console.error('[FinancialHealthCard] Scan error:', e);
            setError(e.message || 'Scan failed');
            setScanStatus('FAILED');
        }
    };

    return (
        <>
            <div
                className="rounded-xl border bg-white shadow-sm"
                style={{ borderColor: 'var(--border-soft)' }}
            >
                {/* Header */}
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center bg-emerald-50">
                            <TrendingUp size={14} className="text-emerald-600" />
                        </div>
                        <h3 className="text-sm font-semibold text-gray-900">Financial Health</h3>
                    </div>
                    {hasValidData ? (
                        <button
                            onClick={handleViewReport}
                            className="text-xs font-medium text-indigo-600 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
                        >
                            View report
                        </button>
                    ) : scanStatus === 'UNSCANNED' ? (
                        <button
                            onClick={handleScan}
                            className="text-xs font-medium text-indigo-600 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
                        >
                            Run scan
                        </button>
                    ) : null}
                </div>

                {/* Content */}
                <div className="p-4">
                    {/* UNSCANNED state */}
                    {scanStatus === 'UNSCANNED' && (
                        <div className="text-center py-4">
                            <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                                <TrendingUp size={20} className="text-gray-400" />
                            </div>
                            <p className="text-sm text-gray-500">Not scanned yet</p>
                            <p className="text-xs text-gray-400 mt-1">Run scan to generate score & breakdown.</p>
                        </div>
                    )}

                    {/* SCANNING state */}
                    {scanStatus === 'SCANNING' && (
                        <div className="text-center py-4">
                            <Loader2 size={24} className="mx-auto mb-3 text-emerald-600 animate-spin" />
                            <p className="text-sm font-medium text-gray-700">Scanning financials...</p>
                            <p className="text-xs text-gray-400 mt-1">Analyzing Companies House filings</p>
                        </div>
                    )}

                    {/* FAILED state */}
                    {scanStatus === 'FAILED' && (
                        <div className="text-center py-4">
                            <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-red-100 flex items-center justify-center">
                                <AlertCircle size={20} className="text-red-500" />
                            </div>
                            <p className="text-sm text-red-600 mb-1">Scan failed</p>
                            {error && <p className="text-xs text-gray-400 mb-3">{error}</p>}
                            <button
                                onClick={handleScan}
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition"
                            >
                                <RefreshCw size={14} />
                                Retry Scan
                            </button>
                        </div>
                    )}

                    {/* SCANNED state */}
                    {scanStatus === 'SCANNED' && hasValidData && (
                        <div className="space-y-3">
                            {/* Score */}
                            <ScoreDisplay score={displayScore} showTooltip={true} size="small" />

                            {/* Quick preview of factors */}
                            {displayFactors.filter(f => f.points !== 0).slice(0, 3).map((factor, idx) => (
                                <div key={factor.id || idx} className="flex items-center justify-between text-xs py-0.5">
                                    <span className="text-gray-600 truncate flex-1 mr-2">{factor.label}</span>
                                    <span
                                        className="font-medium flex-shrink-0"
                                        style={{ color: factor.points > 0 ? 'rgb(22, 163, 74)' : 'rgb(220, 38, 38)' }}
                                    >
                                        {factor.points > 0 ? '+' : ''}{factor.points}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Edge case: SCANNED but no valid data */}
                    {scanStatus === 'SCANNED' && !hasValidData && (
                        <div className="text-center py-4">
                            <p className="text-sm text-gray-500">Insufficient data to produce a score.</p>
                            <p className="text-xs text-gray-400 mt-1 mb-3">Try rescanning to gather more signals.</p>
                            <button
                                onClick={handleScan}
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition"
                            >
                                <RefreshCw size={14} />
                                Rescan
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Report Modal */}
            <ReportModal
                isOpen={showReport}
                onClose={() => setShowReport(false)}
                title="Financial Health Report"
                onRescan={handleScan}
                isScanning={scanStatus === 'SCANNING'}
            >
                <div className="space-y-6">
                    {isLoadingReport ? (
                        <div className="text-center py-8">
                            <Loader2 size={24} className="mx-auto mb-3 text-emerald-600 animate-spin" />
                            <p className="text-sm text-gray-500">Loading report...</p>
                        </div>
                    ) : (
                        <>
                            {/* Score with status pill */}
                            <ScoreDisplay score={displayScore} showTooltip={true} />

                            {/* Factors list */}
                            <FactorsList
                                factors={displayFactors}
                                score={displayScore}
                                isPartial={displayFactors.length < 3}
                            />
                        </>
                    )}
                </div>
            </ReportModal>
        </>
    );
}
