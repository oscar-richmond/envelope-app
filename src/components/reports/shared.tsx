'use client';

import { Info } from 'lucide-react';
import { useState } from 'react';

/**
 * Shared types for report display
 */
export interface Factor {
    id: string;
    label: string;
    points: number;
    polarity: 'positive' | 'negative';
    description?: string;
}

export interface ReportData {
    score: number | null;
    statusLabel: string;
    factors: Factor[];
    confidence?: 'high' | 'medium' | 'low';
    computedAt?: string;
}

/**
 * Get status pill based on score bands
 */
export function getStatusFromScore(score: number | null): {
    label: string;
    color: string;
    bgColor: string;
} {
    if (score === null) {
        return {
            label: 'Not scanned',
            color: 'rgb(107, 114, 128)',
            bgColor: 'rgba(107, 114, 128, 0.1)'
        };
    }

    if (score >= 70) {
        return {
            label: 'Strong',
            color: 'rgb(34, 197, 94)',
            bgColor: 'rgba(34, 197, 94, 0.1)'
        };
    }

    if (score >= 40) {
        return {
            label: 'Medium',
            color: 'rgb(234, 179, 8)',
            bgColor: 'rgba(234, 179, 8, 0.1)'
        };
    }

    return {
        label: 'Needs work',
        color: 'rgb(239, 68, 68)',
        bgColor: 'rgba(239, 68, 68, 0.1)'
    };
}

/**
 * Score display component with optional info tooltip
 */
export function ScoreDisplay({
    score,
    showTooltip = true,
    size = 'normal'
}: {
    score: number | null;
    showTooltip?: boolean;
    size?: 'small' | 'normal' | 'large';
}) {
    const [tooltipOpen, setTooltipOpen] = useState(false);
    const status = getStatusFromScore(score);

    const sizeClasses = {
        small: 'text-2xl',
        normal: 'text-4xl',
        large: 'text-5xl'
    };

    return (
        <div className="flex items-center gap-3">
            {score !== null ? (
                <>
                    <div className={`${sizeClasses[size]} font-bold text-gray-900`}>
                        {score}
                        <span className="text-lg text-gray-400 font-normal">/100</span>
                    </div>
                    <span
                        className="px-2.5 py-1 text-xs font-semibold rounded-full"
                        style={{ color: status.color, background: status.bgColor }}
                    >
                        {status.label}
                    </span>
                </>
            ) : (
                <span
                    className="px-3 py-1.5 text-sm font-medium rounded-lg"
                    style={{ color: status.color, background: status.bgColor }}
                >
                    {status.label}
                </span>
            )}

            {showTooltip && (
                <div className="relative">
                    <button
                        onClick={() => setTooltipOpen(!tooltipOpen)}
                        onMouseEnter={() => setTooltipOpen(true)}
                        onMouseLeave={() => setTooltipOpen(false)}
                        className="p-1 rounded-full hover:bg-gray-100 transition-colors"
                        title="How scoring works"
                    >
                        <Info size={14} className="text-gray-400" />
                    </button>

                    {tooltipOpen && (
                        <div
                            className="absolute z-50 left-0 top-full mt-2 w-64 p-3 rounded-lg shadow-lg text-xs"
                            style={{
                                background: 'rgba(17, 24, 39, 0.95)',
                                color: 'white'
                            }}
                        >
                            <p className="mb-1.5">
                                Scores are calculated from detected signals. Each signal adds or subtracts points.
                            </p>
                            <p className="text-gray-300">
                                Totals are summed and capped at 0–100.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/**
 * Single factor row with consistent formatting
 */
export function FactorRow({ factor }: { factor: Factor }) {
    const isPositive = factor.points > 0;
    const isNegative = factor.points < 0;

    // Don't show zero-point factors
    if (factor.points === 0) return null;

    return (
        <div className="flex items-start justify-between py-2.5 px-3 rounded-lg hover:bg-gray-50 transition-colors">
            <div className="flex-1 min-w-0 pr-4">
                <div className="text-sm font-medium text-gray-900 truncate">
                    {factor.label}
                </div>
                {factor.description && (
                    <div className="text-xs text-gray-500 mt-0.5 truncate">
                        {factor.description}
                    </div>
                )}
            </div>
            <div
                className="flex-shrink-0 px-2 py-0.5 text-xs font-semibold rounded"
                style={{
                    color: isPositive ? 'rgb(22, 163, 74)' : isNegative ? 'rgb(220, 38, 38)' : 'rgb(107, 114, 128)',
                    background: isPositive ? 'rgba(22, 163, 74, 0.1)' : isNegative ? 'rgba(220, 38, 38, 0.1)' : 'rgba(107, 114, 128, 0.1)'
                }}
            >
                {isPositive ? '+' : ''}{factor.points}
            </div>
        </div>
    );
}

/**
 * Factors list with empty state handling
 */
export function FactorsList({
    factors,
    score,
    isPartial = false
}: {
    factors: Factor[];
    score: number | null;
    isPartial?: boolean;
}) {
    // Filter out zero-point factors
    const displayFactors = factors.filter(f => f.points !== 0);

    // Not scanned state
    if (score === null) {
        return (
            <div className="py-6 text-center">
                <p className="text-sm text-gray-500">Not scanned yet</p>
                <p className="text-xs text-gray-400 mt-1">Run scan to generate score & breakdown.</p>
            </div>
        );
    }

    // Scanned but no factors
    if (displayFactors.length === 0) {
        return (
            <div className="py-6 text-center">
                <p className="text-sm text-gray-500">Insufficient data to produce a breakdown.</p>
                <p className="text-xs text-gray-400 mt-1">Try rescanning to gather more signals.</p>
            </div>
        );
    }

    return (
        <div className="space-y-1">
            <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-3 px-3">
                Score Factors
            </h4>
            <div className="space-y-0.5">
                {displayFactors.map((factor, idx) => (
                    <FactorRow key={factor.id || idx} factor={factor} />
                ))}
            </div>
            {isPartial && (
                <p className="text-xs text-gray-400 mt-3 px-3 italic">
                    Some factors may be missing until more data is found.
                </p>
            )}
        </div>
    );
}

/**
 * Status pill component
 */
export function StatusPill({ score }: { score: number | null }) {
    const status = getStatusFromScore(score);

    return (
        <span
            className="px-2.5 py-1 text-xs font-semibold rounded-full"
            style={{ color: status.color, background: status.bgColor }}
        >
            {status.label}
        </span>
    );
}

/**
 * Confidence badge (for low confidence scores)
 */
export function ConfidenceBadge({ confidence }: { confidence?: 'high' | 'medium' | 'low' }) {
    if (!confidence || confidence === 'high') return null;

    return (
        <span
            className="px-1.5 py-0.5 text-[10px] font-medium rounded"
            style={{
                color: 'rgb(107, 114, 128)',
                background: 'rgba(107, 114, 128, 0.1)'
            }}
        >
            Estimate
        </span>
    );
}
