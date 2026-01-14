'use client';

import { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

/**
 * Standardized empty state component for company profile modules.
 * Provides consistent messaging and CTAs when data is unavailable.
 */

interface ModuleEmptyStateProps {
    /** Icon to display (defaults to Inbox) */
    icon?: ReactNode;
    /** Title text */
    title: string;
    /** Description text */
    description?: string;
    /** Primary CTA button */
    action?: {
        label: string;
        onClick: () => void;
        loading?: boolean;
    };
    /** Optional secondary link */
    secondaryAction?: {
        label: string;
        onClick: () => void;
    };
    /** Custom class name */
    className?: string;
}

export default function ModuleEmptyState({
    icon,
    title,
    description,
    action,
    secondaryAction,
    className = ''
}: ModuleEmptyStateProps) {
    return (
        <div className={`text-center py-8 px-4 ${className}`}>
            <div className="mb-3 flex justify-center">
                {icon || <Inbox size={32} className="text-gray-300" />}
            </div>
            <h4 className="text-sm font-semibold text-gray-700 mb-1">
                {title}
            </h4>
            {description && (
                <p className="text-xs text-gray-500 mb-4 max-w-xs mx-auto">
                    {description}
                </p>
            )}
            {action && (
                <button
                    onClick={action.onClick}
                    disabled={action.loading}
                    className="btn btn-primary btn-sm inline-flex items-center gap-2"
                >
                    {action.loading && (
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    )}
                    {action.label}
                </button>
            )}
            {secondaryAction && (
                <button
                    onClick={secondaryAction.onClick}
                    className="block mx-auto mt-2 text-xs text-indigo-600 hover:underline"
                >
                    {secondaryAction.label}
                </button>
            )}
        </div>
    );
}
