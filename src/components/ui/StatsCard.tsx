import React from 'react';

interface StatsCardProps {
    label: string;
    value: string | number | React.ReactNode;
    icon?: React.ReactNode;
    trend?: string;
    color?: 'default' | 'indigo' | 'green' | 'amber' | 'rose' | 'mint' | 'lilac';
    compact?: boolean;
    dark?: boolean;
}

export function StatsCard({ label, value, icon, trend, color = 'default', compact = false, dark = false }: StatsCardProps) {
    const colorStyles: Record<string, string> = {
        default: 'border-l-4 border-[var(--border-default)]',
        indigo: 'border-l-4 border-[var(--accent-blue)]',
        green: 'border-l-4 border-[var(--success)]',
        amber: 'border-l-4 border-[var(--warning)]',
        rose: 'border-l-4 border-[var(--error)]',
        mint: 'border-l-4 border-[var(--accent-mint)]',
        lilac: 'border-l-4 border-[var(--accent-lilac)]',
    };

    const bgClass = dark
        ? 'bg-[var(--bg-dark-card)] text-[var(--text-on-dark-primary)]'
        : 'bg-[var(--bg-card)]';

    return (
        <div
            className={`
                ${compact ? 'p-4' : 'p-5'} 
                flex items-start justify-between 
                ${colorStyles[color]} 
                ${bgClass}
                rounded-[var(--radius-xl)]
                border border-[var(--border-soft)]
                shadow-[var(--shadow-card)]
                hover:shadow-[var(--shadow-card-hover)]
                transition-all duration-200
                h-full
            `}
        >
            <div className="min-w-0">
                <p className="text-[12px] font-semibold uppercase tracking-wider mb-1.5 text-[var(--text-muted)]" style={dark ? { color: 'var(--text-on-dark-secondary)' } : {}}>
                    {label}
                </p>
                <div
                    className={`${compact ? 'text-3xl' : 'text-4xl'} font-bold truncate pr-1`}
                    style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}
                >
                    {value}
                </div>
                {trend && (
                    <p className="text-sm mt-1.5 text-[var(--text-muted)]" style={dark ? { color: 'var(--text-on-dark-secondary)' } : {}}>
                        {trend}
                    </p>
                )}
            </div>
            {icon && (
                <div
                    className={`p-2 rounded-[var(--radius-md)] shrink-0 ${compact ? 'scale-90' : ''}`}
                    style={{
                        background: dark ? 'rgba(255,255,255,0.08)' : 'var(--bg-card-muted)',
                        color: dark ? 'var(--text-on-dark-secondary)' : 'var(--text-muted)'
                    }}
                >
                    {icon}
                </div>
            )}
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

