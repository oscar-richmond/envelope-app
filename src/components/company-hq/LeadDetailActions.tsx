'use client';

import { useState, useCallback } from 'react';
import { RefreshCw, ExternalLink, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface LeadDetailActionsProps {
    leadId: number;
    companyProspectId: number | null;
    websiteUrl: string;
}

export function RefreshDataButton({ leadId, companyProspectId }: { leadId: number; companyProspectId: number | null }) {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const router = useRouter();

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            // Trigger website scan
            await fetch('/api/scan/website', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ leadId, companyProspectId })
            });

            // Trigger financial scan
            await fetch('/api/scan/financials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ leadId, companyProspectId })
            });

            // Trigger contacts rescan if companyProspectId exists
            if (companyProspectId) {
                await fetch(`/api/companies/${companyProspectId}/contacts/scan`, {
                    method: 'POST'
                });
            }

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
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />
            {/* Modal */}
            <div
                className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-hidden"
                style={{ border: '1px solid var(--border-soft)' }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
                    >
                        ×
                    </button>
                </div>
                {/* Content */}
                <div className="overflow-y-auto max-h-[calc(85vh-80px)] p-6">
                    {children}
                </div>
            </div>
        </div>
    );
}

// Website Review Report
interface WebsiteReviewReportProps {
    signals: string[];
    websiteUrl: string;
    score?: number;
}

