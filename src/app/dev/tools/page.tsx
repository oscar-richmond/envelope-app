'use client';

/**
 * Developer Tools Page
 * 
 * Admin-only page with debugging and reset tools.
 * Only visible when ENABLE_DEV_TOOLS=1
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    RefreshCw,
    AlertTriangle,
    CheckCircle,
    Database,
    Trash2,
    Shield,
    Activity,
    ExternalLink
} from 'lucide-react';

interface ResetPreview {
    totals: {
        companies: number;
        scanJobs: number;
    };
    withDerivedData: {
        websiteHealth: number;
        financialHealth: number;
    };
    isProduction: boolean;
    productionResetAllowed: boolean;
}

export default function DevToolsPage() {
    const [preview, setPreview] = useState<ResetPreview | null>(null);
    const [loading, setLoading] = useState(true);
    const [resetting, setResetting] = useState(false);
    const [resetResult, setResetResult] = useState<any>(null);
    const [confirmText, setConfirmText] = useState('');
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchPreview = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/reset-derived-data');
            if (!res.ok) {
                if (res.status === 401) {
                    setError('Unauthorized - please sign in as admin');
                    return;
                }
                throw new Error('Failed to fetch');
            }
            const data = await res.json();
            setPreview(data);
            setError(null);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPreview();
    }, []);

    const handleDryRun = async () => {
        setResetting(true);
        setResetResult(null);
        try {
            const res = await fetch('/api/admin/reset-derived-data?dryRun=1', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scope: 'all' })
            });
            const result = await res.json();
            setResetResult(result);
        } catch (e: any) {
            setResetResult({ error: e.message });
        } finally {
            setResetting(false);
        }
    };

    const handleReset = async () => {
        if (confirmText !== 'RESET') {
            alert('Please type RESET to confirm');
            return;
        }

        setResetting(true);
        setResetResult(null);
        setShowConfirmModal(false);
        setConfirmText('');

        try {
            const res = await fetch('/api/admin/reset-derived-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scope: 'all',
                    confirm: 'RESET_DERIVED_DATA'
                })
            });
            const result = await res.json();
            setResetResult(result);
            if (result.success) {
                fetchPreview(); // Refresh counts
            }
        } catch (e: any) {
            setResetResult({ error: e.message });
        } finally {
            setResetting(false);
        }
    };

    return (
        <div className="min-h-screen p-8" style={{ background: 'var(--bg-page)', color: 'var(--text-primary)' }}>
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-3 mb-8">
                    <Database size={28} className="text-blue-600" />
                    <div>
                        <h1 className="text-2xl font-bold">Developer Tools</h1>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            Admin debugging and data management
                        </p>
                    </div>
                </div>

                {/* Error state */}
                {error && (
                    <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">
                        {error}
                    </div>
                )}

                {/* Quick Links */}
                <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Link
                        href="/dev/website-health-mismatches"
                        className="p-4 rounded-lg flex items-center gap-3 hover:shadow-md transition"
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)' }}
                    >
                        <Activity size={20} className="text-amber-600" />
                        <div>
                            <div className="font-medium">Mismatch Detector</div>
                            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Check schema consistency</div>
                        </div>
                        <ExternalLink size={14} className="ml-auto" style={{ color: 'var(--text-muted)' }} />
                    </Link>

                    <Link
                        href="/api/test/website-health-dual-write"
                        target="_blank"
                        className="p-4 rounded-lg flex items-center gap-3 hover:shadow-md transition"
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)' }}
                    >
                        <CheckCircle size={20} className="text-green-600" />
                        <div>
                            <div className="font-medium">Integration Test</div>
                            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Run dual-write tests</div>
                        </div>
                        <ExternalLink size={14} className="ml-auto" style={{ color: 'var(--text-muted)' }} />
                    </Link>

                    <Link
                        href="/api/admin/heal-website-health-mismatches"
                        target="_blank"
                        className="p-4 rounded-lg flex items-center gap-3 hover:shadow-md transition"
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)' }}
                    >
                        <RefreshCw size={20} className="text-blue-600" />
                        <div>
                            <div className="font-medium">Heal API</div>
                            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Sync mismatched fields</div>
                        </div>
                        <ExternalLink size={14} className="ml-auto" style={{ color: 'var(--text-muted)' }} />
                    </Link>
                </div>

                {/* Reset Derived Data Section */}
                <div
                    className="p-6 rounded-lg mb-6"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)' }}
                >
                    <div className="flex items-center gap-2 mb-4">
                        <Trash2 size={20} className="text-red-600" />
                        <h2 className="text-lg font-semibold">Reset Derived Scan Data</h2>
                    </div>

                    {/* Safety notice */}
                    <div
                        className="p-3 rounded-lg mb-4 flex items-start gap-2"
                        style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)' }}
                    >
                        <Shield size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-green-800">
                            <strong>Safe operation:</strong> Only clears website health, financial health, and scan caches.
                            Does NOT delete users, leads, emails, contacts, drafts, or threads.
                        </div>
                    </div>

                    {/* Preview data */}
                    {loading ? (
                        <div className="flex items-center gap-2 text-gray-500">
                            <RefreshCw size={16} className="animate-spin" />
                            Loading preview...
                        </div>
                    ) : preview && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <div className="p-3 rounded-lg" style={{ background: 'var(--bg-card-muted)' }}>
                                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Companies</div>
                                <div className="text-xl font-bold">{preview.totals.companies}</div>
                            </div>
                            <div className="p-3 rounded-lg" style={{ background: 'var(--bg-card-muted)' }}>
                                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>With Web Health</div>
                                <div className="text-xl font-bold text-blue-600">{preview.withDerivedData.websiteHealth}</div>
                            </div>
                            <div className="p-3 rounded-lg" style={{ background: 'var(--bg-card-muted)' }}>
                                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>With Fin Health</div>
                                <div className="text-xl font-bold text-amber-600">{preview.withDerivedData.financialHealth}</div>
                            </div>
                            <div className="p-3 rounded-lg" style={{ background: 'var(--bg-card-muted)' }}>
                                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Scan Jobs</div>
                                <div className="text-xl font-bold">{preview.totals.scanJobs}</div>
                            </div>
                        </div>
                    )}

                    {/* Production warning */}
                    {preview?.isProduction && (
                        <div
                            className="p-3 rounded-lg mb-4 flex items-start gap-2"
                            style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                        >
                            <AlertTriangle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
                            <div className="text-sm text-red-800">
                                <strong>Production environment detected.</strong> Reset is {preview.productionResetAllowed ? 'allowed' : 'blocked'}.
                            </div>
                        </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleDryRun}
                            disabled={resetting || loading}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition"
                            style={{
                                background: 'rgba(59, 130, 246, 0.1)',
                                border: '1px solid rgba(59, 130, 246, 0.3)',
                                color: 'rgb(37, 99, 235)'
                            }}
                        >
                            {resetting ? <RefreshCw size={16} className="animate-spin" /> : <Database size={16} />}
                            {resetting ? 'Running...' : 'Preview (Dry Run)'}
                        </button>

                        <button
                            onClick={() => setShowConfirmModal(true)}
                            disabled={resetting || loading || (preview?.isProduction && !preview?.productionResetAllowed)}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition"
                            style={{
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                color: 'rgb(220, 38, 38)',
                                opacity: (preview?.isProduction && !preview?.productionResetAllowed) ? 0.5 : 1
                            }}
                        >
                            <Trash2 size={16} />
                            Reset Derived Data
                        </button>

                        <button
                            onClick={fetchPreview}
                            disabled={loading}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg transition"
                            style={{ color: 'var(--text-muted)' }}
                        >
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                {/* Result display */}
                {resetResult && (
                    <div
                        className="p-4 rounded-lg"
                        style={{
                            background: resetResult.error ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                            border: resetResult.error ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(34, 197, 94, 0.3)'
                        }}
                    >
                        {resetResult.error ? (
                            <div className="text-red-700">
                                <strong>Error:</strong> {resetResult.error}
                                {resetResult.message && <div className="text-sm mt-1">{resetResult.message}</div>}
                            </div>
                        ) : (
                            <div>
                                <div className="font-semibold mb-2 flex items-center gap-2">
                                    {resetResult.dryRun ? (
                                        <>🔍 Dry Run Preview</>
                                    ) : (
                                        <><CheckCircle size={18} className="text-green-600" /> Reset Complete</>
                                    )}
                                </div>
                                <div className="text-sm space-y-1">
                                    <div>Companies affected: <strong>{resetResult.companiesAffected}</strong></div>
                                    <div>Time: {resetResult.timeMs}ms</div>
                                </div>
                                {resetResult.safetyNote && (
                                    <div className="text-xs mt-2 text-gray-600 italic">{resetResult.safetyNote}</div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Confirm Modal */}
                {showConfirmModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div
                            className="p-6 rounded-lg max-w-md w-full mx-4"
                            style={{ background: 'var(--bg-card)' }}
                        >
                            <div className="flex items-center gap-2 mb-4 text-red-600">
                                <AlertTriangle size={24} />
                                <h3 className="text-lg font-bold">Confirm Reset</h3>
                            </div>

                            <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                This will reset all derived scan data for <strong>{preview?.totals.companies}</strong> companies.
                                Core data (leads, emails, contacts) will NOT be affected.
                            </p>

                            <label className="block mb-2 text-sm font-medium">
                                Type <code className="bg-red-100 px-1 rounded text-red-700">RESET</code> to confirm:
                            </label>
                            <input
                                type="text"
                                value={confirmText}
                                onChange={(e) => setConfirmText(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border mb-4"
                                style={{ borderColor: 'var(--border-default)' }}
                                placeholder="RESET"
                            />

                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowConfirmModal(false);
                                        setConfirmText('');
                                    }}
                                    className="flex-1 px-4 py-2 rounded-lg font-medium"
                                    style={{ background: 'var(--bg-card-muted)' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleReset}
                                    disabled={confirmText !== 'RESET'}
                                    className="flex-1 px-4 py-2 rounded-lg font-medium text-white transition"
                                    style={{
                                        background: confirmText === 'RESET' ? 'rgb(220, 38, 38)' : 'rgb(156, 163, 175)',
                                        cursor: confirmText === 'RESET' ? 'pointer' : 'not-allowed'
                                    }}
                                >
                                    Reset Data
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
