import React from 'react';

type StatsCardVariant = 'mint' | 'lilac' | 'neutral' | 'dark' | 'warning';

interface StatsCardProps {
    label: string;
    value: string | number | React.ReactNode;
    icon?: React.ReactNode;
    trend?: string;
    variant?: StatsCardVariant;
    compact?: boolean;
}

// Premium white cards with left accent + tinted icon chips
const variantStyles: Record<StatsCardVariant, {
    bg: string;
    border: string;
    accentBorder: string;
    labelColor: string;
    valueColor: string;
    iconBg: string;
    iconColor: string;
}> = {
    mint: {
        bg: 'var(--bg-card)',
        border: 'var(--border-subtle)',
        accentBorder: 'var(--mint)',
        labelColor: 'var(--text-muted)',
        valueColor: 'var(--text-primary)',
        iconBg: 'var(--mint-soft)',
        iconColor: 'var(--mint-text)'
    },
    lilac: {
        bg: 'var(--bg-card)',
        border: 'var(--border-subtle)',
        accentBorder: 'var(--lilac)',
        labelColor: 'var(--text-muted)',
        valueColor: 'var(--text-primary)',
        iconBg: 'var(--lilac-soft)',
        iconColor: 'var(--lilac-text)'
    },
    neutral: {
        bg: 'var(--bg-card)',
        border: 'var(--border-subtle)',
        accentBorder: 'var(--border-default)',
        labelColor: 'var(--text-muted)',
        valueColor: 'var(--text-primary)',
        iconBg: 'var(--bg-card-muted)',
        iconColor: 'var(--text-secondary)'
    },
    warning: {
        bg: 'var(--bg-card)',
        border: 'var(--border-subtle)',
        accentBorder: 'var(--danger)',
        labelColor: 'var(--text-muted)',
        valueColor: 'var(--text-primary)',
        iconBg: 'var(--danger-soft)',
        iconColor: 'var(--danger-text)'
    },
    dark: {
        bg: 'var(--nav-bg)',
        border: 'rgba(255, 255, 255, 0.06)',
        accentBorder: 'var(--lilac)',
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
                borderLeft: `4px solid ${styles.accentBorder}`,
                borderRadius: 'var(--radius-card)',
                padding: compact ? '16px 20px' : '20px 24px',
                boxShadow: 'var(--shadow-card)',
                transition: 'all 0.2s ease-out',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
            }}
            className="hover:shadow-[var(--shadow-card-hover)] hover:translate-y-[-1px]"
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                    {/* Label - smaller and muted */}
                    <p
                        style={{
                            fontSize: '10px',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            color: styles.labelColor,
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
                            color: styles.valueColor,
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
                {/* Tinted icon chip */}
                {icon && (
                    <div
                        style={{
                            background: styles.iconBg,
                            color: styles.iconColor,
                            width: '36px',
                            height: '36px',
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
