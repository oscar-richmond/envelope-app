import { Info } from 'lucide-react';
import { ReactNode } from 'react';

interface SignalBlockProps {
    label: string;
    value: string;
    score?: number; // Optional score pill
    scoreColor?: 'green' | 'amber' | 'red' | 'gray' | 'purple' | 'blue';
    helper?: ReactNode; // Helper text/node at bottom
    onExplain?: () => void; // Trigger for the "Why" modal
    className?: string;
}

export default function SignalBlock({
    label,
    value,
    score,
    scoreColor = 'gray',
    helper,
    onExplain,
    className = ''
}: SignalBlockProps) {

    const pillColors = {
        green: 'bg-emerald-100 text-emerald-800',
        amber: 'bg-amber-100 text-amber-800',
        red: 'bg-rose-100 text-rose-800',
        gray: 'bg-gray-100 text-gray-600',
        purple: 'bg-purple-100 text-purple-800',
        blue: 'bg-blue-100 text-blue-800'
    };

    return (
        <div className={`flex flex-col min-w-[120px] ${className}`}>
            <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</span>
                {onExplain && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onExplain(); }}
                        className="text-[10px] font-medium text-gray-500 hover:text-indigo-600 bg-white border border-gray-200 hover:border-indigo-200 hover:bg-indigo-50 px-2 py-0.5 rounded transition-all shadow-sm"
                        title="View details"
                    >
                        Details
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

            {helper && (
                <div className="text-[11px] text-gray-500 truncate max-w-full">
                    {helper}
                </div>
            )}
        </div>
    );
}
