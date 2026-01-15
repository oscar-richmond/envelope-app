'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, RefreshCw, Target, CheckCircle, AlertCircle, AlertTriangle, Loader2 } from 'lucide-react';

/**
 * PriorityBreakdownModal - Unified modal for Lead Opportunity / Priority breakdown
 * 
 * This component fetches its own data from the API, ensuring consistent
 * behavior regardless of where it's opened from.
 */

interface Factor {
    id?: string;
    label: string;
    points: number;
    polarity?: 'positive' | 'negative' | 'neutral';
    description?: string;
    category?: string;
}

interface PriorityData {
    score: number | null;
    statusLabel: string;
    factors: Factor[];
    lastScannedAt?: string;
    scanStatus: 'not_scanned' | 'scanning' | 'complete' | 'failed';
    scanError?: string;
}

interface PriorityBreakdownModalProps {
    isOpen: boolean;
    onClose: () => void;
    companyId: number;
    companyName?: string;
    onDataUpdated?: () => void;
}

export default function PriorityBreakdownModal({
    isOpen,
    onClose,
    companyId,
    companyName,
    onDataUpdated
}: PriorityBreakdownModalProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<PriorityData | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Fetch data from API on open
    const fetchData = useCallback(async () => {
        if (!companyId) return;

        setIsLoading(true);
        setError(null);

        try {
            // Fetch both web health and financial health to compute priority
            const [webRes, finRes] = await Promise.all([
                fetch(`/api/companies/${companyId}/web-health/scan`),
                fetch(`/api/companies/${companyId}/financials/sync`)
            ]);

            const webData = webRes.ok ? await webRes.json() : null;
            const finData = finRes.ok ? await finRes.json() : null;

            // Compute priority breakdown from web + financial signals
            const factors: Factor[] = [];
            let totalScore = 50; // Base score

            // Add web health factors
            if (webData?.score !== null && webData?.score !== undefined) {
                const webHealthGood = webData.score < 40;
                factors.push({
                    id: 'web-health',
                    label: webHealthGood ? 'Website is healthy' : 'Website may need attention',
                    points: webHealthGood ? 15 : -10,
                    polarity: webHealthGood ? 'positive' : 'negative',
                    description: `Staleness score: ${webData.score}`
                });
                totalScore += webHealthGood ? 15 : -10;
            }

            // Add financial health factors
            if (finData?.score !== null && finData?.score !== undefined) {
                const finHealthGood = finData.score >= 60;
                factors.push({
                    id: 'fin-health',
                    label: finHealthGood ? 'Financial health is strong' : 'Financial health needs review',
                    points: finHealthGood ? 20 : -5,
                    polarity: finHealthGood ? 'positive' : 'negative',
                    description: `Financial score: ${finData.score}`
                });
                totalScore += finHealthGood ? 20 : -5;
            }

            // Add confidence bonus if we have both scans
            if (webData && finData) {
                factors.push({
                    id: 'complete-data',
                    label: 'Complete data available',
                    points: 10,
                    polarity: 'positive',
                    description: 'Both website and financial analysis completed'
                });
                totalScore += 10;
            }

            // Clamp score
            totalScore = Math.max(0, Math.min(100, totalScore));

            // Determine status
            let statusLabel = 'Medium';
            if (totalScore >= 70) statusLabel = 'High';
            else if (totalScore < 40) statusLabel = 'Low';

            setData({
                score: factors.length > 0 ? totalScore : null,
                statusLabel,
                factors,
                scanStatus: factors.length > 0 ? 'complete' : 'not_scanned'
            });
        } catch (e: any) {
            console.error('[PriorityBreakdownModal] Fetch error:', e);
            setError(e.message || 'Failed to load priority breakdown');
        } finally {
            setIsLoading(false);
        }
    }, [companyId]);

    // Fetch on open
    useEffect(() => {
        if (isOpen && companyId) {
            fetchData();
        }
    }, [isOpen, companyId, fetchData]);

    if (!isOpen) return null;

    const getScoreColor = (score: number | null): string => {
        if (score == null) return 'text-gray-500';
        if (score >= 70) return 'text-purple-600';
        if (score >= 40) return 'text-amber-600';
        return 'text-gray-600';
    };

    const getScoreBgColor = (score: number | null): string => {
        if (score == null) return 'bg-gray-100';
        if (score >= 70) return 'bg-purple-50';
        if (score >= 40) return 'bg-amber-50';
        return 'bg-gray-100';
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
                            <Target size={20} style={{ color: 'var(--accent-lilac-text)' }} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                                Lead Opportunity
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
                            <p style={{ color: 'var(--text-muted)' }}>Loading priority breakdown...</p>
                        </div>
                    ) : error ? (
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
                                <Target size={24} className="text-gray-400" />
                            </div>
                            <div>
                                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                                    No analysis available yet
                                </p>
                                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                                    Run website and financial scans to compute lead priority
                                </p>
                            </div>
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
                                        {data?.statusLabel || 'Priority Score'}
                                    </div>
                                </div>
                            </div>

                            {/* Factors List */}
                            {data?.factors && data.factors.length > 0 ? (
                                <div className="space-y-2">
                                    <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                                        Breakdown ({data.factors.length} factors)
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
                                    No breakdown factors available
                                </p>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
