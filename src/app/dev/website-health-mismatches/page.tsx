'use client';

/**
 * Website Health Mismatch Detector Page
 * 
 * Dev-only page that lists companies where new and legacy
 * schema values diverge, helping identify dual-write issues.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { RefreshCw, AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react';

interface Mismatch {
    id: number;
    companyName: string | null;
    companyNumber: string | null;
    mismatchType: string;
    newFields: {
        status: string | null;
        score: number | null;
        scannedAt: string | null;
    };
    legacyFields: {
        statusInferred: string;
        score: number | null;
        scannedAt: string | null;
    };
}

interface MismatchResponse {
    meta: {
        timestamp: string;
        featureFlag: boolean;
        totalProspects: number;
        mismatchCount: number;
    };
    mismatches: Mismatch[];
}

export default function WebsiteHealthMismatchesPage() {
    const [data, setData] = useState<MismatchResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [healing, setHealing] = useState(false);
    const [healResult, setHealResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const fetchMismatches = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/debug/website-health-mismatches');
            if (!res.ok) throw new Error('Failed to fetch');
            const json = await res.json();
            setData(json);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleHeal = async (dryRun: boolean = false) => {
        setHealing(true);
        setHealResult(null);
        try {
            const res = await fetch('/api/admin/heal-website-health-mismatches', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dryRun, limit: 200 })
            });
            const result = await res.json();
            setHealResult(result);
            if (!dryRun && result.success) {
                // Refresh mismatch list after healing
                await fetchMismatches();
            }
        } catch (e: any) {
            setHealResult({ error: e.message });
        } finally {
            setHealing(false);
        }
    };

    useEffect(() => {
        fetchMismatches();
    }, []);

    return (
        <div className="min-h-screen p-8" style={{ background: 'var(--bg-page)', color: 'var(--text-primary)' }}>
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold mb-1">Website Health Mismatch Detector</h1>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            Companies where new and legacy schema values diverge
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={fetchMismatches}
                            disabled={loading || healing}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition"
                            style={{
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border-default)'
                            }}
                        >
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                            Refresh
                        </button>
                        {data && data.meta.mismatchCount > 0 && (
                            <>
                                <button
                                    onClick={() => handleHeal(true)}
                                    disabled={healing}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition"
                                    style={{
                                        background: 'rgba(251, 191, 36, 0.1)',
                                        border: '1px solid rgba(251, 191, 36, 0.3)',
                                        color: 'rgb(180, 130, 10)'
                                    }}
                                >
                                    {healing ? 'Running...' : 'Preview Heal'}
                                </button>
                                <button
                                    onClick={() => handleHeal(false)}
                                    disabled={healing}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition"
                                    style={{
                                        background: 'rgba(34, 197, 94, 0.1)',
                                        border: '1px solid rgba(34, 197, 94, 0.3)',
                                        color: 'rgb(22, 163, 74)'
                                    }}
                                >
                                    {healing ? 'Healing...' : 'Heal All'}
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Heal result */}
                {healResult && (
                    <div
                        className="mb-8 p-4 rounded-lg"
                        style={{
                            background: healResult.error ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                            border: healResult.error ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(34, 197, 94, 0.3)'
                        }}
                    >
                        {healResult.error ? (
                            <div className="text-red-700">Error: {healResult.error}</div>
                        ) : (
                            <div>
                                <div className="font-semibold mb-2">
                                    {healResult.dryRun ? '🔍 Dry Run Preview' : '✅ Heal Complete'}
                                </div>
                                <div className="text-sm">
                                    Healed: {healResult.summary?.healed || 0} |
                                    Skipped: {healResult.summary?.skipped || 0} |
                                    Errors: {healResult.summary?.errors || 0}
                                </div>
                                {healResult.results?.length > 0 && (
                                    <details className="mt-2">
                                        <summary className="cursor-pointer text-sm text-gray-600">Show details ({healResult.results.length} items)</summary>
                                        <pre className="mt-2 text-xs overflow-auto max-h-48 p-2 rounded bg-white/50">
                                            {JSON.stringify(healResult.results, null, 2)}
                                        </pre>
                                    </details>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Status cards */}
                {data && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                        <div className="p-4 rounded-lg" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)' }}>
                            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Feature Flag</div>
                            <div className={`text-xl font-bold ${data.meta.featureFlag ? 'text-green-600' : 'text-red-600'}`}>
                                {data.meta.featureFlag ? 'NEW' : 'LEGACY'}
                            </div>
                        </div>
                        <div className="p-4 rounded-lg" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)' }}>
                            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Total Prospects</div>
                            <div className="text-xl font-bold">{data.meta.totalProspects}</div>
                        </div>
                        <div className="p-4 rounded-lg" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)' }}>
                            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Mismatches</div>
                            <div className={`text-xl font-bold ${data.meta.mismatchCount > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                                {data.meta.mismatchCount}
                            </div>
                        </div>
                        <div className="p-4 rounded-lg" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)' }}>
                            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Last Check</div>
                            <div className="text-sm font-mono">
                                {new Date(data.meta.timestamp).toLocaleTimeString()}
                            </div>
                        </div>
                    </div>
                )}

                {/* Loading state */}
                {loading && (
                    <div className="text-center py-12">
                        <RefreshCw size={32} className="animate-spin mx-auto mb-4 text-blue-500" />
                        <p>Scanning for mismatches...</p>
                    </div>
                )}

                {/* Error state */}
                {error && (
                    <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">
                        Error: {error}
                    </div>
                )}

                {/* No mismatches */}
                {data && data.mismatches.length === 0 && (
                    <div className="text-center py-12">
                        <CheckCircle size={48} className="mx-auto mb-4 text-green-500" />
                        <h2 className="text-xl font-semibold mb-2">No Mismatches Found</h2>
                        <p style={{ color: 'var(--text-secondary)' }}>
                            All {data.meta.totalProspects} companies have consistent new and legacy values.
                        </p>
                    </div>
                )}

                {/* Mismatch table */}
                {data && data.mismatches.length > 0 && (
                    <div className="overflow-hidden rounded-lg" style={{ border: '1px solid var(--border-soft)' }}>
                        <table className="w-full text-sm">
                            <thead>
                                <tr style={{ background: 'var(--bg-card-muted)' }}>
                                    <th className="text-left p-3 font-semibold">Company</th>
                                    <th className="text-left p-3 font-semibold">Mismatch</th>
                                    <th className="text-left p-3 font-semibold">New Fields</th>
                                    <th className="text-left p-3 font-semibold">Legacy Fields</th>
                                    <th className="text-center p-3 font-semibold">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.mismatches.map((m, i) => (
                                    <tr
                                        key={m.id}
                                        style={{
                                            background: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-card-muted)',
                                            borderTop: '1px solid var(--border-soft)'
                                        }}
                                    >
                                        <td className="p-3">
                                            <div className="font-medium">{m.companyName || 'Unknown'}</div>
                                            <div className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                                                ID: {m.id}
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <span className="flex items-center gap-1 text-amber-600">
                                                <AlertTriangle size={14} />
                                                {m.mismatchType}
                                            </span>
                                        </td>
                                        <td className="p-3 font-mono text-xs">
                                            <div>status: <span className="text-blue-600">{m.newFields.status}</span></div>
                                            <div>score: <span className="text-blue-600">{m.newFields.score}</span></div>
                                        </td>
                                        <td className="p-3 font-mono text-xs">
                                            <div>status: <span className="text-purple-600">{m.legacyFields.statusInferred}</span></div>
                                            <div>score: <span className="text-purple-600">{m.legacyFields.score}</span></div>
                                        </td>
                                        <td className="p-3 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <Link
                                                    href={`/api/debug/website-health?companyId=${m.id}`}
                                                    target="_blank"
                                                    className="p-1.5 rounded hover:bg-blue-100 text-blue-600"
                                                    title="View debug info"
                                                >
                                                    <ExternalLink size={14} />
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
