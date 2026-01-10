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
}

export default function MetricTile({
    label,
    value,
    score,
    scoreColor = 'gray',
    subtext,
    onDetails,
    className = '',
    action
}: MetricTileProps) {

    const pillColors = {
        green: 'bg-emerald-100 text-emerald-800',
        amber: 'bg-amber-100 text-amber-800',
        red: 'bg-rose-100 text-rose-800',
        gray: 'bg-gray-100 text-gray-600',
        purple: 'bg-purple-100 text-purple-800',
        blue: 'bg-blue-100 text-blue-800'
    };

    if (action) {
        return (
            <div className={`flex flex-col min-w-[140px] max-w-[180px] p-1 ${className}`}>
                <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{label}</span>
                </div>
                <div className="mt-1">{action}</div>
            </div>
        )
    }

    return (
        <div className={`flex flex-col min-w-[140px] max-w-[180px] p-1 group/tile ${className}`}>
            <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{label}</span>
                {onDetails && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onDetails(); }}
                        className="text-[10px] flex items-center gap-0.5 text-gray-400 hover:text-gray-900 transition-colors opacity-0 group-hover/tile:opacity-100"
                    >
                        Details <ChevronRight size={10} />
                    </button>
                )}
            </div>

            <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-semibold text-gray-900 truncate">{value}</span>
                {score !== undefined && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${pillColors[scoreColor]}`}>
                        {score}
                    </span>
                )}
            </div>

            {subtext && (
                <div className="text-[11px] text-gray-500 truncate max-w-full">
                    {subtext}
                </div>
            )}
        </div>
    );
}
