'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    sectionName?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);

        // Send to logging endpoint
        const payload = {
            message: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
            location: window.location.href,
            section: this.props.sectionName || 'unknown',
            timestamp: new Date().toISOString()
        };

        fetch('/api/client-errors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).catch(e => console.error('Failed to report error', e));
    }

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="p-6 bg-red-50 border border-red-100 rounded-lg flex flex-col items-center justify-center text-center min-h-[200px]">
                    <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                        <AlertCircle size={24} />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Something went wrong</h3>
                    <p className="text-sm text-gray-600 mb-6 max-w-sm">
                        {this.props.sectionName
                            ? `We couldn't load the ${this.props.sectionName} section.`
                            : "The application encountered an unexpected error."}
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={() => window.location.reload()}
                            className="btn btn-secondary flex items-center gap-2"
                        >
                            <RefreshCw size={16} />
                            Reload Page
                        </button>
                        <button
                            onClick={() => this.setState({ hasError: false, error: null })}
                            className="btn btn-ghost text-red-600 hover:text-red-700 hover:bg-red-100"
                        >
                            Try Again
                        </button>
                    </div>
                    {/* Safe Debug Info (if needed later, could hide behind debug flag) */}
                </div>
            );
        }

        return this.props.children;
    }
}
