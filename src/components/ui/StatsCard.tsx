import React from 'react';

type StatsCardVariant = 'mint' | 'lilac' | 'neutral' | 'dark';

interface StatsCardProps {
    label: string;
    value: string | number | React.ReactNode;
    icon?: React.ReactNode;
    trend?: string;
    variant?: StatsCardVariant;
    compact?: boolean;
}

// Block-fill style variants using locked palette
const variantStyles: Record<StatsCardVariant, {
    bg: string;
    border: string;
    labelColor: string;
    valueColor: string;
    iconBg: string;
    iconColor: string;
}> = {
    mint: {
        bg: 'var(--mint-soft)',
        border: 'rgba(166, 244, 179, 0.25)',
        labelColor: 'var(--mint-text)',
        valueColor: 'var(--text-primary)',
        iconBg: 'var(--mint-weak)',
        iconColor: 'var(--mint-text)'
    },
    lilac: {
        bg: 'var(--lilac-soft)',
        border: 'rgba(184, 166, 255, 0.25)',
        labelColor: 'var(--lilac-text)',
        valueColor: 'var(--text-primary)',
        iconBg: 'var(--lilac-weak)',
        iconColor: 'var(--lilac-text)'
    },
    neutral: {
        bg: 'var(--surface-2)',
        border: 'var(--border-soft)',
        labelColor: 'var(--text-muted)',
        valueColor: 'var(--text-primary)',
        iconBg: 'var(--surface-3)',
        iconColor: 'var(--text-muted)'
    },
    dark: {
        bg: 'var(--ink)',
        border: 'rgba(255, 255, 255, 0.06)',
        labelColor: 'rgba(255, 255, 255, 0.6)',
        valueColor: 'rgba(255, 255, 255, 0.95)',
        iconBg: 'rgba(255, 255, 255, 0.08)',
        iconColor: 'rgba(255, 255, 255, 0.7)'
    }
};

export function StatsCard({
    label,
    value,
    icon,
    trend,
    variant = 'neutral',
    compact = false
}: StatsCardProps) {
    const styles = variantStyles[variant];

    return (
        <div
            style={{
                background: styles.bg,
                border: `1px solid ${styles.border}`,
                borderRadius: 'var(--radius-xl)',
                padding: compact ? 'var(--space-4)' : 'var(--space-5)',
                boxShadow: 'var(--shadow-card)',
                transition: 'all var(--duration-med) var(--ease-out)',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
            }}
            className="hover:shadow-[var(--shadow-card-hover)]"
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                    <p
                        style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            color: styles.labelColor,
                            marginBottom: '8px'
                        }}
                    >
                        {label}
                    </p>
                    <div
                        style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: compact ? '28px' : '36px',
                            fontWeight: 700,
                            color: styles.valueColor,
                            letterSpacing: '-0.02em',
                            lineHeight: 1.1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {value}
                    </div>
                    {trend && (
                        <p
                            style={{
                                fontSize: '13px',
                                color: styles.labelColor,
                                marginTop: '8px',
                                opacity: 0.8
                            }}
                        >
                            {trend}
                        </p>
                    )}
                </div>
                {icon && (
                    <div
                        style={{
                            background: styles.iconBg,
                            color: styles.iconColor,
                            padding: '10px',
                            borderRadius: 'var(--radius-md)',
                            flexShrink: 0,
                            marginLeft: '12px'
                        }}
                    >
                        {icon}
                    </div>
                )}
            </div>
        </div>
    );
}

export function StatsGrid({ children, className }: { children: React.ReactNode, className?: string }) {
    return (
        <div className={`grid grid-cols-1 gap-4 mb-6 ${className || 'sm:grid-cols-2 lg:grid-cols-4'}`}>
            {children}
        </div>
    );
}

export default StatsCard;
