'use client';

import React, { useState, useCallback } from 'react';
import { IconButton, IconButtonProps } from './IconButton';
import { toast } from 'sonner';

export interface ActionIconButtonProps extends Omit<IconButtonProps, 'loading' | 'onClick'> {
    /** The async action to perform */
    onAction: () => Promise<void>;
    /** Toast message on success (optional) */
    successMessage?: string;
    /** Fallback error message */
    errorMessage?: string;
    /** Name of the action (for CTA debug mode) */
    actionName?: string;
    /** Target type for CTA debug (modal/route/api) */
    actionTarget?: 'modal' | 'route' | 'api';
    /** Relevant IDs for CTA debug */
    actionParams?: Record<string, any>;
    /** If true, shows a confirmation dialog before action */
    confirmMessage?: string;
    /** Called when action completes */
    onComplete?: (success: boolean, error?: Error) => void;
}

/**
 * ActionIconButton - IconButton wrapper with built-in async action handling.
 * 
 * Features:
 * - Auto-loading state while action runs
 * - Double-click protection
 * - Error toast on failure
 * - Optional success toast
 * - CTA debug mode support
 */
export function ActionIconButton({
    onAction,
    successMessage,
    errorMessage = 'Action failed — please try again',
    actionName,
    actionTarget,
    actionParams,
    confirmMessage,
    onComplete,
    disabled,
    ...iconButtonProps
}: ActionIconButtonProps) {
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
                toast.success(successMessage);
            }

            onComplete?.(true);
        } catch (error: any) {
            console.error(`[ActionIconButton] ${actionName || 'Action'} failed:`, error);

            const message = error?.message || errorMessage;
            toast.error(message, {
                action: {
                    label: 'Retry',
                    onClick: () => handleClick()
                }
            });

            onComplete?.(false, error);
        } finally {
            setIsLoading(false);
        }
    }, [onAction, isLoading, successMessage, errorMessage, confirmMessage, actionName, onComplete]);

    // CTA Debug Mode attributes
    const debugAttrs = process.env.NEXT_PUBLIC_CTA_DEBUG === 'true' ? {
        'data-cta-name': actionName,
        'data-cta-target': actionTarget,
        'data-cta-params': actionParams ? JSON.stringify(actionParams) : undefined,
    } : {};

    return (
        <IconButton
            {...iconButtonProps}
            {...debugAttrs}
            loading={isLoading}
            disabled={disabled || isLoading}
            onClick={handleClick}
        />
    );
}

// Re-export types
export type { ActionIconButtonProps };
