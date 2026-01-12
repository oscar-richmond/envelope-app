import React from 'react';
import { Loader2 } from 'lucide-react';

type IconButtonVariant = 'default' | 'ghost' | 'lilac' | 'mint' | 'danger' | 'brand';
type IconButtonSize = 'sm' | 'md' | 'lg';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: IconButtonVariant;
    size?: IconButtonSize;
    loading?: boolean;
    icon: React.ReactNode;
    label: string; // Required for accessibility
}

/**
 * IconButton - Circular/square icon-only button with accessibility built-in.
 * 
 * Variants:
 * - default: White with gray border
 * - ghost: Transparent, subtle hover
 * - lilac: Purple tint (for active/highlighted state)
 * - mint: Green tint
 * - danger: Red tint (delete/destructive)
 * - brand: Blue tint
 * 
 * Sizes:
 * - sm: 32px
 * - md: 40px (default)
 * - lg: 48px
 */
export function IconButton({
    variant = 'default',
    size = 'md',
    loading = false,
    icon,
    label,
    className = '',
    disabled,
    ...props
}: IconButtonProps) {
    const baseClass = 'icon-btn';
    const variantClass = variant !== 'default' ? `icon-btn-${variant}` : '';
    const sizeClass = size !== 'md' ? `icon-btn-${size}` : '';

    const iconSize = size === 'sm' ? 14 : size === 'lg' ? 20 : 18;

    return (
        <button
            className={`${baseClass} ${variantClass} ${sizeClass} ${className}`.trim()}
            disabled={disabled || loading}
            aria-label={label}
            title={label}
            {...props}
        >
            {loading ? (
                <Loader2 size={iconSize} className="animate-spin" />
            ) : (
                icon
            )}
        </button>
    );
}

// Re-export types
export type { IconButtonProps, IconButtonVariant, IconButtonSize };
