import { ReactNode } from 'react';
import { ArrowUpDown } from 'lucide-react';

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
        <div
            className="sticky top-0 z-10 py-4 px-5 flex items-center mb-4 rounded-[var(--radius-xl)]"
            style={{
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(8px)',
                border: '1px solid var(--border-soft)',
                boxShadow: 'var(--shadow-card)'
            }}
        >
            <div className="w-full grid grid-cols-1 md:grid-cols-[360px_1fr_260px] gap-6 items-center">
                {columns.map((col, i) => (
                    <div
                        key={i}
                        className={`text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5 ${col.className || ''}`}
                        style={{ color: 'var(--text-muted)' }}
                    >
                        {col.label}
                        {col.sortable && onSort && (
                            <button
                                onClick={() => col.sortKey && onSort(col.sortKey)}
                                className={`p-1 rounded-[var(--radius-sm)] transition-colors ${currentSort === col.sortKey ? 'text-[var(--accent-blue)] bg-[var(--accent-blue-light)]' : 'hover:bg-[var(--bg-card-muted)]'}`}
                            >
                                <ArrowUpDown size={12} />
                            </button>
                        )}
                    </div>
                ))}
            </div>
            {totalCount !== undefined && (
                <div
                    className="absolute right-5 top-1/2 -translate-y-1/2 text-xs font-medium"
                    style={{ color: 'var(--text-muted)' }}
                >
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
        <div
            className="text-center py-20 rounded-[var(--radius-card)]"
            style={{
                background: 'var(--bg-card)',
                border: '1px dashed var(--border-default)'
            }}
        >
            {Icon && (
                <div
                    className="w-14 h-14 rounded-[var(--radius-lg)] flex items-center justify-center mx-auto mb-5"
                    style={{ background: 'var(--bg-card-muted)', color: 'var(--text-muted)' }}
                >
                    <Icon className="h-7 w-7" />
                </div>
            )}
            <h3
                className="text-lg font-semibold mb-2"
                style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
            >
                {title}
            </h3>
            <p
                className="text-sm max-w-sm mx-auto"
                style={{ color: 'var(--text-secondary)' }}
            >
                {description}
            </p>
            {action && <div className="mt-6">{action}</div>}
        </div>
    );
}

