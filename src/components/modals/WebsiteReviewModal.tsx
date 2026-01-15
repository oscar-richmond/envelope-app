'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, RefreshCw, Globe, CheckCircle, AlertCircle, AlertTriangle, Loader2 } from 'lucide-react';

/**
 * WebsiteReviewModal - Unified, self-contained modal for Website Review
 * 
 * This component fetches its own data from the API, ensuring consistent
 * behavior regardless of where it's opened from (Search, Company Overview, Lead Board, etc.)
 * 
 * Single source of truth: GET /api/companies/[companyId]/web-health/scan
 */

interface Factor {
    id?: string;
    label: string;
    points: number;
    polarity?: 'positive' | 'negative' | 'neutral';
    description?: string;
    category?: string;
}

interface WebsiteReviewData {
    score: number | null;
    statusLabel: string;
    factors: Factor[];
    domain?: string;
    canonicalUrl?: string;
    lastScannedAt?: string;
    scanStatus: 'not_scanned' | 'scanning' | 'complete' | 'failed';
    scanError?: string;
}

interface WebsiteReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    companyId: number;
    companyName?: string;
    websiteUrl?: string;
    onDataUpdated?: () => void; // Callback to notify parent when data changes
}

export default function WebsiteReviewModal({
    isOpen,
    onClose,
    companyId,
    companyName,
    websiteUrl,
    onDataUpdated
}: WebsiteReviewModalProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [isScanning, setIsScanning] = useState(false);
    const [data, setData] = useState<WebsiteReviewData | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Fetch data from API on open
    const fetchData = useCallback(async () => {
        if (!companyId) return;

        setIsLoading(true);
        setError(null);

        try {
            const res = await fetch(`/api/companies/${companyId}/web-health/scan`);
            const json = await res.json();

            if (!res.ok) {
                setError(json.error || 'Failed to load website review');
                setData({
                    score: null,
                    statusLabel: 'Error',
                    factors: [],
                    scanStatus: 'failed',
                    scanError: json.error
                });
                return;
            }

            // Map API response to our data structure
            const factors: Factor[] = (json.factors || []).map((f: any) => ({
                id: f.id,
                label: f.label || f.title || '',
                points: f.points || 0,
                polarity: f.polarity || (f.points > 0 ? 'positive' : f.points < 0 ? 'negative' : 'neutral'),
                description: f.description || f.text || '',
                category: f.category
            }));

            // Determine scan status from API response
            // - If API says 'not_scanned', respect that
            // - If there are factors OR a valid score, treat as complete
            // - Otherwise, not_scanned
            let scanStatus: 'not_scanned' | 'scanning' | 'complete' | 'failed' = 'not_scanned';
            if (json.scanState === 'failed') {
                scanStatus = 'failed';
            } else if (json.scanState === 'scanned' || factors.length > 0 || (json.score !== null && json.score !== undefined)) {
                scanStatus = 'complete';
            }

            setData({
                score: json.score ?? null,
                statusLabel: json.statusLabel || getStatusLabel(json.score),
                factors,
                domain: json.domain,
                canonicalUrl: json.url || json.canonicalUrl || json.websiteUrl,
                lastScannedAt: json.lastScanned || json.lastScannedAt || json.scannedAt,
                scanStatus
            });
        } catch (e: any) {
            console.error('[WebsiteReviewModal] Fetch error:', e);
            setError(e.message || 'Failed to load website review');
        } finally {
            setIsLoading(false);
        }
    }, [companyId]);

    // Run scan
    const handleScan = async () => {
        if (!companyId || isScanning) return;

        setIsScanning(true);
        setError(null);

        try {
            const res = await fetch(`/api/companies/${companyId}/web-health/scan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const json = await res.json();

            if (!res.ok) {
                throw new Error(json.error || 'Scan failed');
            }

            // Map response
            const factors: Factor[] = (json.factors || []).map((f: any) => ({
                id: f.id,
                label: f.label || f.title || '',
                points: f.points || 0,
                polarity: f.polarity || (f.points > 0 ? 'positive' : f.points < 0 ? 'negative' : 'neutral'),
                description: f.description || f.text || '',
                category: f.category
            }));

            setData({
                score: json.score ?? null,
                statusLabel: json.statusLabel || getStatusLabel(json.score),
                factors,
                domain: json.domain,
                canonicalUrl: json.canonicalUrl || json.websiteUrl,
                lastScannedAt: new Date().toISOString(),
                scanStatus: 'complete'
            });

            onDataUpdated?.();
        } catch (e: any) {
            console.error('[WebsiteReviewModal] Scan error:', e);
            setError(e.message || 'Scan failed');
        } finally {
            setIsScanning(false);
        }
    };

    // Fetch on open
    useEffect(() => {
        if (isOpen && companyId) {
            fetchData();
        }
    }, [isOpen, companyId, fetchData]);

    if (!isOpen) return null;

    const getStatusLabel = (score: number | null | undefined): string => {
        if (score == null) return 'Not Scanned';
        if (score >= 60) return 'Outdated';
        if (score >= 30) return 'Aging';
        return 'Fresh';
    };

    const getScoreColor = (score: number | null): string => {
        if (score == null) return 'text-gray-500';
        if (score >= 60) return 'text-rose-600';
        if (score >= 30) return 'text-amber-600';
        return 'text-emerald-600';
    };

    const getScoreBgColor = (score: number | null): string => {
        if (score == null) return 'bg-gray-100';
        if (score >= 60) return 'bg-rose-50';
        if (score >= 30) return 'bg-amber-50';
        return 'bg-emerald-50';
    };

    const getPointsColor = (points: number): string => {
        if (points > 0) return 'text-emerald-600 bg-emerald-50';
        if (points < 0) return 'text-rose-600 bg-rose-50';
        return 'text-gray-600 bg-gray-100';
    };

    const getPointsIcon = (points: number) => {
        if (points > 10) return <CheckCircle size={14} className="text-emerald-500" />;
        if (points > 0) return <AlertCircle size={14} className="text-amber-500" />;
        return <AlertTriangle size={14} className="text-gray-400" />;
    };

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

            {/* Modal */}
            <div
                className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--border-soft)' }}>
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl" style={{ background: 'var(--accent-lilac-bg)' }}>
                            <Globe size={20} style={{ color: 'var(--accent-lilac-text)' }} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                                Website Review
                            </h2>
                            {companyName && (
                                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                    {companyName}
                                </p>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg transition-colors hover:bg-gray-100"
                    >
                        <X size={20} style={{ color: 'var(--text-muted)' }} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 overflow-y-auto max-h-[60vh]">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <Loader2 size={32} className="animate-spin" style={{ color: 'var(--brand)' }} />
                            <p style={{ color: 'var(--text-muted)' }}>Loading website review...</p>
                        </div>
                    ) : error && !data ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
                            <div className="p-3 rounded-full bg-rose-50">
                                <AlertTriangle size={24} className="text-rose-500" />
                            </div>
                            <div>
                                <p className="font-medium text-rose-600">Failed to load</p>
                                <p className="text-sm text-gray-500 mt-1">{error}</p>
                            </div>
                            <button
                                onClick={fetchData}
                                className="btn btn-secondary text-sm"
                            >
                                <RefreshCw size={14} /> Retry
                            </button>
                        </div>
                    ) : data?.scanStatus === 'not_scanned' ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
                            <div className="p-3 rounded-full bg-gray-100">
                                <Globe size={24} className="text-gray-400" />
                            </div>
                            <div>
                                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                                    No website analysis available yet
                                </p>
                                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                                    {websiteUrl || 'Run a scan to analyze the website health'}
                                </p>
                            </div>
                            <button
                                onClick={handleScan}
                                disabled={isScanning}
                                className="btn btn-primary"
                            >
                                {isScanning ? (
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
                        </div>
                    ) : (
                        <>
                            {/* Score Display */}
                            <div className={`flex items-center justify-between p-4 rounded-xl mb-4 ${getScoreBgColor(data?.score ?? null)}`}>
                                <div>
                                    <div className={`text-3xl font-black ${getScoreColor(data?.score ?? null)}`}>
                                        {data?.score ?? '—'}
                                    </div>
                                    <div className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                                        {data?.statusLabel || 'Website Health Score'}
                                    </div>
                                </div>
                                {data?.canonicalUrl && (
                                    <a
                                        href={data.canonicalUrl.startsWith('http') ? data.canonicalUrl : `https://${data.canonicalUrl}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
                                        style={{ color: 'var(--brand)', background: 'rgba(84,130,237,0.1)' }}
                                    >
                                        Visit site →
                                    </a>
                                )}
                            </div>

                            {/* Factors List */}
                            {data?.factors && data.factors.length > 0 ? (
                                <div className="space-y-2">
                                    <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                                        Breakdown ({data.factors.length} signals)
                                    </h3>
                                    {data.factors.map((factor, idx) => (
                                        <div
                                            key={factor.id || idx}
                                            className="flex items-start gap-3 p-3 rounded-lg"
                                            style={{ background: 'var(--bg-card-muted)' }}
                                        >
                                            <div className="mt-0.5">
                                                {getPointsIcon(factor.points)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                                    {factor.label}
                                                </p>
                                                {factor.description && (
                                                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                                        {factor.description}
                                                    </p>
                                                )}
                                            </div>
                                            <span className={`text-xs font-bold px-2 py-1 rounded ${getPointsColor(factor.points)}`}>
                                                {factor.points > 0 ? '+' : ''}{factor.points}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center py-6 text-sm" style={{ color: 'var(--text-muted)' }}>
                                    No breakdown signals available
                                </p>
                            )}

                            {/* Last scanned */}
                            {data?.lastScannedAt && (
                                <p className="text-xs text-center mt-4" style={{ color: 'var(--text-muted)' }}>
                                    Last scanned: {new Date(data.lastScannedAt).toLocaleDateString()}
                                </p>
                            )}
                        </>
                    )}
                </div>

                {/* Footer - Rescan CTA */}
                {data?.scanStatus === 'complete' && (
                    <div className="p-4 border-t flex justify-end gap-3" style={{ borderColor: 'var(--border-soft)' }}>
                        <button
                            onClick={handleScan}
                            disabled={isScanning}
                            className="btn btn-secondary text-sm"
                        >
                            {isScanning ? (
                                <>
                                    <Loader2 size={14} className="animate-spin" />
                                    Rescanning...
                                </>
                            ) : (
                                <>
                                    <RefreshCw size={14} />
                                    Rescan
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
