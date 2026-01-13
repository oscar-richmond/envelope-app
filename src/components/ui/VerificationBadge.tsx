'use client';

/**
 * Phase 5: Verification Badge Component
 * Shows email verification status with appropriate styling
 */

import React from 'react';

interface VerificationBadgeProps {
    status: 'valid' | 'invalid' | 'risky' | 'unknown' | 'pending';
    isCatchAll?: boolean;
    isRoleAccount?: boolean;
    size?: 'sm' | 'md';
    showLabel?: boolean;
}

export function VerificationBadge({
    status,
    isCatchAll,
    isRoleAccount,
    size = 'sm',
    showLabel = true
}: VerificationBadgeProps) {
    const styles = {
        valid: {
            bg: 'bg-green-100',
            text: 'text-green-700',
            icon: '✓',
            label: 'Verified',
        },
        invalid: {
            bg: 'bg-red-100',
            text: 'text-red-700',
            icon: '✗',
            label: 'Invalid',
        },
        risky: {
            bg: 'bg-amber-100',
            text: 'text-amber-700',
            icon: '⚠',
            label: 'Risky',
        },
        unknown: {
            bg: 'bg-slate-100',
            text: 'text-slate-600',
            icon: '?',
            label: 'Unknown',
        },
        pending: {
            bg: 'bg-slate-50',
            text: 'text-slate-400',
            icon: '○',
            label: 'Pending',
        },
    };

    const s = styles[status] || styles.unknown;
    const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

    return (
        <div className="inline-flex items-center gap-1">
            <span className={`inline-flex items-center gap-1 ${s.bg} ${s.text} ${sizeClass} rounded-full font-medium`}>
                <span>{s.icon}</span>
                {showLabel && <span>{s.label}</span>}
            </span>

            {isCatchAll && (
                <span className="px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded-full">
                    Catch-all
                </span>
            )}

            {isRoleAccount && (
                <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full">
                    Generic
                </span>
            )}
        </div>
    );
}

export function BestContactBadge() {
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-gradient-to-r from-amber-400 to-orange-400 text-white rounded-full font-semibold">
            ⭐ Best
        </span>
    );
}

export function DeliverabilityIndicator({
    deliverability
}: {
    deliverability: 'high' | 'medium' | 'low' | 'catch-all' | 'unknown'
}) {
    const config = {
        high: { color: 'bg-green-500', label: 'High Deliverability' },
        medium: { color: 'bg-amber-500', label: 'Medium' },
        low: { color: 'bg-red-500', label: 'Low' },
        'catch-all': { color: 'bg-indigo-500', label: 'Catch-all' },
        unknown: { color: 'bg-slate-300', label: 'Unknown' },
    };

    const { color, label } = config[deliverability] || config.unknown;

    return (
        <div className="flex items-center gap-2 text-xs text-slate-600">
            <div className={`w-2 h-2 rounded-full ${color}`} />
            <span>{label}</span>
        </div>
    );
}
