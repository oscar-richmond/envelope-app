import React from 'react';
import { Loader2 } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'danger' | 'dark';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
    icon?: React.ReactNode;
    iconRight?: React.ReactNode;
    fullWidth?: boolean;
}

/**
 * Unified Button component - single source of truth for all CTAs.
 * 
 * Variants:
 * - primary: Brand blue background, white text (main CTAs)
 * - secondary: Brand-colored outline (alternative actions)
 * - tertiary: Text only, no border (low emphasis)
 * - ghost: Minimal, subtle background on hover
 * - danger: Red for destructive actions
 * - dark: Dark background (anchor actions like Add, Open)
 * 
 * Sizes:
 * - sm: 36px height
 * - md: 44px height (default)
 * - lg: 52px height
 */
export function Button({
    children,
    className = '',
    variant = 'primary',
    size = 'md',
    loading = false,
    icon,
    iconRight,
    fullWidth = false,
    disabled,
    ...props
}: ButtonProps) {
    const baseClass = 'btn';
    const variantClass = `btn-${variant}`;
    const sizeClass = size !== 'md' ? `btn-${size}` : '';
    const widthClass = fullWidth ? 'w-full' : '';

    return (
        <button
            className={`${baseClass} ${variantClass} ${sizeClass} ${widthClass} ${className}`.trim()}
            disabled={disabled || loading}
            {...props}
        >
            {loading ? (
                <>
                    <Loader2 size={size === 'sm' ? 14 : size === 'lg' ? 18 : 16} className="animate-spin" />
                    {children}
                </>
            ) : (
                <>
                    {icon && <span className="shrink-0">{icon}</span>}
                    {children}
                    {iconRight && <span className="shrink-0">{iconRight}</span>}
                </>
            )}
        </button>
    );
}

// Re-export for convenience
export type { ButtonProps, ButtonVariant, ButtonSize };
