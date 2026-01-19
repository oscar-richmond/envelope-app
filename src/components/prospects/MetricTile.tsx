import { ReactNode } from 'react';

interface MetricTileProps {
    label: string;
    value: string;
    score?: number | null;
    scoreColor?: 'green' | 'amber' | 'red' | 'gray' | 'purple' | 'blue' | 'mint' | 'lilac';
    subtext?: string | null;
    onDetails?: () => void;
    topRightAction?: ReactNode;
    action?: ReactNode;
    href?: string;
    interactive?: boolean;
}

export default function MetricTile({
    label,
    value,
    score,
    scoreColor = 'gray',
    subtext,
    onDetails,
    className = '',
    action,
    topRightAction,
    href,
    interactive
}: MetricTileProps) {

    // Score chip colors - keep as-is per requirements
    const pillColors: Record<string, string> = {
        green: 'bg-[var(--success-light)] text-[var(--success-text)]',
        amber: 'bg-[var(--warning-light)] text-[var(--warning-text)]',
        red: 'bg-[var(--error-light)] text-[var(--error-text)]',
        gray: 'bg-[var(--bg-card-muted)] text-[var(--text-secondary)]',
        purple: 'bg-[var(--accent-lilac-bg)] text-[var(--accent-lilac-text)]',
        blue: 'bg-[var(--accent-blue-light)] text-[var(--accent-blue-text)]',
        mint: 'bg-[var(--accent-mint-bg)] text-[var(--accent-mint-text)]',
        lilac: 'bg-[var(--accent-lilac-bg)] text-[var(--accent-lilac-text)]'
    };

    // 1. Interactive Logic
    const isInteractive = interactive || !!href || !!onDetails;
    const Component = href ? 'a' : (onDetails ? 'button' : 'div') as any;

    const interactionProps = href ? {
        href,
        target: '_blank',
        rel: 'noopener noreferrer'
    } : (onDetails ? {
        onClick: onDetails,
        type: 'button'
    } : {});

    return (
        <Component
            {...interactionProps}
            className={`
                flex flex-col h-full p-3 rounded-[var(--radius-lg)] bg-[var(--bg-card-muted)] border border-[var(--border-soft)] relative text-left w-full min-w-0
                ${className}
                ${isInteractive ? 'hover:bg-[var(--bg-card)] hover:border-[var(--border-default)] hover:shadow-[var(--shadow-card)] cursor-pointer transition-all group/tile focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:ring-offset-1' : ''}
            `}
        >
            {/* Header row with label and Actions */}
            <div className="flex items-center justify-between gap-2 mb-1.5 w-full">
                <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider truncate flex-1">{label}</span>
                <div className="flex items-center gap-1">
                    {topRightAction && (
                        <div onClick={e => e.stopPropagation()}>{topRightAction}</div>
                    )}
                    {isInteractive && !topRightAction && (
                        <span
                            className="
                                px-2 py-0.5 rounded-full text-[10px] font-semibold 
                                transition-all duration-150 flex-shrink-0
                                bg-[rgba(84,130,237,0.08)] text-[var(--brand)] border border-[rgba(84,130,237,0.25)]
                                group-hover/tile:bg-[rgba(84,130,237,0.15)] group-hover/tile:border-[rgba(84,130,237,0.4)]
                            "
                        >
                            View
                        </span>
                    )}
                </div>
            </div>

            {/* Value row with score chip */}
            <div className="flex items-center gap-1.5 mb-1 min-w-0">
                <span
                    className="text-sm font-bold text-[var(--text-primary)] truncate tracking-tight"
                    style={{ fontFamily: 'var(--font-display)' }}
                >
                    {value}
                </span>
                {score !== undefined && score !== null && (
                    <span className={`px-1.5 py-0.5 rounded-[var(--radius-badge)] text-[11px] font-bold flex-shrink-0 ${pillColors[scoreColor]}`}>
                        {score}
                    </span>
                )}
            </div>

            {/* Subtext row */}
            {subtext && (
                <div className="text-[10px] text-[var(--text-muted)] truncate w-full mt-auto" title={subtext}>
                    {subtext}
                </div>
            )}

            {/* Bottom Action Area (Now inside interactive wrapper) */}
            {action && (
                <div className="mt-3 w-full" onClick={e => e.stopPropagation()}>
                    {action}
                </div>
            )}
        </Component>
    );
}
