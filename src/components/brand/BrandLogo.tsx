'use client';

import { useState, useEffect } from 'react';

interface BrandLogoProps {
    variant?: 'dark' | 'light';
    height?: number;
    className?: string;
}

/**
 * Robust brand logo component with fallback handling.
 * Uses plain img tag for reliable loading with graceful text fallback on error.
 */
export function BrandLogo({ variant = 'dark', height = 32, className = '' }: BrandLogoProps) {
    const [hasError, setHasError] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    // Logo paths - standardized in /public/brand/
    const logoSrc = variant === 'dark'
        ? '/brand/envelope-logo-dark.png'
        : '/brand/envelope-logo.png';

    // Reset error state if variant changes
    useEffect(() => {
        setHasError(false);
        setIsLoaded(false);
    }, [variant]);

    // Fallback: styled text that matches brand
    if (hasError) {
        return (
            <div
                className={`flex items-center ${className}`}
                style={{ height: `${height}px` }}
            >
                <span
                    className="font-bold tracking-tight"
                    style={{
                        fontFamily: 'var(--font-display), system-ui, sans-serif',
                        fontSize: `${height * 0.6}px`,
                        letterSpacing: '-0.02em',
                        color: variant === 'dark' ? '#1a1a1a' : '#ffffff'
                    }}
                >
                    ENVELOPE
                </span>
            </div>
        );
    }

    return (
        <div className={`relative ${className}`} style={{ height: `${height}px` }}>
            {/* Loading placeholder - prevents layout shift */}
            {!isLoaded && (
                <div
                    className="absolute inset-0 bg-gray-100 rounded animate-pulse"
                    style={{ height: `${height}px`, width: `${height * 3}px` }}
                />
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={logoSrc}
                alt="Envelope"
                height={height}
                style={{
                    height: `${height}px`,
                    width: 'auto',
                    opacity: isLoaded ? 1 : 0,
                    transition: 'opacity 0.2s ease-in-out'
                }}
                onLoad={() => setIsLoaded(true)}
                onError={() => setHasError(true)}
            />
        </div>
    );
}
