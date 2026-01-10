import { ReactNode } from 'react';
import { ChevronDown, Search, ArrowUpDown } from 'lucide-react';

interface ResultsListContainerProps {
    children: ReactNode;
    className?: string;
}

export function ResultsListContainer({ children, className = '' }: ResultsListContainerProps) {
    return (
        <div className={`space-y-4 ${className}`}>
            {children}
        </div>
    );
}

interface ResultsListHeaderProps {
    columns: { label: string; className?: string; sortable?: boolean; sortKey?: string }[];
    currentSort?: string;
    onSort?: (key: string) => void;
    totalCount?: number;
}

export function ResultsListHeader({ columns, currentSort, onSort, totalCount }: ResultsListHeaderProps) {
    return (
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-200 py-3 px-4 flex items-center shadow-sm mb-4 rounded-xl">
            <div className="w-full grid grid-cols-1 md:grid-cols-[320px_1fr_260px] gap-4 items-center">
                {columns.map((col, i) => (
                    <div
                        key={i}
                        className={`text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1 ${col.className || ''}`}
                    >
                        {col.label}
                        {col.sortable && onSort && (
                            <button
                                onClick={() => col.sortKey && onSort(col.sortKey)}
                                className={`p-1 hover:bg-gray-100 rounded ${currentSort === col.sortKey ? 'text-indigo-600' : 'text-gray-400'}`}
                            >
                                <ArrowUpDown size={12} />
                            </button>
                        )}
                    </div>
                ))}
            </div>
            {totalCount !== undefined && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">
                    {totalCount} Results
                </div>
            )}
        </div>
    );
}

export function ResultsListEmptyState({
    icon: Icon,
    title,
    description,
    action
}: {
    icon?: any,
    title: string,
    description: string,
    action?: ReactNode
}) {
    return (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-300">
            {Icon && (
                <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Icon className="h-6 w-6 text-gray-400" />
                </div>
            )}
            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
            <p className="mt-1 text-sm text-gray-500 max-w-sm mx-auto">{description}</p>
            {action && <div className="mt-6">{action}</div>}
        </div>
    );
}
