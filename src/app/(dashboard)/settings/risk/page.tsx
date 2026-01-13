'use client';

/**
 * Phase 8: Risk Dashboard Page
 * Deliverability metrics and throttle status
 */

import React, { useState, useEffect, useCallback } from 'react';

interface DeliverabilityData {
    stats: {
        todaySent: number;
        hourSent: number;
        totalSent: number;
        bounceCount: number;
        replyCount: number;
        spamWarnings: number;
        lastSentAt: string | null;
    };
    throttle: {
        canSend: boolean;
        reason?: string;
        nextAvailableAt?: string;
        limits: {
            maxPerDay: number;
            maxPerHour: number;
        };
    };
    risk: {
        level: 'healthy' | 'warning' | 'critical' | 'paused';
        isPaused: boolean;
        pauseReason?: string;
        bounceRate: number;
        replyRate: number;
        verificationPassRate: number;
        recommendations: string[];
    };
}

export default function RiskDashboardPage() {
    const [data, setData] = useState<DeliverabilityData | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch('/api/deliverability');
            const result = await res.json();
            if (result.success) {
                setData(result);
            }
        } catch (err) {
            console.error('Failed to fetch deliverability data:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        // Refresh every 30 seconds
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [fetchData]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-slate-500">Loading risk metrics...</div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-red-500">Failed to load data</div>
            </div>
        );
    }

    const riskColors = {
        healthy: 'bg-green-500',
        warning: 'bg-amber-500',
        critical: 'bg-red-500',
        paused: 'bg-slate-500',
    };

    const riskBgColors = {
        healthy: 'bg-green-50 border-green-200',
        warning: 'bg-amber-50 border-amber-200',
        critical: 'bg-red-50 border-red-200',
        paused: 'bg-slate-50 border-slate-200',
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-slate-900">Deliverability & Risk</h1>
                    <p className="text-slate-500">Monitor sending health and throttle status</p>
                </div>

                {/* Risk Status Banner */}
                <div className={`p-6 rounded-2xl border mb-6 ${riskBgColors[data.risk.level]}`}>
                    <div className="flex items-center gap-4">
                        <div className={`w-4 h-4 rounded-full ${riskColors[data.risk.level]}`} />
                        <div>
                            <h2 className="text-lg font-bold capitalize">{data.risk.level}</h2>
                            {data.risk.isPaused && (
                                <p className="text-red-600 font-medium">{data.risk.pauseReason}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <StatCard
                        label="Today"
                        value={data.stats.todaySent}
                        max={data.throttle.limits.maxPerDay}
                    />
                    <StatCard
                        label="This Hour"
                        value={data.stats.hourSent}
                        max={data.throttle.limits.maxPerHour}
                    />
                    <StatCard
                        label="Total Sent"
                        value={data.stats.totalSent}
                    />
                    <StatCard
                        label="Replies"
                        value={data.stats.replyCount}
                    />
                </div>

                {/* Rate Metrics */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
                    <h3 className="font-bold text-slate-900 mb-4">Rate Metrics</h3>
                    <div className="space-y-4">
                        <RateBar
                            label="Bounce Rate"
                            value={data.risk.bounceRate}
                            threshold={3}
                            suffix="%"
                        />
                        <RateBar
                            label="Reply Rate"
                            value={data.risk.replyRate}
                            isPositive
                            suffix="%"
                        />
                        <RateBar
                            label="Verification Pass"
                            value={data.risk.verificationPassRate}
                            isPositive
                            suffix="%"
                        />
                    </div>
                </div>

                {/* Throttle Status */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
                    <h3 className="font-bold text-slate-900 mb-4">Sending Status</h3>
                    <div className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full ${data.throttle.canSend ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="text-slate-700">
                            {data.throttle.canSend ? 'Ready to send' : data.throttle.reason}
                        </span>
                    </div>
                    {data.throttle.nextAvailableAt && !data.throttle.canSend && (
                        <p className="text-sm text-slate-500 mt-2">
                            Next available: {new Date(data.throttle.nextAvailableAt).toLocaleTimeString()}
                        </p>
                    )}
                </div>

                {/* Recommendations */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6">
                    <h3 className="font-bold text-slate-900 mb-4">Recommendations</h3>
                    <ul className="space-y-2">
                        {data.risk.recommendations.map((rec, i) => (
                            <li key={i} className="flex items-start gap-2">
                                <span className="text-blue-500 mt-1">•</span>
                                <span className="text-slate-700">{rec}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Warnings */}
                {data.stats.spamWarnings > 0 && (
                    <div className="mt-6 bg-red-50 border border-red-200 rounded-2xl p-6">
                        <h3 className="font-bold text-red-800 mb-2">⚠️ Spam Warnings</h3>
                        <p className="text-red-700">
                            {data.stats.spamWarnings} spam warning(s) detected. Review your email content.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

function StatCard({ label, value, max }: { label: string; value: number; max?: number }) {
    const percentage = max ? (value / max) * 100 : 0;
    const isNearLimit = max && percentage >= 80;

    return (
        <div className={`bg-white rounded-xl border p-4 ${isNearLimit ? 'border-amber-300' : 'border-slate-200'}`}>
            <div className="text-sm text-slate-500 mb-1">{label}</div>
            <div className="flex items-end gap-1">
                <span className={`text-2xl font-bold ${isNearLimit ? 'text-amber-600' : 'text-slate-900'}`}>
                    {value}
                </span>
                {max && <span className="text-slate-400 text-sm mb-1">/ {max}</span>}
            </div>
            {max && (
                <div className="mt-2 h-1 bg-slate-100 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full ${isNearLimit ? 'bg-amber-500' : 'bg-blue-500'}`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                </div>
            )}
        </div>
    );
}

function RateBar({
    label,
    value,
    threshold,
    isPositive = false,
    suffix = ''
}: {
    label: string;
    value: number;
    threshold?: number;
    isPositive?: boolean;
    suffix?: string;
}) {
    const isOverThreshold = threshold && value > threshold;
    const color = isPositive
        ? 'bg-green-500'
        : isOverThreshold
            ? 'bg-red-500'
            : 'bg-blue-500';

    return (
        <div>
            <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-600">{label}</span>
                <span className={isOverThreshold ? 'text-red-600 font-medium' : 'text-slate-900'}>
                    {value}{suffix}
                    {threshold && <span className="text-slate-400 ml-1">(max {threshold}%)</span>}
                </span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full ${color}`}
                    style={{ width: `${Math.min(value, 100)}%` }}
                />
            </div>
        </div>
    );
}
