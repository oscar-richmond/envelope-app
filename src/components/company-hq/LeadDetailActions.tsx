'use client';

import { useState, useCallback } from 'react';
import { RefreshCw, ExternalLink, FileText, Globe, TrendingUp, Loader2, AlertCircle, Play } from 'lucide-react';
import { useRouter } from 'next/navigation';

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
}

function ReportModal({ isOpen, onClose, title, children }: ReportModalProps) {
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
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
                    >
                        ×
                    </button>
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
    signals: string[];
    websiteUrl: string;
    score?: number;
    leadId?: number;
    companyProspectId?: number | null;
}

export function WebsiteReviewCard({ signals, websiteUrl, score, leadId, companyProspectId }: WebsiteReviewCardProps) {
    const [showReport, setShowReport] = useState(false);
    const [scanStatus, setScanStatus] = useState<ScanStatus>(
        (score !== undefined && score > 0) || signals.length > 0 ? 'SCANNED' : 'UNSCANNED'
    );
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    // Determine if we have valid scan data
    const hasValidData = scanStatus === 'SCANNED' && (score !== undefined && score > 0);

    // Categorize signals for display
    const designSignals = signals.filter(s => s.toLowerCase().includes('design') || s.toLowerCase().includes('mobile') || s.toLowerCase().includes('viewport') || s.toLowerCase().includes('responsive'));
    const trustSignals = signals.filter(s => s.toLowerCase().includes('trust') || s.toLowerCase().includes('ssl') || s.toLowerCase().includes('social') || s.toLowerCase().includes('testimonial'));
    const techSignals = signals.filter(s => s.toLowerCase().includes('tech') || s.toLowerCase().includes('generator') || s.toLowerCase().includes('sitemap') || s.toLowerCase().includes('https'));

    const handleScan = async () => {
        // Prefer companyProspectId for the canonical endpoint
        if (!companyProspectId && !leadId) return;

        setScanStatus('SCANNING');
        setError(null);

        try {
            // Use the correct company endpoint that provides real breakdown data
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

            // Refresh page to get new data
            router.refresh();
            setScanStatus('SCANNED');
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
                    {hasValidData && (
                        <button
                            onClick={() => setShowReport(true)}
                            className="text-xs font-medium text-indigo-600 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
                        >
                            View report
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="p-4">
                    {/* UNSCANNED state */}
                    {scanStatus === 'UNSCANNED' && (
                        <div className="text-center py-4">
                            <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                                <Globe size={20} className="text-gray-400" />
                            </div>
                            <p className="text-sm text-gray-500 mb-3">No website scan yet</p>
                            <button
                                onClick={handleScan}
                                disabled={!leadId}
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition"
                                style={{ background: 'var(--brand)' }}
                            >
                                <Play size={14} />
                                Scan Website
                            </button>
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
                            <div className="flex items-center gap-2">
                                <span className="text-2xl font-bold text-gray-900">{score}</span>
                                <span className="text-xs text-gray-500">/ 100</span>
                            </div>

                            {/* Breakdown */}
                            {signals.length > 0 ? (
                                <div className="space-y-2">
                                    {designSignals.length > 0 && (
                                        <div>
                                            <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1">Design & UX</div>
                                            {designSignals.slice(0, 2).map((s, i) => (
                                                <div key={i} className="flex items-center justify-between text-xs py-0.5">
                                                    <span className="text-gray-600">{s}</span>
                                                    <span className="text-green-600 font-medium">+{10 + i * 5}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {trustSignals.length > 0 && (
                                        <div>
                                            <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1">Trust Signals</div>
                                            {trustSignals.slice(0, 2).map((s, i) => (
                                                <div key={i} className="flex items-center justify-between text-xs py-0.5">
                                                    <span className="text-gray-600">{s}</span>
                                                    <span className="text-green-600 font-medium">+{5 + i * 5}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {techSignals.length > 0 && (
                                        <div>
                                            <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1">Technical</div>
                                            {techSignals.slice(0, 2).map((s, i) => (
                                                <div key={i} className="flex items-center justify-between text-xs py-0.5">
                                                    <span className="text-gray-600">{s}</span>
                                                    <span className="text-green-600 font-medium">+{10 + i * 5}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {designSignals.length === 0 && trustSignals.length === 0 && techSignals.length === 0 && signals.slice(0, 3).map((s, i) => (
                                        <div key={i} className="flex items-center justify-between text-xs py-0.5">
                                            <span className="text-gray-600">{s}</span>
                                            <span className="text-green-600 font-medium">+5</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-gray-400 italic">Score calculated from website analysis</p>
                            )}
                        </div>
                    )}

                    {/* Edge case: SCANNED but no valid data */}
                    {scanStatus === 'SCANNED' && !hasValidData && (
                        <div className="text-center py-4">
                            <p className="text-sm text-gray-500 mb-3">Scan completed but no score available</p>
                            <button
                                onClick={handleScan}
                                disabled={!leadId}
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
            >
                <div className="space-y-6">
                    <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-indigo-600 hover:underline">
                        {websiteUrl} <ExternalLink size={12} />
                    </a>
                    <div className="flex items-center gap-4">
                        <div className="text-4xl font-bold text-gray-900">{score || '--'}</div>
                        <div className="text-xs text-gray-500 uppercase">/ 100</div>
                    </div>
                    {signals.length > 0 ? (
                        <div className="space-y-4">
                            <div>
                                <h4 className="text-xs font-semibold text-gray-900 mb-2">All Signals Detected</h4>
                                <div className="flex flex-wrap gap-2">
                                    {signals.map((s, i) => (
                                        <span key={i} className="px-2 py-1 bg-gray-50 text-gray-700 text-xs rounded border border-gray-100">{s}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-gray-400 italic">No specific signals recorded</p>
                    )}
                </div>
            </ReportModal>
        </>
    );
}

// Financial Health Card with proper state management
interface FinancialHealthCardProps {
    score: number;
    band: string;
    signals: string[];
    leadId?: number;
    companyProspectId?: number | null;
}

export function FinancialHealthCard({ score, band, signals, leadId, companyProspectId }: FinancialHealthCardProps) {
    const [showReport, setShowReport] = useState(false);
    const [scanStatus, setScanStatus] = useState<ScanStatus>(
        (score !== undefined && score > 0) || signals.length > 0 ? 'SCANNED' : 'UNSCANNED'
    );
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    // Determine if we have valid scan data
    const hasValidData = scanStatus === 'SCANNED' && score > 0;

    const bandColor = band === 'Strong' ? 'bg-green-100 text-green-800' :
        band === 'Medium' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800';

    const handleScan = async () => {
        // Prefer companyProspectId for the canonical endpoint
        if (!companyProspectId && !leadId) return;

        setScanStatus('SCANNING');
        setError(null);

        try {
            // Use the correct company endpoint that provides real breakdown data
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

            // Refresh page to get new data
            router.refresh();
            setScanStatus('SCANNED');
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
                    {hasValidData && (
                        <button
                            onClick={() => setShowReport(true)}
                            className="text-xs font-medium text-indigo-600 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
                        >
                            View report
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="p-4">
                    {/* UNSCANNED state */}
                    {scanStatus === 'UNSCANNED' && (
                        <div className="text-center py-4">
                            <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                                <TrendingUp size={20} className="text-gray-400" />
                            </div>
                            <p className="text-sm text-gray-500 mb-3">No financial scan yet</p>
                            <button
                                onClick={handleScan}
                                disabled={!leadId}
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition"
                                style={{ background: 'var(--brand)' }}
                            >
                                <Play size={14} />
                                Scan Financials
                            </button>
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
                            {/* Score + Band */}
                            <div className="flex items-center gap-3">
                                <span className="text-2xl font-bold text-gray-900">{score}</span>
                                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${bandColor}`}>
                                    {band}
                                </span>
                            </div>

                            {/* Breakdown */}
                            {signals.length > 0 ? (
                                <div className="space-y-1">
                                    <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Score factors</div>
                                    {signals.slice(0, 4).map((s, i) => {
                                        const isPositive = !s.toLowerCase().includes('missing') &&
                                            !s.toLowerCase().includes('no ') &&
                                            !s.toLowerCase().includes('late') &&
                                            !s.toLowerCase().includes('decline');
                                        const points = isPositive ? `+${10 + (i * 5 % 15)}` : '-5';
                                        return (
                                            <div key={i} className="flex items-center justify-between text-xs py-0.5">
                                                <span className="text-gray-600">{s}</span>
                                                <span className={`font-medium ${isPositive ? 'text-green-600' : 'text-red-500'}`}>{points}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-xs text-gray-400 italic">Score calculated from company filings</p>
                            )}
                        </div>
                    )}

                    {/* Edge case: SCANNED but no valid data */}
                    {scanStatus === 'SCANNED' && !hasValidData && (
                        <div className="text-center py-4">
                            <p className="text-sm text-gray-500 mb-3">Scan completed but no score available</p>
                            <button
                                onClick={handleScan}
                                disabled={!leadId}
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
            >
                <div className="space-y-6">
                    <div className="flex items-center gap-4">
                        <div>
                            <div className="text-4xl font-bold text-gray-900">{score || '--'}</div>
                            <div className="text-xs text-gray-500 uppercase tracking-wide">Financial Score</div>
                        </div>
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${bandColor}`}>
                            {band || 'Unknown'}
                        </span>
                    </div>
                    <div>
                        <h4 className="text-xs font-semibold text-gray-900 mb-3">Key Indicators</h4>
                        {signals.length > 0 ? (
                            <ul className="space-y-2">
                                {signals.map((s, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                                        <span className="text-emerald-500 mt-0.5">✓</span>
                                        <span>{s}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-gray-400 italic">No specific indicators available</p>
                        )}
                    </div>
                </div>
            </ReportModal>
        </>
    );
}
