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
            <div className={`flex flex-col h-full justify-between p-3 rounded-xl bg-gray-50 border border-gray-100/60 ${className}`}>
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</span>
                </div>
                <div className="mt-auto">{action}</div>
            </div>
        )
    }

    return (
        <div className={`flex flex-col h-full p-3 rounded-xl bg-gray-50 border border-gray-100/60 hover:bg-white hover:border-gray-200 hover:shadow-sm transition-all group/tile relative ${className}`}>
            <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</span>
                {onDetails && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onDetails(); }}
                        className="text-gray-300 hover:text-indigo-600 transition-colors -mr-1 p-0.5 rounded-full hover:bg-indigo-50"
                        title="View details"
                    >
                        <ChevronRight size={14} />
                    </button>
                )}
            </div>

            <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-bold text-gray-900 truncate">{value}</span>
                {score !== undefined && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${pillColors[scoreColor]}`}>
                        {score}
                    </span>
                )}
            </div>

            {subtext && (
                <div className="text-[10px] text-gray-500 truncate w-full" title={subtext}>
                    {subtext}
                </div>
            )}
        </div>
    );
}
