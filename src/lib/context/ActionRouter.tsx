'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// Types for modal actions
export interface ComposeOptions {
    companyId?: number;
    leadId?: number;
    prospectId?: number;
    source?: string;
    initialToEmail?: string;
}

export interface OpenThreadOptions {
    leadId?: number;
    threadId?: string;
    emailId?: number;
}

export interface OpenReportOptions {
    companyId: number;
    reportType: 'web_health' | 'financial_health' | 'contacts';
}

// Context interface
interface ActionRouterContextType {
    // Modal state
    isCompanyProfileOpen: boolean;
    companyProfileId: number | null;

    isComposerOpen: boolean;
    composerOptions: ComposeOptions | null;

    isThreadOpen: boolean;
    threadOptions: OpenThreadOptions | null;

    // Actions
    openCompanyProfile: (companyId: number) => void;
    closeCompanyProfile: () => void;

    openComposer: (options: ComposeOptions) => void;
    closeComposer: () => void;

    openThread: (options: OpenThreadOptions) => void;
    closeThread: () => void;

    // Batch close (used when navigating away)
    closeAllModals: () => void;

    // CTA tracking for debug
    lastAction: { name: string; params: any; timestamp: Date; status: 'success' | 'error' | 'pending' } | null;
    setLastAction: (action: ActionRouterContextType['lastAction']) => void;
}

const ActionRouterContext = createContext<ActionRouterContextType | null>(null);

export function ActionRouterProvider({ children }: { children: ReactNode }) {
    // Company Profile Modal
    const [isCompanyProfileOpen, setIsCompanyProfileOpen] = useState(false);
    const [companyProfileId, setCompanyProfileId] = useState<number | null>(null);

    // Composer Modal
    const [isComposerOpen, setIsComposerOpen] = useState(false);
    const [composerOptions, setComposerOptions] = useState<ComposeOptions | null>(null);

    // Thread Modal
    const [isThreadOpen, setIsThreadOpen] = useState(false);
    const [threadOptions, setThreadOptions] = useState<OpenThreadOptions | null>(null);

    // CTA tracking
    const [lastAction, setLastAction] = useState<ActionRouterContextType['lastAction']>(null);

    // Company Profile actions
    const openCompanyProfile = useCallback((companyId: number) => {
        console.log(`[ActionRouter] Opening company profile: ${companyId}`);
        setCompanyProfileId(companyId);
        setIsCompanyProfileOpen(true);
        setLastAction({
            name: 'openCompanyProfile',
            params: { companyId },
            timestamp: new Date(),
            status: 'success'
        });
    }, []);

    const closeCompanyProfile = useCallback(() => {
        setIsCompanyProfileOpen(false);
        setCompanyProfileId(null);
    }, []);

    // Composer actions
    const openComposer = useCallback((options: ComposeOptions) => {
        console.log(`[ActionRouter] Opening composer:`, options);
        setComposerOptions(options);
        setIsComposerOpen(true);
        setLastAction({
            name: 'openComposer',
            params: options,
            timestamp: new Date(),
            status: 'success'
        });
    }, []);

    const closeComposer = useCallback(() => {
        setIsComposerOpen(false);
        setComposerOptions(null);
    }, []);

    // Thread actions
    const openThread = useCallback((options: OpenThreadOptions) => {
        console.log(`[ActionRouter] Opening thread:`, options);
        setThreadOptions(options);
        setIsThreadOpen(true);
        setLastAction({
            name: 'openThread',
            params: options,
            timestamp: new Date(),
            status: 'success'
        });
    }, []);

    const closeThread = useCallback(() => {
        setIsThreadOpen(false);
        setThreadOptions(null);
    }, []);

    // Close all
    const closeAllModals = useCallback(() => {
        closeCompanyProfile();
        closeComposer();
        closeThread();
    }, [closeCompanyProfile, closeComposer, closeThread]);

    return (
        <ActionRouterContext.Provider
            value={{
                isCompanyProfileOpen,
                companyProfileId,
                isComposerOpen,
                composerOptions,
                isThreadOpen,
                threadOptions,
                openCompanyProfile,
                closeCompanyProfile,
                openComposer,
                closeComposer,
                openThread,
                closeThread,
                closeAllModals,
                lastAction,
                setLastAction
            }}
        >
            {children}
        </ActionRouterContext.Provider>
    );
}

/**
 * Hook to access centralized modal actions
 */
export function useActionRouter() {
    const context = useContext(ActionRouterContext);
    if (!context) {
        throw new Error('useActionRouter must be used within ActionRouterProvider');
    }
    return context;
}

/**
 * Hook to just check if any modal is open (for preventing navigation, etc.)
 */
export function useHasOpenModal() {
    const { isCompanyProfileOpen, isComposerOpen, isThreadOpen } = useActionRouter();
    return isCompanyProfileOpen || isComposerOpen || isThreadOpen;
}
