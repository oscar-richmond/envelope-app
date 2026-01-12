import React from 'react';

interface HeroSurfaceProps {
    children: React.ReactNode;
    variant?: 'brand' | 'lilac' | 'mint' | 'default';
    className?: string;
    padding?: 'sm' | 'md' | 'lg';
}

/**
 * HeroSurface - Nav-inspired premium container.
 * 
 * Uses the sidebar nav's gradient language applied to white backgrounds:
 * - Subtle multi-color gradient background
 * - Soft glow blobs (brand blue + lilac)
 * - Tinted border accent
 * - Inner highlight
 * 
 * Use for:
 * - Dashboard Quick Actions
 * - Inbox Review Queue CTA
 * - Company overview header
 * - Any "spotlight" container
 */
export function HeroSurface({
    children,
    variant = 'default',
    className = '',
    padding = 'md'
}: HeroSurfaceProps) {
    const variantClass = variant !== 'default' ? `hero-surface-${variant}` : '';

    const paddingClasses = {
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8'
    };

    return (
        <div className={`hero-surface ${variantClass} ${paddingClasses[padding]} ${className}`}>
            {children}
        </div>
    );
}

export default HeroSurface;
