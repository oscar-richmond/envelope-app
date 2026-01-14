'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';

/**
 * Standardized error state component for company profile modules.
 * Provides consistent error display with retry functionality.
 */

interface ModuleErrorStateProps {
    /** Error message to display */
    message?: string;
    /** Retry handler */
    onRetry?: () => void;
    /** Whether retry is in progress */
    retrying?: boolean;
    /** Custom class name */
    className?: string;
}

export default function ModuleErrorState({
    message = 'Failed to load data',
    onRetry,
    retrying = false,
    className = ''
}: ModuleErrorStateProps) {
    return (
        <div className={`text-center py-8 px-4 ${className}`}>
            <div className="mb-3 flex justify-center">
                <AlertCircle size={32} className="text-red-300" />
            </div>
            <h4 className="text-sm font-semibold text-gray-700 mb-1">
                Something went wrong
            </h4>
            <p className="text-xs text-gray-500 mb-4">
                {message}
            </p>
            {onRetry && (
                <button
                    onClick={onRetry}
                    disabled={retrying}
                    className="btn btn-secondary btn-sm inline-flex items-center gap-2"
                >
                    <RefreshCw size={14} className={retrying ? 'animate-spin' : ''} />
                    {retrying ? 'Retrying...' : 'Try again'}
                </button>
            )}
        </div>
    );
}
