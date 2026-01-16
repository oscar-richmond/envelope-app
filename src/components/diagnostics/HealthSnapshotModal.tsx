/**
 * Health Snapshot Modal
 * 
 * Displays comprehensive diagnostics for Website Health (DB + API + diagnosis).
 */

'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface Props {
    companyId: number;
    onClose: () => void;
}

export function HealthSnapshotModal({ companyId, onClose }: Props) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch(`/api/dev/health-snapshot?companyId=${companyId}`)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then(setData)
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, [companyId]);

    const copyJSON = () => {
        if (!data) return;
        navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        alert('Copied to clipboard!');
    };

    // Auto-diagnosis
    const diagnosis: string[] = [];
    if (data) {
        const canonical = data.db?.websiteHealth;
        const surfaces = data.surfaces;

        if (canonical?.score === null && surfaces?.search?.websiteHealthScore === 0) {
            diagnosis.push('⚠️ Score is null in DB but UI shows 0 (null→0 coercion bug)');
        }

        if (canonical?.score !== null && surfaces?.search?.websiteHealthScore !== canonical?.score) {
            diagnosis.push(`⚠️ Canonical score (${canonical?.score}) differs from Search surface (${surfaces?.search?.websiteHealthScore})`);
        }

        if (canonical?.error === 'NO_WEBSITE_URL') {
            diagnosis.push('ℹ️ NO_WEBSITE_URL error detected - company has no website');
        }

        if (canonical?.status === 'success' && canonical?.score === 0) {
            diagnosis.push('⚠️ Status is success but score=0 (check scoring model/baseScore)');
        }

        if (canonical?.version !== 2) {
            diagnosis.push(`⚠️ Version mismatch: expected 2, got ${canonical?.version ?? 'null'}`);
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
            <div
                className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Health Snapshot</h2>
                        <p className="text-sm text-gray-500">Company ID: {companyId}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                        {data && (
                            <button
                                onClick={copyJSON}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                                Copy JSON
                            </button>
                        )}
                        <button
                            onClick={async () => {
                                if (!confirm('Force re-run scan?')) return;
                                setLoading(true);
                                try {
                                    /* Determine scan type based on active tab or default to web */
                                    await fetch('/api/scan/website', {
                                        method: 'POST',
                                        body: JSON.stringify({ companyId, force: true, surface: 'snapshot_modal' })
                                    });
                                    // Refresh snapshot
                                    const res = await fetch(`/api/dev/health-snapshot?companyId=${companyId}`);
                                    const json = await res.json();
                                    setData(json);
                                } catch (e) {
                                    alert('Scan failed: ' + e.message);
                                } finally {
                                    setLoading(false);
                                }
                            }}
                            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors border border-gray-300"
                        >
                            🔄 Re-Run Scan
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <X size={20} className="text-gray-600" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {loading && (
                        <div className="text-center py-12 text-gray-500">
                            Loading snapshot...
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                            <strong>Error:</strong> {error}
                        </div>
                    )}

                    {data && (
                        <>
                            {/* Diagnosis Section */}
                            {diagnosis.length > 0 && (
                                <section className="bg-yellow-50 border border-yellow-300 rounded-lg p-4">
                                    <h3 className="text-sm font-semibold text-yellow-900 mb-2">⚠️ Auto-Diagnosis</h3>
                                    <ul className="space-y-1 text-sm text-yellow-800">
                                        {diagnosis.map((d, i) => (
                                            <li key={i}>• {d}</li>
                                        ))}
                                    </ul>
                                </section>
                            )}

                            {/* DB Canonical */}
                            <section>
                                <h3 className="text-sm font-semibold text-gray-700 mb-2">DB - Canonical Fields</h3>
                                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs overflow-x-auto font-mono">
                                    {JSON.stringify({
                                        ...data.db?.websiteHealth,
                                        // Highlight forensics
                                        _FORENSICS: {
                                            TRACE: data.db?.websiteHealth?.traceId,
                                            WRITER: data.db?.websiteHealth?.lastWriter,
                                            SURFACE: data.db?.websiteHealth?.lastSurface
                                        }
                                    }, null, 2)}
                                </pre>
                            </section>

                            {/* DB Legacy */}
                            <section>
                                <h3 className="text-sm font-semibold text-gray-700 mb-2">DB - Legacy Fields</h3>
                                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs overflow-x-auto font-mono">
                                    {JSON.stringify({
                                        stalenessScore: data.db?.stalenessScore,
                                        lastAnalysedAt: data.db?.lastAnalysedAt
                                    }, null, 2)}
                                </pre>
                            </section>

                            {/* Stored Report */}
                            {data.db?.webHealthData && (
                                <section>
                                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Stored Report (webHealthData)</h3>
                                    <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs overflow-x-auto font-mono">
                                        {typeof data.db.webHealthData === 'string'
                                            ? data.db.webHealthData
                                            : JSON.stringify(data.db.webHealthData, null, 2)
                                        }
                                    </pre>
                                </section>
                            )}

                            {/* API Surfaces */}
                            <section>
                                <h3 className="text-sm font-semibold text-gray-700 mb-2">API Surface Outputs</h3>
                                <div className="space-y-2">
                                    <div>
                                        <h4 className="text-xs font-semibold text-gray-600 mb-1">Search</h4>
                                        <pre className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs overflow-x-auto font-mono">
                                            {JSON.stringify(data.surfaces?.search, null, 2)}
                                        </pre>
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-semibold text-gray-600 mb-1">Lead Board</h4>
                                        <pre className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs overflow-x-auto font-mono">
                                            {JSON.stringify(data.surfaces?.leadBoard, null, 2)}
                                        </pre>
                                    </div>
                                </div>
                            </section>

                            {/* Validation Checks */}
                            {data.checks && (
                                <section>
                                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Validation Checks</h3>
                                    <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs overflow-x-auto font-mono">
                                        {JSON.stringify(data.checks, null, 2)}
                                    </pre>
                                </section>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
