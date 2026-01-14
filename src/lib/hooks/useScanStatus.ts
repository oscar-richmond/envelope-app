'use client';

import { useState, useEffect, useCallback } from 'react';

export type ScanType = 'web_health' | 'financial_health' | 'contacts';
export type ScanStatus = 'idle' | 'not_scanned' | 'queued' | 'running' | 'success' | 'failed';

export interface ScanTypeStatus {
    status: ScanStatus;
    progress?: number;
    lastRunAt: string | null;
    score?: number | null;
    jobId?: string;
    errorMessage?: string;
}

export interface CompanyScanStatus {
    companyId: number;
    web_health: ScanTypeStatus;
    financial_health: ScanTypeStatus;
    contacts: ScanTypeStatus;
}

interface UseScanStatusOptions {
    pollInterval?: number; // ms, default 2000 when active scan
    autoStartPolling?: boolean;
}

/**
 * Hook to manage scan status for a company
 * Provides current status for all scan types and methods to trigger scans
 */
export function useScanStatus(
    companyId: number | undefined,
    options: UseScanStatusOptions = {}
) {
    const { pollInterval = 2000, autoStartPolling = true } = options;

    const [status, setStatus] = useState<CompanyScanStatus | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeJobIds, setActiveJobIds] = useState<Set<string>>(new Set());

    // Fetch current status
    const fetchStatus = useCallback(async () => {
        if (!companyId) return;

        try {
            const res = await fetch(`/api/companies/${companyId}/scans`);
            if (res.ok) {
                const data = await res.json();
                setStatus(data);
                setError(null);

                // Track active jobs for polling
                const activeIds = new Set<string>();
                ['web_health', 'financial_health', 'contacts'].forEach(type => {
                    const typeStatus = data[type];
                    if (typeStatus?.jobId && (typeStatus.status === 'queued' || typeStatus.status === 'running')) {
                        activeIds.add(typeStatus.jobId);
                    }
                });
                setActiveJobIds(activeIds);
            }
        } catch (e: any) {
            console.error('[useScanStatus] Fetch error:', e);
            setError(e.message);
        }
    }, [companyId]);

    // Trigger a scan
    const triggerScan = useCallback(async (
        scanType: ScanType,
        options: { force?: boolean; surface?: string } = {}
    ) => {
        if (!companyId) return null;

        setIsLoading(true);
        setError(null);

        try {
            const res = await fetch(`/api/companies/${companyId}/scans`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scanType,
                    force: options.force || false,
                    surface: options.surface || 'ui'
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to trigger scan');
            }

            // Add to active jobs for polling
            if (data.jobId) {
                setActiveJobIds(prev => new Set([...prev, data.jobId]));
            }

            // Refresh status
            await fetchStatus();

            return data;

        } catch (e: any) {
            console.error('[useScanStatus] Trigger error:', e);
            setError(e.message);
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [companyId, fetchStatus]);

    // Poll for status when there are active jobs
    useEffect(() => {
        if (!autoStartPolling || activeJobIds.size === 0) return;

        const interval = setInterval(() => {
            fetchStatus();
        }, pollInterval);

        return () => clearInterval(interval);
    }, [activeJobIds.size, pollInterval, fetchStatus, autoStartPolling]);

    // Initial fetch
    useEffect(() => {
        if (companyId) {
            fetchStatus();
        }
    }, [companyId, fetchStatus]);

    // Helper to get status for specific scan type
    const getTypeStatus = useCallback((scanType: ScanType): ScanTypeStatus => {
        if (!status) {
            return { status: 'idle', lastRunAt: null };
        }
        return status[scanType] || { status: 'idle', lastRunAt: null };
    }, [status]);

    // Helper to check if any scan is active
    const hasActiveScan = activeJobIds.size > 0;

    // Helper to trigger all scans
    const triggerAllScans = useCallback(async () => {
        const results = await Promise.all([
            triggerScan('web_health'),
            triggerScan('financial_health'),
            triggerScan('contacts')
        ]);
        return results;
    }, [triggerScan]);

    return {
        status,
        isLoading,
        error,
        hasActiveScan,
        triggerScan,
        triggerAllScans,
        getTypeStatus,
        refreshStatus: fetchStatus
    };
}

/**
 * Smaller hook for just checking scan status without trigger capability
 */
export function useScanStatusReadOnly(companyId: number | undefined) {
    const [status, setStatus] = useState<CompanyScanStatus | null>(null);

    useEffect(() => {
        if (!companyId) return;

        fetch(`/api/companies/${companyId}/scans`)
            .then(res => res.json())
            .then(setStatus)
            .catch(console.error);
    }, [companyId]);

    return status;
}
