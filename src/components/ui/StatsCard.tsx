import React from 'react';

interface StatsCardProps {
    label: string;
    value: string | number;
    icon?: React.ReactNode;
    trend?: string;
    color?: 'default' | 'indigo' | 'green' | 'amber' | 'rose';
}

export function StatsCard({ label, value, icon, trend, color = 'default' }: StatsCardProps) {
    const colorStyles = {
        default: 'border-l-4 border-gray-200',
        indigo: 'border-l-4 border-indigo-400',
        green: 'border-l-4 border-green-400',
        amber: 'border-l-4 border-amber-400',
        rose: 'border-l-4 border-rose-400',
    };

    return (
        <div className={`card p-4 flex items-start justify-between ${colorStyles[color]} hover:shadow-md transition-shadow`}>
            <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
                <div className="text-2xl font-bold text-gray-900">{value}</div>
                {trend && (
                    <p className="text-xs text-gray-400 mt-1">{trend}</p>
                )}
            </div>
            {icon && (
                <div className="p-2 bg-gray-50 rounded-lg text-gray-400">
                    {icon}
                </div>
            )}
        </div>
    );
}

export function StatsGrid({ children }: { children: React.ReactNode }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {children}
        </div>
    );
}
