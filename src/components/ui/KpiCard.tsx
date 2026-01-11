'use client';

import React from 'react';
import { TrendingUp, TrendingDown, LucideIcon } from 'lucide-react';

// ─────────────────────────────────────────
// KPI Theme System (Centralised)
// ─────────────────────────────────────────

export type KpiTheme = 'mint' | 'lilac' | 'warning' | 'danger' | 'default';

export interface KpiThemeStyles {
    border: string;
    iconBg: string;
    iconColor: string;
}

export const kpiThemeStyles: Record<KpiTheme, KpiThemeStyles> = {
    mint: {
        border: 'var(--mint)',
        iconBg: 'var(--mint-soft)',
        iconColor: 'var(--mint-text)'
    },
    lilac: {
        border: 'var(--lilac)',
        iconBg: 'var(--lilac-soft)',
        iconColor: 'var(--lilac-text)'
    },
    warning: {
        border: 'var(--danger)',
        iconBg: 'var(--danger-soft)',
        iconColor: 'var(--danger-text)'
    },
    danger: {
        border: 'var(--danger)',
        iconBg: 'var(--danger-soft)',
        iconColor: 'var(--danger-text)'
    },
    default: {
        border: 'var(--border-default)',
        iconBg: 'var(--bg-card-muted)',
        iconColor: 'var(--text-secondary)'
    }
};

export function getKpiTheme(theme: KpiTheme): KpiThemeStyles {
    return kpiThemeStyles[theme] || kpiThemeStyles.default;
}

// ─────────────────────────────────────────
// KpiCard Component
// ─────────────────────────────────────────

export interface KpiCardProps {
    label: string;
    value: string | number;
    icon?: LucideIcon;
    trend?: string;
    trendUp?: boolean;
    theme?: KpiTheme;
    className?: string;
    onClick?: () => void;
    'data-kpi-key'?: string;
}

export function KpiCard({
    label,
    value,
    icon: Icon,
    trend,
    trendUp,
    theme = 'default',
    className = '',
    onClick,
    'data-kpi-key': kpiKey
}: KpiCardProps) {
    const themeStyles = getKpiTheme(theme);

    return (
        <div
            className={`relative overflow-hidden transition-all duration-200 hover:shadow-[var(--shadow-card-hover)] hover:translate-y-[-1px] group ${onClick ? 'cursor-pointer' : ''} ${className}`}
            style={{
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius-card)',
                border: '1px solid var(--border-soft)',
                borderLeft: `4px solid ${themeStyles.border}`,
                boxShadow: 'var(--shadow-card)',
                padding: '20px 24px'
            }}
            onClick={onClick}
            data-kpi-key={kpiKey}
        >
            {/* Top Row: Label + Icon */}
            <div className="flex items-start justify-between mb-3">
                <span
                    className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-muted)' }}
                >
                    {label}
                </span>
                {Icon && (
                    <div
                        className="w-9 h-9 rounded-[var(--radius-md)] flex items-center justify-center shrink-0"
                        style={{ background: themeStyles.iconBg, color: themeStyles.iconColor }}
                    >
                        <Icon size={18} />
                    </div>
                )}
            </div>

            {/* Big Number */}
            <div
                className="text-4xl font-bold tracking-tight"
                style={{
                    fontFamily: 'var(--font-display)',
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.03em',
                    lineHeight: 1.1
                }}
            >
                {value}
            </div>

            {/* Trend */}
            {trend && (
                <div className="flex items-center gap-1.5 mt-3">
                    {trendUp !== undefined && (
                        trendUp
                            ? <TrendingUp size={14} style={{ color: 'var(--mint-text)' }} />
                            : <TrendingDown size={14} style={{ color: 'var(--danger-text)' }} />
                    )}
                    <span
                        className="text-xs font-medium"
                        style={{
                            color: trendUp === true
                                ? 'var(--mint-text)'
                                : trendUp === false
                                    ? 'var(--danger-text)'
                                    : 'var(--text-muted)'
                        }}
                    >
                        {trend}
                    </span>
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────
// KpiGrid Helper
// ─────────────────────────────────────────

export function KpiGrid({
    children,
    className = ''
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8 ${className}`}>
            {children}
        </div>
    );
}

export default KpiCard;
