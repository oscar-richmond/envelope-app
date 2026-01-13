'use client';

import { useState } from 'react';
import Image from 'next/image';

interface BrandLogoProps {
    variant?: 'dark' | 'light';
    height?: number;
    className?: string;
}

/**
 * Simple, reliable brand logo component.
 * Uses Next.js Image with priority loading for instant display.
 * Falls back to text if image fails.
 */
export function BrandLogo({ variant = 'dark', height = 32, className = '' }: BrandLogoProps) {
    const [hasError, setHasError] = useState(false);

    // Compute width based on aspect ratio (logo is ~4:1)
    const width = Math.round(height * 4);

    // Logo paths - standardized in /public/brand/
    const logoSrc = variant === 'dark'
        ? '/brand/envelope-logo-dark.png'
        : '/brand/envelope-logo.png';

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
        <Image
            src={logoSrc}
            alt="Envelope"
            width={width}
            height={height}
            priority
            className={className}
            style={{
                height: `${height}px`,
                width: 'auto',
                objectFit: 'contain'
            }}
            onError={() => setHasError(true)}
        />
    );
}
