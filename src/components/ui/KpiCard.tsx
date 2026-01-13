'use client';

import React from 'react';
import { TrendingUp, TrendingDown, LucideIcon } from 'lucide-react';

// ─────────────────────────────────────────
// KPI Theme System - Workspace Card Style
// Matches "Your lead generation workspace" cards on sign-in page
// ─────────────────────────────────────────

export type KpiTheme = 'blue' | 'mint' | 'lilac' | 'teal' | 'warning' | 'danger' | 'default';

export interface KpiThemeStyles {
    bg: string;
    border: string;
    iconBg: string;
    iconColor: string;
}

// Workspace card style: soft tinted background + subtle border + tinted icon circle
export const kpiThemeStyles: Record<KpiTheme, KpiThemeStyles> = {
    blue: {
        bg: 'rgba(84, 130, 237, 0.08)',
        border: 'rgba(84, 130, 237, 0.20)',
        iconBg: 'rgba(84, 130, 237, 0.15)',
        iconColor: 'rgb(84, 130, 237)'
    },
    mint: {
        bg: 'rgba(166, 244, 179, 0.10)',
        border: 'rgba(166, 244, 179, 0.25)',
        iconBg: 'rgba(166, 244, 179, 0.20)',
        iconColor: 'rgb(34, 197, 94)'
    },
    lilac: {
        bg: 'rgba(184, 166, 255, 0.08)',
        border: 'rgba(184, 166, 255, 0.20)',
        iconBg: 'rgba(184, 166, 255, 0.15)',
        iconColor: 'rgb(139, 92, 246)'
    },
    teal: {
        bg: 'rgba(45, 212, 191, 0.08)',
        border: 'rgba(45, 212, 191, 0.20)',
        iconBg: 'rgba(45, 212, 191, 0.15)',
        iconColor: 'rgb(20, 184, 166)'
    },
    warning: {
        bg: 'rgba(245, 158, 11, 0.08)',
        border: 'rgba(245, 158, 11, 0.20)',
        iconBg: 'rgba(245, 158, 11, 0.15)',
        iconColor: 'rgb(217, 119, 6)'
    },
    danger: {
        bg: 'rgba(239, 68, 68, 0.08)',
        border: 'rgba(239, 68, 68, 0.20)',
        iconBg: 'rgba(239, 68, 68, 0.15)',
        iconColor: 'rgb(220, 38, 38)'
    },
    default: {
        bg: 'rgba(107, 114, 128, 0.06)',
        border: 'rgba(107, 114, 128, 0.15)',
        iconBg: 'rgba(107, 114, 128, 0.12)',
        iconColor: 'rgb(107, 114, 128)'
    }
};

export function getKpiTheme(theme: KpiTheme): KpiThemeStyles {
    return kpiThemeStyles[theme] || kpiThemeStyles.default;
}

// ─────────────────────────────────────────
// KpiCard Component - Workspace Card Style
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
            className={`relative overflow-hidden transition-all duration-200 group ${onClick ? 'cursor-pointer' : ''} ${className}`}
            style={{
                background: themeStyles.bg,
                borderRadius: 'var(--radius-card)',
                border: `1px solid ${themeStyles.border}`,
                padding: '20px 24px'
            }}
            onClick={onClick}
            data-kpi-key={kpiKey}
            onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = themeStyles.iconColor;
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = `0 8px 24px -8px ${themeStyles.border}`;
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = themeStyles.border;
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
            }}
        >
            {/* Top Row: Label + Icon */}
            <div className="flex items-start justify-between mb-3">
                <span
                    className="text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-muted)' }}
                >
                    {label}
                </span>
                {Icon && (
                    <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
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
                            ? <TrendingUp size={14} style={{ color: 'rgb(34, 197, 94)' }} />
                            : <TrendingDown size={14} style={{ color: 'rgb(220, 38, 38)' }} />
                    )}
                    <span
                        className="text-xs font-medium"
                        style={{
                            color: trendUp === true
                                ? 'rgb(34, 197, 94)'
                                : trendUp === false
                                    ? 'rgb(220, 38, 38)'
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
