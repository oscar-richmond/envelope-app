import React from 'react';

type StatsCardVariant = 'blue' | 'mint' | 'lilac' | 'teal' | 'warning' | 'danger' | 'neutral' | 'dark';

interface StatsCardProps {
    label: string;
    value: string | number | React.ReactNode;
    icon?: React.ReactNode;
    trend?: string;
    variant?: StatsCardVariant;
    compact?: boolean;
}

// Workspace card style: soft tinted background + subtle border + tinted icon circle
const variantStyles: Record<StatsCardVariant, {
    bg: string;
    border: string;
    iconBg: string;
    iconColor: string;
}> = {
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
    neutral: {
        bg: 'rgba(107, 114, 128, 0.06)',
        border: 'rgba(107, 114, 128, 0.15)',
        iconBg: 'rgba(107, 114, 128, 0.12)',
        iconColor: 'rgb(107, 114, 128)'
    },
    dark: {
        bg: 'var(--nav-bg)',
        border: 'rgba(255, 255, 255, 0.08)',
        iconBg: 'rgba(255, 255, 255, 0.10)',
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
                borderRadius: 'var(--radius-card)',
                padding: compact ? '16px 20px' : '20px 24px',
                transition: 'all 0.2s ease-out',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
            }}
            className="hover:translate-y-[-2px]"
            onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = styles.iconColor;
                e.currentTarget.style.boxShadow = `0 8px 24px -8px ${styles.border}`;
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = styles.border;
                e.currentTarget.style.boxShadow = 'none';
            }}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                    {/* Label - smaller and muted */}
                    <p
                        style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            color: 'var(--text-muted)',
                            marginBottom: '8px'
                        }}
                    >
                        {label}
                    </p>
                    {/* KPI Value - large and bold */}
                    <div
                        style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: compact ? '32px' : '36px',
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            letterSpacing: '-0.03em',
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
                                fontSize: '12px',
                                color: 'var(--text-secondary)',
                                marginTop: '8px'
                            }}
                        >
                            {trend}
                        </p>
                    )}
                </div>
                {/* Tinted icon circle */}
                {icon && (
                    <div
                        style={{
                            background: styles.iconBg,
                            color: styles.iconColor,
                            width: '40px',
                            height: '40px',
                            borderRadius: '10px',
                            flexShrink: 0,
                            marginLeft: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
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
        <div className={`grid grid-cols-1 gap-5 mb-8 ${className || 'sm:grid-cols-2 lg:grid-cols-4'}`}>
            {children}
        </div>
    );
}

export default StatsCard;
