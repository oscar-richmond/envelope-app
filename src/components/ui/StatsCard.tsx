import React from 'react';

interface StatsCardProps {
    label: string;
    value: string | number | React.ReactNode;
    icon?: React.ReactNode;
    trend?: string;
    color?: 'default' | 'indigo' | 'green' | 'amber' | 'rose';
    compact?: boolean; // New prop for sidebar usage
}

export function StatsCard({ label, value, icon, trend, color = 'default', compact = false }: StatsCardProps) {
    const colorStyles = {
        default: 'border-l-4 border-gray-200',
        indigo: 'border-l-4 border-indigo-400',
        green: 'border-l-4 border-green-400',
        amber: 'border-l-4 border-amber-400',
        rose: 'border-l-4 border-rose-400',
    };

    return (
        <div className={`card ${compact ? 'p-3' : 'p-4'} flex items-start justify-between ${colorStyles[color]} hover:shadow-md transition-shadow h-full`}>
            <div className="min-w-0">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 opacity-80">{label}</p>
                <div className={`${compact ? 'text-xl' : 'text-2xl'} font-bold text-gray-900 truncate pr-1`}>{value}</div>
                {trend && (
                    <p className="text-xs text-gray-400 mt-1">{trend}</p>
                )}
            </div>
            {icon && (
                <div className={`p-1.5 bg-gray-50 rounded-lg text-gray-400 shrink-0 ${compact ? 'scale-90' : ''}`}>
                    {icon}
                </div>
            )}
        </div>
    );
}

export function StatsGrid({ children, className }: { children: React.ReactNode, className?: string }) {
    return (
        <div className={`grid grid-cols-1 gap-3 mb-6 ${className || 'sm:grid-cols-2 lg:grid-cols-4'}`}>
            {children}
        </div>
    );
}