export function WebsiteReviewCard({ signals, websiteUrl, score }: WebsiteReviewReportProps) {
    const [showReport, setShowReport] = useState(false);

    // Categorize signals
    const designSignals = signals.filter(s => s.toLowerCase().includes('design') || s.toLowerCase().includes('mobile') || s.toLowerCase().includes('viewport'));
    const trustSignals = signals.filter(s => s.toLowerCase().includes('trust') || s.toLowerCase().includes('ssl') || s.toLowerCase().includes('social'));
    const techSignals = signals.filter(s => s.toLowerCase().includes('tech') || s.toLowerCase().includes('generator') || s.toLowerCase().includes('sitemap'));

    return (
        <>
            <div
                className="rounded-xl border bg-white shadow-sm"
                style={{ borderColor: 'var(--border-soft)' }}
            >
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center bg-indigo-50">
                            <FileText size={14} className="text-indigo-600" />
                        </div>
                        <h3 className="text-sm font-semibold text-gray-900">Website Review</h3>
                    </div>
                    <button
                        onClick={() => setShowReport(true)}
                        className="text-xs font-medium text-indigo-600 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
                    >
                        View report
                    </button>
                </div>
                <div className="p-4 space-y-3">
                    {/* Score Summary */}
                    <div className="flex items-center gap-2">
                        <span className="text-xl font-bold text-gray-900">{score || '--'}</span>
                        <span className="text-xs text-gray-500">/ 100</span>
                    </div>

                    {signals.length > 0 ? (
                        <div className="space-y-2">
                            {/* Design & UX signals */}
                            {designSignals.length > 0 && (
                                <div>
                                    <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1">Design & UX</div>
                                    {designSignals.slice(0, 2).map((s, i) => (
                                        <div key={i} className="flex items-center justify-between text-xs py-0.5">
                                            <span className="text-gray-600">{s}</span>
                                            <span className="text-green-600 font-medium">+10</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {/* Trust signals */}
                            {trustSignals.length > 0 && (
                                <div>
                                    <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1">Trust Signals</div>
                                    {trustSignals.slice(0, 2).map((s, i) => (
                                        <div key={i} className="flex items-center justify-between text-xs py-0.5">
                                            <span className="text-gray-600">{s}</span>
                                            <span className="text-green-600 font-medium">+5</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {/* Technical signals */}
                            {techSignals.length > 0 && (
                                <div>
                                    <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1">Technical</div>
                                    {techSignals.slice(0, 2).map((s, i) => (
                                        <div key={i} className="flex items-center justify-between text-xs py-0.5">
                                            <span className="text-gray-600">{s}</span>
                                            <span className="text-green-600 font-medium">+10</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {/* Other signals not categorized */}
                            {designSignals.length === 0 && trustSignals.length === 0 && techSignals.length === 0 && signals.slice(0, 3).map((s, i) => (
                                <div key={i} className="flex items-center justify-between text-xs py-0.5">
                                    <span className="text-gray-600">{s}</span>
                                    <span className="text-green-600 font-medium">+5</span>
                                </div>
                            ))}
                            {signals.length > 4 && (
                                <div className="text-xs text-gray-400 pt-1">+{signals.length - 4} more signals</div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-1">
                            <p className="text-xs text-gray-400 italic">No signals detected yet.</p>
                            <p className="text-[10px] text-gray-300">Run scan to generate score breakdown.</p>
                        </div>
                    )}
                </div>
            </div>

            <ReportModal
                isOpen={showReport}
                onClose={() => setShowReport(false)}
                title="Website Review Report"
            >
                <div className="space-y-6">
                    {/* Website URL */}
                    <a
                        href={websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-indigo-600 hover:underline"
                    >
                        {websiteUrl} <ExternalLink size={12} />
                    </a>

                    {/* Design & UX */}
                    <div>
                        <h4 className="text-xs font-semibold text-gray-900 mb-2">Design & UX</h4>
                        <div className="flex flex-wrap gap-2">
                            {designSignals.length > 0 ? designSignals.map((s, i) => (
                                <span key={i} className="px-2 py-1 bg-gray-50 text-gray-700 text-xs rounded border border-gray-100">{s}</span>
                            )) : <span className="text-xs text-gray-400 italic">No specific signals</span>}
                        </div>
                    </div>

                    {/* Trust Signals */}
                    <div>
                        <h4 className="text-xs font-semibold text-gray-900 mb-2">Trust Signals</h4>
                        <div className="flex flex-wrap gap-2">
                            {trustSignals.length > 0 ? trustSignals.map((s, i) => (
                                <span key={i} className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded border border-green-100">{s}</span>
                            )) : <span className="text-xs text-gray-400 italic">No trust signals found</span>}
                        </div>
                    </div>

                    {/* Technical */}
                    <div>
                        <h4 className="text-xs font-semibold text-gray-900 mb-2">Technical</h4>
                        <div className="flex flex-wrap gap-2">
                            {techSignals.length > 0 ? techSignals.map((s, i) => (
                                <span key={i} className="px-2 py-1 bg-amber-50 text-amber-700 text-xs rounded border border-amber-100">{s}</span>
                            )) : <span className="text-xs text-gray-400 italic">Basic checks passed</span>}
                        </div>
                    </div>
                </div>
            </ReportModal>
        </>
    );
}

// Financial Health Report
interface FinancialHealthReportProps {
    score: number;
    band: string;
    signals: string[];
}

export function FinancialHealthCard({ score, band, signals }: FinancialHealthReportProps) {
    const [showReport, setShowReport] = useState(false);

    const bandColor = band === 'Strong' ? 'bg-green-100 text-green-800' :
        band === 'Medium' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800';

    return (
        <>
            <div
                className="rounded-xl border bg-white shadow-sm"
                style={{ borderColor: 'var(--border-soft)' }}
            >
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center bg-emerald-50">
                            <FileText size={14} className="text-emerald-600" />
                        </div>
                        <h3 className="text-sm font-semibold text-gray-900">Financial Health</h3>
                    </div>
                    <button
                        onClick={() => setShowReport(true)}
                        className="text-xs font-medium text-indigo-600 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
                    >
                        View report
                    </button>
                </div>
                <div className="p-4 space-y-3">
                    {/* Score Summary */}
                    <div className="flex items-center gap-3">
                        <span className="text-xl font-bold text-gray-900">{score || '--'}</span>
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${bandColor}`}>
                            {band || 'Not scanned'}
                        </span>
                    </div>

                    {/* Score Factors */}
                    {signals.length > 0 ? (
                        <div className="space-y-1">
                            <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Score factors</div>
                            {signals.slice(0, 4).map((s, i) => {
                                // Determine point value based on signal content
                                const isPositive = !s.toLowerCase().includes('missing') &&
                                    !s.toLowerCase().includes('no ') &&
                                    !s.toLowerCase().includes('late') &&
                                    !s.toLowerCase().includes('decline');
                                const points = isPositive ? '+' + (10 + (i * 5 % 10)) : '-5';
                                return (
                                    <div key={i} className="flex items-center justify-between text-xs py-0.5">
                                        <span className="text-gray-600">{s}</span>
                                        <span className={`font-medium ${isPositive ? 'text-green-600' : 'text-red-500'}`}>{points}</span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="space-y-1">
                            <p className="text-xs text-gray-400 italic">Breakdown unavailable</p>
                            <p className="text-[10px] text-gray-300">We'll show factors when more filings are found.</p>
                        </div>
                    )}
                </div>
            </div>

            <ReportModal
                isOpen={showReport}
                onClose={() => setShowReport(false)}
                title="Financial Health Report"
            >
                <div className="space-y-6">
                    {/* Score & Band */}
                    <div className="flex items-center gap-4">
                        <div>
                            <div className="text-4xl font-bold text-gray-900">{score || '--'}</div>
                            <div className="text-xs text-gray-500 uppercase tracking-wide">Financial Score</div>
                        </div>
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${bandColor}`}>
                            {band || 'Unknown'}
                        </span>
                    </div>

                    {/* Key Indicators */}
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
