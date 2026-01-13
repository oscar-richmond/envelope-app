'use client';

/**
 * Phase 6: Convert Button Component
 * Runs full lead conversion pipeline with progress
 */

import React, { useState } from 'react';

interface ConvertButtonProps {
    companyName: string;
    domain: string;
    website?: string;
    onComplete?: (result: ConversionResult) => void;
    variant?: 'primary' | 'secondary';
    size?: 'sm' | 'md' | 'lg';
}

interface ConversionResult {
    success: boolean;
    opportunityScore?: {
        total: number;
        need: number;
        ability: number;
        confidence: number;
    };
    recommendedAction?: {
        type: string;
        label: string;
    };
    contacts?: Array<{
        email: string;
        name?: string;
        verified?: boolean;
    }>;
}

export function ConvertButton({
    companyName,
    domain,
    website,
    onComplete,
    variant = 'primary',
    size = 'md',
}: ConvertButtonProps) {
    const [status, setStatus] = useState<'idle' | 'converting' | 'done' | 'error'>('idle');
    const [progress, setProgress] = useState('');

    const handleConvert = async () => {
        setStatus('converting');
        setProgress('Discovering...');

        try {
            const res = await fetch('/api/prospects/convert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    companyName,
                    domain,
                    website,
                }),
            });

            const data = await res.json();

            if (!data.success) {
                throw new Error(data.error || 'Conversion failed');
            }

            setStatus('done');
            setProgress('');
            onComplete?.(data);

            // Reset after 3s
            setTimeout(() => setStatus('idle'), 3000);

        } catch (err) {
            console.error('Convert error:', err);
            setStatus('error');
            setProgress('');
            setTimeout(() => setStatus('idle'), 3000);
        }
    };

    const sizeClasses = {
        sm: 'px-3 py-1.5 text-xs',
        md: 'px-4 py-2 text-sm',
        lg: 'px-6 py-3 text-base',
    };

    const variantClasses = {
        primary: 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700',
        secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
    };

    const statusText = {
        idle: 'Convert to Lead',
        converting: progress || 'Converting...',
        done: '✓ Converted',
        error: 'Failed',
    };

    const isDisabled = status === 'converting';

    return (
        <button
            onClick={handleConvert}
            disabled={isDisabled}
            className={`
        inline-flex items-center justify-center gap-2 
        ${sizeClasses[size]} 
        ${status === 'done' ? 'bg-green-500 text-white' : status === 'error' ? 'bg-red-500 text-white' : variantClasses[variant]}
        font-semibold rounded-lg transition-all
        disabled:opacity-50 disabled:cursor-not-allowed
      `}
        >
            {status === 'converting' && (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
            )}
            {statusText[status]}
        </button>
    );
}
