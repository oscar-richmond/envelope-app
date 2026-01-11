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

// Premium white cards with tinted icon chips only
const variantStyles: Record<StatsCardVariant, {
    bg: string;
    border: string;
    labelColor: string;
    valueColor: string;
    iconBg: string;
    iconColor: string;
}> = {
    mint: {
        bg: 'var(--bg-card)',
        border: 'var(--border-subtle)',
        labelColor: 'var(--text-muted)',
        valueColor: 'var(--text-primary)',
        iconBg: 'var(--mint-soft)',
        iconColor: 'var(--mint-text)'
    },
    lilac: {
        bg: 'var(--bg-card)',
        border: 'var(--border-subtle)',
        labelColor: 'var(--text-muted)',
        valueColor: 'var(--text-primary)',
        iconBg: 'var(--lilac-soft)',
        iconColor: 'var(--lilac-text)'
    },
    neutral: {
        bg: 'var(--bg-card)',
        border: 'var(--border-subtle)',
        labelColor: 'var(--text-muted)',
        valueColor: 'var(--text-primary)',
        iconBg: 'var(--bg-card-muted)',
        iconColor: 'var(--text-secondary)'
    },
    dark: {
        bg: 'var(--nav-bg)',
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
                borderRadius: 'var(--radius-card)',
                padding: compact ? '16px 20px' : '20px 24px',
                boxShadow: 'var(--shadow-card)',
                transition: 'all 0.2s ease-out',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
            }}
            className="hover:shadow-[var(--shadow-card-hover)] hover:translate-y-[-2px]"
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                    {/* Label - smaller and muted */}
                    <p
                        style={{
                            fontSize: 'var(--text-meta)',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            color: styles.labelColor,
                            marginBottom: '12px'
                        }}
                    >
                        {label}
                    </p>
                    {/* KPI Value - large and bold */}
                    <div
                        style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: compact ? '32px' : 'var(--text-kpi)',
                            fontWeight: 800,
                            color: styles.valueColor,
                            letterSpacing: '-0.02em',
                            lineHeight: 'var(--line-height-tight)',
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
                                fontSize: 'var(--text-small)',
                                color: 'var(--text-secondary)',
                                marginTop: '12px'
                            }}
                        >
                            {trend}
                        </p>
                    )}
                </div>
                {/* Tinted icon chip */}
                {icon && (
                    <div
                        style={{
                            background: styles.iconBg,
                            color: styles.iconColor,
                            padding: '12px',
                            borderRadius: 'var(--radius-md)',
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
