'use client';

import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
    componentName?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * Error Boundary for Modal Components
 * 
 * Catches render errors and displays a friendly fallback UI
 * instead of crashing the entire application.
 */
export class ModalErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Log error for debugging
        console.error(`[ModalErrorBoundary] Error in ${this.props.componentName || 'component'}:`, error);
        console.error('[ModalErrorBoundary] Component stack:', errorInfo.componentStack);

        // Call custom error handler if provided
        this.props.onError?.(error, errorInfo);
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            // Custom fallback if provided
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default fallback UI
            return (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                    <div
                        className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
                        style={{ background: 'rgba(239, 68, 68, 0.1)' }}
                    >
                        <AlertCircle size={24} style={{ color: 'rgb(239, 68, 68)' }} />
                    </div>
                    <h3
                        className="font-semibold mb-2"
                        style={{ color: 'var(--text-primary)' }}
                    >
                        Something went wrong
                    </h3>
                    <p
                        className="text-sm mb-4 max-w-sm"
                        style={{ color: 'var(--text-secondary)' }}
                    >
                        {this.props.componentName
                            ? `We couldn't load the ${this.props.componentName} section.`
                            : 'An unexpected error occurred.'}
                    </p>
                    {process.env.NODE_ENV === 'development' && this.state.error && (
                        <pre
                            className="text-xs p-3 rounded mb-4 max-w-full overflow-auto text-left"
                            style={{
                                background: 'var(--bg-card-muted)',
                                color: 'var(--text-muted)',
                                maxHeight: '100px'
                            }}
                        >
                            {this.state.error.message}
                        </pre>
                    )}
                    <button
                        onClick={this.handleRetry}
                        className="text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2 transition-all"
                        style={{
                            background: 'var(--bg-card-muted)',
                            color: 'var(--text-secondary)'
                        }}
                    >
                        <RefreshCw size={14} />
                        Try again
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

/**
 * Higher-order component version
 */
export function withErrorBoundary<P extends object>(
    WrappedComponent: React.ComponentType<P>,
    componentName?: string
) {
    const displayName = componentName || WrappedComponent.displayName || WrappedComponent.name || 'Component';

    const ComponentWithBoundary = (props: P) => (
        <ModalErrorBoundary componentName={displayName}>
            <WrappedComponent {...props} />
        </ModalErrorBoundary>
    );

    ComponentWithBoundary.displayName = `withErrorBoundary(${displayName})`;

    return ComponentWithBoundary;
}
