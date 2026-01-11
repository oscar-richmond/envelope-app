import React from 'react';

// Locked palette variants only: mint, lilac, neutral, danger
type BadgeVariant = 'mint' | 'lilac' | 'neutral' | 'danger';
type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
    children: React.ReactNode;
    variant?: BadgeVariant;
    size?: BadgeSize;
    className?: string;
}

// Block-fill style using locked palette
const variantStyles: Record<BadgeVariant, { bg: string; text: string; border: string }> = {
    mint: {
        bg: 'var(--mint-soft)',
        text: 'var(--mint-text)',
        border: 'var(--chip-mint-border)'
    },
    lilac: {
        bg: 'var(--lilac-soft)',
        text: 'var(--lilac-text)',
        border: 'var(--chip-lilac-border)'
    },
    neutral: {
        bg: 'var(--surface-2)',
        text: 'var(--text-secondary)',
        border: 'var(--border-soft)'
    },
    danger: {
        bg: 'var(--danger-soft)',
        text: 'var(--danger-text)',
        border: 'var(--chip-danger-border)'
    }
};

const sizeStyles: Record<BadgeSize, { fontSize: string; padding: string }> = {
    sm: { fontSize: '11px', padding: '3px 8px' },
    md: { fontSize: '12px', padding: '4px 10px' },
    lg: { fontSize: '13px', padding: '5px 12px' }
};

export function Badge({
    children,
    variant = 'neutral',
    size = 'md',
    className = ''
}: BadgeProps) {
    const colors = variantStyles[variant];
    const sizing = sizeStyles[size];

    return (
        <span
            className={`inline-flex items-center font-semibold ${className}`}
            style={{
                background: colors.bg,
                color: colors.text,
                border: `1px solid ${colors.border}`,
                borderRadius: 'var(--radius-badge)',
                fontSize: sizing.fontSize,
                padding: sizing.padding,
                lineHeight: 1.35,
                whiteSpace: 'nowrap'
            }}
        >
            {children}
        </span>
    );
}

// Score badge with number
interface ScoreBadgeProps {
    label: string;
    score?: number;
    variant?: BadgeVariant;
    size?: BadgeSize;
}

export function ScoreBadge({ label, score, variant = 'neutral', size = 'md' }: ScoreBadgeProps) {
    return (
        <Badge variant={variant} size={size}>
            {label} {score !== undefined && <span className="ml-1 opacity-80">{score}</span>}
        </Badge>
    );
}

// Status badge with dot indicator
interface StatusBadgeProps {
    status: string;
    variant?: BadgeVariant;
}

export function StatusBadge({ status, variant = 'neutral' }: StatusBadgeProps) {
    const colors = variantStyles[variant];

    return (
        <Badge variant={variant} size="sm">
            <span
                className="w-1.5 h-1.5 rounded-full mr-1.5"
                style={{ background: colors.text }}
            />
            {status}
        </Badge>
    );
}

export default Badge;
