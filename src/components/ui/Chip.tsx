import React from 'react';

type ChipVariant = 'solid' | 'outline';
type ChipColor = 'mint' | 'lilac' | 'danger' | 'warning' | 'info' | 'neutral' | 'brand' | 'success';
type ChipSize = 'sm' | 'md';

interface ChipProps {
    variant?: ChipVariant;
    color?: ChipColor;
    size?: ChipSize;
    icon?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}

/**
 * Chip - Unified status pills and badges.
 * 
 * Variants:
 * - solid: Tinted background (default)
 * - outline: Border only
 * 
 * Colors:
 * - mint/success: Green (positive states)
 * - lilac/info: Purple (info/highlighted)
 * - warning: Amber/orange (caution)
 * - danger: Red (error/destructive)
 * - neutral: Gray (inactive/default)
 * - brand: Blue (brand color)
 */
export function Chip({
    variant = 'solid',
    color = 'neutral',
    size = 'md',
    icon,
    children,
    className = '',
}: ChipProps) {
    // Map success to mint for consistency
    const resolvedColor = color === 'success' ? 'mint' : color;

    const baseClasses = 'inline-flex items-center font-semibold rounded-full whitespace-nowrap';

    const sizeClasses = {
        sm: 'text-[10px] px-2 py-0.5 gap-1',
        md: 'text-xs px-3 py-1 gap-1.5',
    };

    // Color mappings for solid variant
    const solidColors: Record<string, string> = {
        mint: 'bg-[var(--mint-soft)] text-[var(--mint-text)] border border-[var(--chip-mint-border)]',
        lilac: 'bg-[var(--lilac-soft)] text-[var(--lilac-text)] border border-[var(--chip-lilac-border)]',
        danger: 'bg-[var(--danger-soft)] text-[var(--danger-text)] border border-[var(--chip-danger-border)]',
        warning: 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border border-transparent',
        info: 'bg-[var(--status-info-bg)] text-[var(--status-info-text)] border border-transparent',
        neutral: 'bg-[var(--chip-neutral-bg)] text-[var(--chip-neutral-text)] border border-[var(--chip-neutral-border)]',
        brand: 'bg-[var(--brand-soft)] text-[var(--brand)] border border-[var(--brand-border)]',
    };

    // Color mappings for outline variant  
    const outlineColors: Record<string, string> = {
        mint: 'bg-transparent text-[var(--mint-text)] border border-[var(--mint-text)]',
        lilac: 'bg-transparent text-[var(--lilac-text)] border border-[var(--lilac-text)]',
        danger: 'bg-transparent text-[var(--danger-text)] border border-[var(--danger-text)]',
        warning: 'bg-transparent text-[var(--status-warning-text)] border border-[var(--status-warning-text)]',
        info: 'bg-transparent text-[var(--status-info-text)] border border-[var(--status-info-text)]',
        neutral: 'bg-transparent text-[var(--text-secondary)] border border-[var(--border-default)]',
        brand: 'bg-transparent text-[var(--brand)] border border-[var(--brand)]',
    };

    const colorClasses = variant === 'outline' ? outlineColors[resolvedColor] : solidColors[resolvedColor];

    return (
        <span className={`${baseClasses} ${sizeClasses[size]} ${colorClasses} ${className}`}>
            {icon && <span className="shrink-0">{icon}</span>}
            {children}
        </span>
    );
}

// Re-export types
export type { ChipProps, ChipVariant, ChipColor, ChipSize };
