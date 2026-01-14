'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useActionRouter } from './ActionRouter';

interface CTALogEntry {
    name: string;
    target?: string;
    params?: Record<string, any>;
    timestamp: Date;
    status: 'success' | 'error' | 'pending';
    errorMessage?: string;
}

interface CTADebugContextType {
    isEnabled: boolean;
    log: CTALogEntry[];
    addLogEntry: (entry: Omit<CTALogEntry, 'timestamp'>) => void;
    clearLog: () => void;
}

const CTADebugContext = createContext<CTADebugContextType | null>(null);

/**
 * CTA Debug Provider - Only active when NEXT_PUBLIC_CTA_DEBUG=true
 * Provides visual overlay and logging for CTA actions
 */
export function CTADebugProvider({ children }: { children: ReactNode }) {
    const isEnabled = process.env.NEXT_PUBLIC_CTA_DEBUG === 'true';
    const [log, setLog] = useState<CTALogEntry[]>([]);
    const [isOpen, setIsOpen] = useState(false);

    const addLogEntry = (entry: Omit<CTALogEntry, 'timestamp'>) => {
        setLog(prev => [...prev.slice(-50), { ...entry, timestamp: new Date() }]);
    };

    const clearLog = () => setLog([]);

    // Add CSS for hover tooltips in dev mode
    useEffect(() => {
        if (!isEnabled) return;

        const style = document.createElement('style');
        style.id = 'cta-debug-styles';
        style.textContent = `
            [data-cta-name] {
                outline: 2px dashed rgba(147, 51, 234, 0.5) !important;
                outline-offset: 2px;
            }
            [data-cta-name]:hover {
                outline-color: rgba(147, 51, 234, 1) !important;
            }
            [data-cta-name]:hover::after {
                content: attr(data-cta-name) ' → ' attr(data-cta-target);
                position: absolute;
                bottom: 100%;
                left: 0;
                background: #1f2937;
                color: white;
                padding: 4px 8px;
                font-size: 11px;
                border-radius: 4px;
                white-space: nowrap;
                z-index: 10000;
                pointer-events: none;
            }
        `;
        document.head.appendChild(style);

        return () => {
            document.getElementById('cta-debug-styles')?.remove();
        };
    }, [isEnabled]);

    if (!isEnabled) {
        return <>{children}</>;
    }

    return (
        <CTADebugContext.Provider value={{ isEnabled, log, addLogEntry, clearLog }}>
            {children}

            {/* Debug Panel Toggle */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-4 right-4 z-[10000] bg-purple-600 text-white px-3 py-2 rounded-lg shadow-lg text-xs font-mono"
            >
                CTA Debug ({log.length})
            </button>

            {/* Debug Panel */}
            {isOpen && (
                <div className="fixed bottom-16 right-4 z-[10000] w-96 max-h-[400px] bg-gray-900 text-white rounded-lg shadow-2xl overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700">
                        <span className="font-mono text-xs font-bold">CTA Debug Log</span>
                        <div className="flex gap-2">
                            <button
                                onClick={clearLog}
                                className="text-xs text-gray-400 hover:text-white"
                            >
                                Clear
                            </button>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-xs text-gray-400 hover:text-white"
                            >
                                ×
                            </button>
                        </div>
                    </div>
                    <div className="overflow-y-auto max-h-[350px] p-2 space-y-1">
                        {log.length === 0 ? (
                            <p className="text-gray-500 text-xs text-center py-4">No CTA actions logged yet</p>
                        ) : (
                            log.slice().reverse().map((entry, i) => (
                                <div
                                    key={i}
                                    className={`p-2 rounded text-xs font-mono ${entry.status === 'error' ? 'bg-red-900/50' :
                                            entry.status === 'pending' ? 'bg-yellow-900/50' :
                                                'bg-green-900/50'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold">{entry.name}</span>
                                        <span className="text-gray-400">
                                            {entry.timestamp.toLocaleTimeString()}
                                        </span>
                                    </div>
                                    {entry.target && (
                                        <div className="text-gray-400">→ {entry.target}</div>
                                    )}
                                    {entry.params && (
                                        <pre className="text-gray-500 text-[10px] mt-1 overflow-x-auto">
                                            {JSON.stringify(entry.params, null, 2)}
                                        </pre>
                                    )}
                                    {entry.errorMessage && (
                                        <div className="text-red-400 mt-1">{entry.errorMessage}</div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </CTADebugContext.Provider>
    );
}

/**
 * Hook to log CTA actions in debug mode
 */
export function useCTADebug() {
    const context = useContext(CTADebugContext);

    // Return no-op functions if not in debug mode
    if (!context) {
        return {
            isEnabled: false,
            logAction: () => { },
            logSuccess: () => { },
            logError: () => { }
        };
    }

    return {
        isEnabled: context.isEnabled,
        logAction: (name: string, target?: string, params?: Record<string, any>) => {
            context.addLogEntry({ name, target, params, status: 'pending' });
        },
        logSuccess: (name: string, target?: string, params?: Record<string, any>) => {
            context.addLogEntry({ name, target, params, status: 'success' });
        },
        logError: (name: string, errorMessage: string, params?: Record<string, any>) => {
            context.addLogEntry({ name, params, status: 'error', errorMessage });
        }
    };
}
