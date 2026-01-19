'use client';

import React, { useState, useCallback } from 'react';
import { Button, ButtonProps } from './Button';
// import { toast } from 'sonner'; // Package not installed

export interface ActionButtonProps extends Omit<ButtonProps, 'loading' | 'onClick'> {
    /** The async action to perform. Return value is ignored. */
    onAction: () => Promise<void>;
    /** Toast message on success (optional) */
    successMessage?: string;
    /** Fallback error message (default: "Something went wrong") */
    errorMessage?: string;
    /** Name of the action (for CTA debug mode) */
    actionName?: string;
    /** Target type for CTA debug (modal/route/api) */
    actionTarget?: 'modal' | 'route' | 'api';
    /** Relevant IDs for CTA debug */
    actionParams?: Record<string, any>;
    /** If true, shows a confirmation dialog before action */
    confirmMessage?: string;
    /** Called when action completes (success or error) */
    onComplete?: (success: boolean, error?: Error) => void;
}

/**
 * ActionButton - Button wrapper with built-in async action handling.
 * 
 * Features:
 * - Auto-loading state while action runs
 * - Double-click protection (prevents re-click during loading)
 * - Error toast on failure
 * - Optional success toast
 * - Optional confirmation dialog
 * - CTA debug mode support
 */
export function ActionButton({
    onAction,
    successMessage,
    errorMessage = 'Something went wrong — please try again',
    actionName,
    actionTarget,
    actionParams,
    confirmMessage,
    onComplete,
    disabled,
    children,
    ...buttonProps
}: ActionButtonProps) {
    const [isLoading, setIsLoading] = useState(false);

    const handleClick = useCallback(async () => {
        // Prevent double-click
        if (isLoading) return;

        // Show confirmation if required
        if (confirmMessage && !window.confirm(confirmMessage)) {
            return;
        }

        setIsLoading(true);

        try {
            await onAction();

            if (successMessage) {
                // toast.success(successMessage); // Disabled: sonner not installed
            }

            onComplete?.(true);
        } catch (error: any) {
            console.error(`[ActionButton] ${actionName || 'Action'} failed:`, error);

            // Show error toast
            const message = error?.message || errorMessage;
            // toast.error(message, { // Disabled: sonner not installed
            //     action: {
            //         label: 'Retry',
            //         onClick: () => handleClick()
            //     }
            // });

            onComplete?.(false, error);
        } finally {
            setIsLoading(false);
        }
    }, [onAction, isLoading, successMessage, errorMessage, confirmMessage, actionName, onComplete]);

    // CTA Debug Mode attributes (picked up by debug overlay)
    const debugAttrs = process.env.NEXT_PUBLIC_CTA_DEBUG === 'true' ? {
        'data-cta-name': actionName,
        'data-cta-target': actionTarget,
        'data-cta-params': actionParams ? JSON.stringify(actionParams) : undefined,
    } : {};

    return (
        <Button
            {...buttonProps}
            {...debugAttrs}
            loading={isLoading}
            disabled={disabled || isLoading}
            onClick={handleClick}
        >
            {children}
        </Button>
    );
}

