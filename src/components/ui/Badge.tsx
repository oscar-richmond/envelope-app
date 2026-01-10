import React from 'react';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent';
type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
    children: React.ReactNode;
    variant?: BadgeVariant;
    size?: BadgeSize;
    className?: string;
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string; border: string }> = {
    success: {
        bg: 'var(--chip-success-bg)',
        text: 'var(--chip-success-text)',
        border: 'var(--chip-success-border)'
    },
    warning: {
        bg: 'var(--chip-warning-bg)',
        text: 'var(--chip-warning-text)',
        border: 'var(--chip-warning-border)'
    },
    danger: {
        bg: 'var(--chip-danger-bg)',
        text: 'var(--chip-danger-text)',
        border: 'var(--chip-danger-border)'
    },
    info: {
        bg: 'var(--chip-info-bg)',
        text: 'var(--chip-info-text)',
        border: 'var(--chip-info-border)'
    },
    neutral: {
        bg: 'var(--chip-neutral-bg)',
        text: 'var(--chip-neutral-text)',
        border: 'var(--chip-neutral-border)'
    },
    accent: {
        bg: 'var(--chip-accent-bg)',
        text: 'var(--chip-accent-text)',
        border: 'var(--chip-accent-border)'
    }
};

const sizeStyles: Record<BadgeSize, { fontSize: string; padding: string }> = {
    sm: { fontSize: '11px', padding: '2px 8px' },
    md: { fontSize: '12px', padding: '4px 10px' },
    lg: { fontSize: '13px', padding: '6px 12px' }
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
