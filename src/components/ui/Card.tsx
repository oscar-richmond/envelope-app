import React from 'react';

interface CardProps {
    children: React.ReactNode;
    variant?: 'default' | 'muted' | 'dark';
    hover?: boolean;
    padding?: 'none' | 'sm' | 'md' | 'lg';
    className?: string;
    style?: React.CSSProperties;
    onClick?: () => void;
}

const paddingMap = {
    none: '0',
    sm: 'var(--space-3)',
    md: 'var(--space-5)',
    lg: 'var(--space-6)'
};

export function Card({
    children,
    variant = 'default',
    hover = false,
    padding = 'md',
    className = '',
    style,
    onClick
}: CardProps) {
    const baseStyles: React.CSSProperties = {
        borderRadius: 'var(--radius-card)',
        padding: paddingMap[padding],
        transition: 'all var(--duration-med) var(--ease-out)',
        ...style
    };

    const variantStyles: Record<string, React.CSSProperties> = {
        default: {
            background: 'var(--surface-1)',
            border: '1px solid var(--border-soft)',
            boxShadow: 'var(--shadow-card)'
        },
        muted: {
            background: 'var(--surface-2)',
            border: '1px solid var(--border-soft)'
        },
        dark: {
            background: 'var(--bg-dark-card)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            boxShadow: 'var(--shadow-card)',
            color: 'var(--text-on-dark-primary)'
        }
    };

    const hoverClass = hover ? 'card-hover' : '';
    const clickableStyle = onClick ? { cursor: 'pointer' } : {};

    return (
        <div
            className={`${hoverClass} ${className}`}
            style={{ ...baseStyles, ...variantStyles[variant], ...clickableStyle }}
            onClick={onClick}
        >
            {children}
        </div>
    );
}

// Section card with header
interface SectionCardProps extends Omit<CardProps, 'padding'> {
    title?: string;
    subtitle?: string;
    action?: React.ReactNode;
}

export function SectionCard({
    title,
    subtitle,
    action,
    children,
    ...props
}: SectionCardProps) {
    return (
        <Card {...props} padding="none">
            {(title || action) && (
                <div
                    className="flex items-center justify-between"
                    style={{
                        padding: 'var(--space-4) var(--space-5)',
                        borderBottom: '1px solid var(--border-soft)'
                    }}
                >
                    <div>
                        {title && (
                            <h3
                                className="font-semibold"
                                style={{
                                    fontSize: '16px',
                                    color: 'var(--text-primary)',
                                    lineHeight: 1.35
                                }}
                            >
                                {title}
                            </h3>
                        )}
                        {subtitle && (
                            <p
                                style={{
                                    fontSize: '13px',
                                    color: 'var(--text-muted)',
                                    marginTop: '2px'
                                }}
                            >
                                {subtitle}
                            </p>
                        )}
                    </div>
                    {action}
                </div>
            )}
            <div style={{ padding: 'var(--space-5)' }}>
                {children}
            </div>
        </Card>
    );
}

// Metric card for score displays
interface MetricCardProps {
    label: string;
    value: string | number;
    variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent';
    icon?: React.ReactNode;
    trend?: string;
    className?: string;
}

const metricVariantStyles: Record<string, { bg: string; border: string; accent: string }> = {
    success: {
        bg: 'var(--chip-success-bg)',
        border: 'var(--chip-success-border)',
        accent: 'var(--success)'
    },
    warning: {
        bg: 'var(--chip-warning-bg)',
        border: 'var(--chip-warning-border)',
        accent: 'var(--warning)'
    },
    danger: {
        bg: 'var(--chip-danger-bg)',
        border: 'var(--chip-danger-border)',
        accent: 'var(--error)'
    },
    info: {
        bg: 'var(--chip-info-bg)',
        border: 'var(--chip-info-border)',
        accent: 'var(--info)'
    },
    neutral: {
        bg: 'var(--surface-2)',
        border: 'var(--border-soft)',
        accent: 'var(--text-secondary)'
    },
    accent: {
        bg: 'var(--chip-accent-bg)',
        border: 'var(--chip-accent-border)',
        accent: 'var(--accent-lilac)'
    }
};

export function MetricCard({
    label,
    value,
    variant = 'neutral',
    icon,
    trend,
    className = ''
}: MetricCardProps) {
    const colors = metricVariantStyles[variant];

    return (
        <div
            className={className}
            style={{
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-4)',
                transition: 'all var(--duration-med) var(--ease-out)'
            }}
        >
            <div
                className="flex items-center justify-between mb-2"
                style={{ minHeight: '20px' }}
            >
                <span
                    className="font-semibold uppercase tracking-wider"
                    style={{
                        fontSize: '11px',
                        color: 'var(--text-muted)'
                    }}
                >
                    {label}
                </span>
                {icon && (
                    <span style={{ color: colors.accent }}>
                        {icon}
                    </span>
                )}
            </div>
            <div
                className="font-bold"
                style={{
                    fontSize: '24px',
                    color: 'var(--text-primary)',
                    lineHeight: 1.2
                }}
            >
                {value}
            </div>
            {trend && (
                <p
                    style={{
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                        marginTop: 'var(--space-2)'
                    }}
                >
                    {trend}
                </p>
            )}
        </div>
    );
}

export default Card;
