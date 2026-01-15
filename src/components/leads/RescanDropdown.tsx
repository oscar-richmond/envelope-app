'use client';

import { useState, useRef, useEffect } from 'react';
import { RefreshCw, ChevronDown, Globe, Landmark, Check } from 'lucide-react';

export type RescanScope = 'missing' | 'stale' | 'all';
export type RescanTypes = 'web' | 'fin' | 'both';

interface RescanOption {
    id: string;
    label: string;
    description: string;
    scope: RescanScope;
    types: RescanTypes;
    icon?: React.ReactNode;
}

const RESCAN_OPTIONS: RescanOption[] = [
    {
        id: 'scan-missing',
        label: 'Scan Missing',
        description: 'Only companies that have never been scanned',
        scope: 'missing',
        types: 'both'
    },
    {
        id: 'rescan-stale',
        label: 'Rescan Stale',
        description: 'Only companies with outdated data',
        scope: 'stale',
        types: 'both'
    },
    {
        id: 'rescan-all',
        label: 'Rescan All',
        description: 'Force rescan everything',
        scope: 'all',
        types: 'both'
    }
];

const TYPE_SPECIFIC_OPTIONS: RescanOption[] = [
    {
        id: 'web-only',
        label: 'Web Health Only',
        description: 'Rescan website health for all',
        scope: 'all',
        types: 'web',
        icon: <Globe size={14} />
    },
    {
        id: 'fin-only',
        label: 'Financials Only',
        description: 'Rescan financial data for all',
        scope: 'all',
        types: 'fin',
        icon: <Landmark size={14} />
    }
];

interface RescanDropdownProps {
    totalCount: number;
    missingCount?: number;
    staleCount?: number;
    onScan: (scope: RescanScope, types: RescanTypes) => void;
    isScanning: boolean;
    progress?: { current: number; total: number };
    lastScannedLabel?: string;
}

export default function RescanDropdown({
    totalCount,
    missingCount,
    staleCount,
    onScan,
    isScanning,
    progress,
    lastScannedLabel
}: RescanDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Close on ESC
    useEffect(() => {
        function handleEscape(event: KeyboardEvent) {
            if (event.key === 'Escape') setIsOpen(false);
        }
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, []);

    const handleOptionClick = (option: RescanOption) => {
        setIsOpen(false);
        onScan(option.scope, option.types);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Main Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                disabled={isScanning || totalCount === 0}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all"
                style={{
                    background: isScanning ? 'var(--brand)' : 'var(--bg-card)',
                    color: isScanning ? 'white' : 'var(--text-primary)',
                    border: isScanning ? 'none' : '1px solid var(--border-default)',
                    cursor: isScanning ? 'wait' : 'pointer',
                    opacity: totalCount === 0 ? 0.5 : 1
                }}
            >
                <RefreshCw size={16} className={isScanning ? 'animate-spin' : ''} />
                {isScanning && progress ? (
                    <span>Rescanning {progress.current}/{progress.total}...</span>
                ) : (
                    <>
                        <span>Rescan</span>
                        <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </>
                )}
            </button>

            {/* Last scanned hint */}
            {lastScannedLabel && !isScanning && (
                <div
                    className="absolute -bottom-5 left-0 text-[10px] whitespace-nowrap"
                    style={{ color: 'var(--text-muted)' }}
                >
                    {lastScannedLabel}
                </div>
            )}

            {/* Dropdown Menu */}
            {isOpen && !isScanning && (
                <div
                    className="absolute top-full mt-2 right-0 z-50 w-72 py-2 rounded-xl shadow-lg animate-in fade-in slide-in-from-top-2 duration-150"
                    style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-default)',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.12)'
                    }}
                >
                    {/* Main options */}
                    {RESCAN_OPTIONS.map((option) => (
                        <button
                            key={option.id}
                            onClick={() => handleOptionClick(option)}
                            className="w-full px-4 py-3 text-left hover:bg-[var(--bg-card-muted)] transition-colors"
                        >
                            <div className="flex items-center justify-between">
                                <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                                    {option.label}
                                    {option.scope === 'missing' && missingCount !== undefined && missingCount > 0 && (
                                        <span
                                            className="ml-2 text-xs font-normal"
                                            style={{ color: 'var(--text-muted)' }}
                                        >
                                            ({missingCount})
                                        </span>
                                    )}
                                    {option.scope === 'stale' && staleCount !== undefined && staleCount > 0 && (
                                        <span
                                            className="ml-2 text-xs font-normal"
                                            style={{ color: 'var(--text-muted)' }}
                                        >
                                            ({staleCount})
                                        </span>
                                    )}
                                    {option.scope === 'all' && totalCount > 0 && (
                                        <span
                                            className="ml-2 text-xs font-normal"
                                            style={{ color: 'var(--text-muted)' }}
                                        >
                                            ({totalCount})
                                        </span>
                                    )}
                                </span>
                            </div>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                {option.description}
                            </p>
                        </button>
                    ))}

                    {/* Divider */}
                    <div
                        className="my-2 mx-4 h-px"
                        style={{ background: 'var(--border-soft)' }}
                    />

                    {/* Type-specific options */}
                    <div className="px-4 py-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                            By Type
                        </span>
                    </div>
                    {TYPE_SPECIFIC_OPTIONS.map((option) => (
                        <button
                            key={option.id}
                            onClick={() => handleOptionClick(option)}
                            className="w-full px-4 py-2.5 text-left hover:bg-[var(--bg-card-muted)] transition-colors flex items-center gap-3"
                        >
                            <span style={{ color: 'var(--text-muted)' }}>
                                {option.icon}
                            </span>
                            <div>
                                <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                                    {option.label}
                                </span>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                    {option.description}
                                </p>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
