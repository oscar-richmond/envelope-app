import { ChevronRight } from 'lucide-react';
import { ReactNode } from 'react';

interface MetricTileProps {
    label: string;
    value: string;
    score?: number;
    scoreColor?: 'green' | 'amber' | 'red' | 'gray' | 'purple' | 'blue';
    subtext?: string | null;
    onDetails?: () => void;
    className?: string;
    action?: ReactNode; // Optional custom action (like "Check Financials" button)
    href?: string; // New: for external links
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
    href
}: MetricTileProps) {

    const pillColors = {
        green: 'bg-emerald-100 text-emerald-800',
        amber: 'bg-amber-100 text-amber-800',
        red: 'bg-rose-100 text-rose-800',
        gray: 'bg-gray-100 text-gray-600',
        purple: 'bg-purple-100 text-purple-800',
        blue: 'bg-blue-100 text-blue-800'
    };

    // 1. Custom Action State (e.g. "Find Website") - Not clickable container
    if (action) {
        return (
            <div className={`flex flex-col h-full justify-between p-3 rounded-xl bg-gray-50 border border-gray-100 ${className}`}>
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{label}</span>
                </div>
                <div className="mt-auto">{action}</div>
            </div>
        )
    }

    // 2. Interactive Card State
    // Determine tag and props
    const isInteractive = !!href || !!onDetails;
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
                flex flex-col h-full p-3 rounded-xl bg-gray-50 border border-gray-100 relative text-left w-full
                ${className}
                ${isInteractive ? 'hover:bg-white hover:border-gray-300 hover:shadow-sm cursor-pointer transition-all group/tile' : ''}
            `}
        >
            <div className="flex items-center justify-between mb-1.5 h-4 w-full">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{label}</span>
                {/* Visual Arrow Cue (always visible if interactive) */}
                {isInteractive && (
                    <div className="text-gray-300 group-hover/tile:text-indigo-600 transition-colors">
                        <ChevronRight size={14} strokeWidth={2.5} />
                    </div>
                )}
            </div>

            <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-bold text-gray-900 truncate tracking-tight">{value}</span>
                {score !== undefined && (
                    <span className={`px-1.5 py-0.5 rounded-lg text-[10px] font-bold ${pillColors[scoreColor]}`}>
                        {score}
                    </span>
                )}
            </div>

            {subtext && (
                <div className="text-[10px] text-gray-500 truncate w-full mt-auto" title={subtext}>
                    {subtext}
                </div>
            )}
        </Component>
    );
}
