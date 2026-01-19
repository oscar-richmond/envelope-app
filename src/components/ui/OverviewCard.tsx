'use client';

import React from 'react';

export type OverviewCardAccent = 'brand' | 'mint' | 'lilac' | 'danger' | 'neutral';

export interface OverviewCardProps {
    /** Primary metric label */
    label: string;
    /** Primary value (number or string) */
    value: string | number;
    /** Accent color for left strip and icon circle */
    accent?: OverviewCardAccent;
    /** Icon to display in tonal circle */
    icon?: React.ReactNode;
    /** Optional trend indicator */
    trend?: {
        direction: 'up' | 'down' | 'neutral';
        value: string;
    };
    /** Optional subtitle/meta text */
    subtitle?: string;
    /** Click handler (makes card interactive) */
    onClick?: () => void;
    /** Additional CSS classes */
    className?: string;
}

/**
 * OverviewCard - Unified metric card component.
 * 
 * Features:
 * - Left accent strip (4px colored border)
 * - Optional tonal icon circle
 * - Large bold value display
 * - Consistent label typography
 * - Optional trend indicator
 * - Hover state when clickable
 */
export function OverviewCard({
    label,
    value,
    accent = 'brand',
    icon,
    trend,
    subtitle,
    onClick,
    className = ''
}: OverviewCardProps) {
    const isClickable = !!onClick;

    // Accent color mappings (using design tokens)
    const accentColors: Record<OverviewCardAccent, {
        strip: string;
        iconBg: string;
        iconColor: string;
        trendUp: string;
        trendDown: string;
    }> = {
        brand: {
            strip: 'var(--brand)',
            iconBg: 'var(--brand-soft)',
            iconColor: 'var(--brand)',
            trendUp: 'var(--mint-text)',
            trendDown: 'var(--danger-text)'
        },
        mint: {
            strip: 'var(--mint-strong)',
            iconBg: 'var(--mint-soft)',
            iconColor: 'var(--mint-text)',
            trendUp: 'var(--mint-text)',
            trendDown: 'var(--danger-text)'
        },
        lilac: {
            strip: 'var(--lilac-strong)',
            iconBg: 'var(--lilac-soft)',
            iconColor: 'var(--lilac-text)',
            trendUp: 'var(--mint-text)',
            trendDown: 'var(--danger-text)'
        },
        danger: {
            strip: 'var(--danger)',
            iconBg: 'var(--danger-soft)',
            iconColor: 'var(--danger-text)',
            trendUp: 'var(--mint-text)',
            trendDown: 'var(--danger-text)'
        },
        neutral: {
            strip: 'var(--border-default)',
            iconBg: 'var(--bg-card-muted)',
            iconColor: 'var(--text-secondary)',
            trendUp: 'var(--mint-text)',
            trendDown: 'var(--danger-text)'
        }
    };

    const colors = accentColors[accent];

    return (
        <div
            className={`card ${isClickable ? 'card-hover cursor-pointer' : ''} ${className}`}
            onClick={onClick}
            style={{
                position: 'relative',
                overflow: 'hidden',
                padding: '20px 24px'
            }}
        >
            {/* Left accent strip */}
            <div
                style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: '4px',
                    background: colors.strip,
                    borderRadius: 'var(--radius-card) 0 0 var(--radius-card)'
                }}
            />

            <div className="flex items-start justify-between gap-4">
                {/* Content */}
                <div className="flex-1 min-w-0">
                    {/* Label */}
                    <div
                        className="text-label mb-2"
                        style={{ color: 'var(--text-muted)' }}
                    >
                        {label}
                    </div>

                    {/* Value */}
                    <div
                        className="text-2xl font-bold leading-tight"
                        style={{
                            color: 'var(--text-primary)',
                            fontFamily: 'var(--font-display)'
                        }}
                    >
                        {value}
                    </div>

                    {/* Trend or Subtitle */}
                    {(trend || subtitle) && (
                        <div className="mt-2 flex items-center gap-2">
                            {trend && (
                                <span
                                    className="text-sm font-medium flex items-center gap-1"
                                    style={{
                                        color: trend.direction === 'up'
                                            ? colors.trendUp
                                            : trend.direction === 'down'
                                                ? colors.trendDown
                                                : 'var(--text-muted)'
                                    }}
                                >
                                    {trend.direction === 'up' && '↑'}
                                    {trend.direction === 'down' && '↓'}
                                    {trend.value}
                                </span>
                            )}
                            {subtitle && (
                                <span
                                    className="text-sm"
                                    style={{ color: 'var(--text-muted)' }}
                                >
                                    {subtitle}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Icon Circle */}
                {icon && (
                    <div
                        className="flex items-center justify-center shrink-0"
                        style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: 'var(--radius-md)',
                            background: colors.iconBg,
                            color: colors.iconColor
                        }}
                    >
                        {icon}
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * OverviewCardGrid - Grid layout for multiple overview cards
 */
export function OverviewCardGrid({
    children,
    columns = 4
}: {
    children: React.ReactNode;
    columns?: 2 | 3 | 4;
}) {
    const gridCols = {
        2: 'grid-cols-1 md:grid-cols-2',
        3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
        4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
    };

    return (
        <div className={`grid ${gridCols[columns]} gap-5`}>
            {children}
        </div>
    );
}

