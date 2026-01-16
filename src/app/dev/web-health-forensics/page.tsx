'use client';

import { useState } from 'react';

export default function WebHealthForensicsPage() {
    const [companyId, setCompanyId] = useState('');
    const [snapshot, setSnapshot] = useState<any>(null);
    const [scanResult, setScanResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const loadSnapshot = async () => {
        if (!companyId) {
            setError('Company ID required');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const res = await fetch(`/api/dev/web-health/forensics?companyId=${companyId}`);
            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Failed to load snapshot');
                return;
            }

            setSnapshot(data);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const runScan = async () => {
        if (!companyId) {
            setError('Company ID required');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const res = await fetch(`/api/dev/web-health/forensics-scan?companyId=${companyId}`, {
                method: 'POST'
            });
            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Scan failed');
                setScanResult(data); // Still show partial data
                return;
            }

            setScanResult(data);
            // Auto-refresh snapshot
            await loadSnapshot();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const getMismatchBadge = (val1: any, val2: any) => {
        if (val1 === val2) return null;
        return <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded font-semibold">MISMATCH</span>;
    };

    return (
        <div className="p-8 max-w-[1400px] mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Web Health Forensics</h1>
                <p className="text-gray-600">Debug Website Health data flow - DB → API → UI</p>
            </div>

            {/* Controls */}
            <div className="bg-white rounded-lg border p-6 mb-6">
                <div className="flex gap-4 items-end">
                    <div className="flex-1">
                        <label className="block text-sm font-medium mb-2">Company ID</label>
                        <input
                            type="text"
                            value={companyId}
                            onChange={(e) => setCompanyId(e.target.value)}
                            placeholder="Enter company ID"
                            className="w-full px-3 py-2 border rounded"
                        />
                    </div>
                    <button
                        onClick={loadSnapshot}
                        disabled={loading}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                        {loading ? 'Loading...' : 'Load Snapshot'}
                    </button>
                    <button
                        onClick={runScan}
                        disabled={loading}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                    >
                        {loading ? 'Scanning...' : 'Run Forensics Scan'}
                    </button>
                </div>

                {error && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
                        {error}
                    </div>
                )}
            </div>

            {/* Scan Result */}
            {scanResult && (
                <div className="bg-white rounded-lg border p-6 mb-6">
                    <h2 className="text-xl font-bold mb-4">Scan Result</h2>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <strong>Status:</strong> {scanResult.success ? '✅ Success' : '❌ Failed'}
                        </div>
                        <div>
                            <strong>Duration:</strong> {scanResult.scanDurationMs}ms
                        </div>
                        <div>
                            <strong>Write Trace ID:</strong> <code className="text-xs bg-gray-100 px-1">{scanResult.writeTraceId}</code>
                        </div>
                        {scanResult.validationError && (
                            <div className="col-span-2 p-3 bg-red-50 border border-red-200 rounded">
                                <strong className="text-red-700">Validation Error:</strong>
                                <div className="text-xs mt-1">
                                    Computed: {scanResult.validationError.computed}, Expected: {scanResult.validationError.expected}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {snapshot && (
                <>
                    {/* Feature Flags */}
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                        <h3 className="font-bold mb-2">Feature Flags</h3>
                        <div className="text-sm">
                            <div><strong>FF_NEW_WEBSITE_HEALTH:</strong> {String(snapshot.featureFlags.FF_NEW_WEBSITE_HEALTH)}</div>
                            <div><strong>NEXT_PUBLIC_DEBUG_HEALTH:</strong> {snapshot.featureFlags.NEXT_PUBLIC_DEBUG_HEALTH || 'not set'}</div>
                        </div>
                    </div>

                    {/* DB State */}
                    <div className="bg-white rounded-lg border p-6 mb-6">
                        <h2 className="text-xl font-bold mb-4">1. Database State</h2>
                        <div className="text-sm">
                            <div className="mb-4">
                                <strong>Company:</strong> {snapshot.db.companyName} (ID: {snapshot.db.companyId})
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                {/* New Fields */}
                                <div>
                                    <h3 className="font-bold mb-2 text-green-700">NEW Canonical Fields</h3>
                                    <table className="w-full text-xs">
                                        <tbody>
                                            <tr><td className="py-1 pr-2 font-medium">Status:</td><td>{snapshot.db.new.websiteHealthStatus || 'null'}</td></tr>
                                            <tr><td className="py-1 pr-2 font-medium">Score:</td><td>{snapshot.db.new.websiteHealthScore ?? 'null'}</td></tr>
                                            <tr><td className="py-1 pr-2 font-medium">Label:</td><td>{snapshot.db.new.websiteHealthLabel || 'null'}</td></tr>
                                            <tr><td className="py-1 pr-2 font-medium">Scanned At:</td><td>{snapshot.db.new.websiteHealthScannedAt || 'null'}</td></tr>
                                            <tr><td className="py-1 pr-2 font-medium">Error:</td><td>{snapshot.db.new.websiteHealthError || 'null'}</td></tr>
                                        </tbody>
                                    </table>
                                </div>

                                {/* Legacy Fields */}
                                <div>
                                    <h3 className="font-bold mb-2 text-orange-700">LEGACY Fields</h3>
                                    <table className="w-full text-xs">
                                        <tbody>
                                            <tr><td className="py-1 pr-2 font-medium">Staleness Score:</td><td>{snapshot.db.legacy.stalenessScore ?? 'null'}</td></tr>
                                            <tr><td className="py-1 pr-2 font-medium">Last Analysed:</td><td>{snapshot.db.legacy.lastAnalysedAt || 'null'}</td></tr>
                                            <tr><td className="py-1 pr-2 font-medium">Signals:</td><td className="truncate max-w-[200px]">{snapshot.db.legacy.signals || 'null'}</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Stored Report */}
                            <div className="mt-4 pt-4 border-t">
                                <h3 className="font-bold mb-2">Stored Report (webHealthData)</h3>
                                {snapshot.db.storedReport.exists ? (
                                    <div className="bg-gray-50 p-3 rounded text-xs">
                                        <div><strong>Score:</strong> {snapshot.db.storedReport.parsed?.score ?? 'null'}</div>
                                        <div><strong>Label:</strong> {snapshot.db.storedReport.parsed?.statusLabel || 'null'}</div>
                                        <div><strong>Base Score:</strong> {snapshot.db.storedReport.parsed?.baseScore ?? 'null'}</div>
                                        <div><strong>Factors:</strong> {snapshot.db.storedReport.parsed?.factors?.length || 0}</div>
                                    </div>
                                ) : (
                                    <div className="text-gray-500 italic">No stored report</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Integrity Checks */}
                    <div className="bg-white rounded-lg border p-6 mb-6">
                        <h2 className="text-xl font-bold mb-4">2. Integrity Checks</h2>
                        <div className="space-y-3 text-sm">
                            <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${snapshot.db.integrity.mathCheck.pass ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {snapshot.db.integrity.mathCheck.pass ? '✓ PASS' : '✗ FAIL'}
                                </span>
                                <strong>Math Check:</strong> {snapshot.db.integrity.mathCheck.message}
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${snapshot.db.integrity.labelCheck.pass ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {snapshot.db.integrity.labelCheck.pass ? '✓ PASS' : '✗ FAIL'}
                                </span>
                                <strong>Label Check:</strong> {snapshot.db.integrity.labelCheck.message}
                            </div>
                        </div>
                    </div>

                    {/* API Surfaces */}
                    <div className="bg-white rounded-lg border p-6 mb-6">
                        <h2 className="text-xl font-bold mb-4">3. API Surface Serializers</h2>
                        <div className="space-y-4">
                            {Object.entries(snapshot.apiSurfaces).map(([surface, data]: [string, any]) => (
                                <div key={surface} className="border-l-4 border-blue-500 pl-4">
                                    <h3 className="font-bold mb-2 capitalize">{surface}</h3>
                                    <div className="text-xs">
                                        <div className="mb-2"><strong>Source:</strong> {data.source}</div>
                                        <div className="bg-gray-50 p-2 rounded">
                                            <div>Score: {data.output.websiteHealthScore ?? 'null'} {getMismatchBadge(data.output.websiteHealthScore, snapshot.db.new.websiteHealthScore)}</div>
                                            <div>Label: {data.output.websiteHealthLabel || 'null'} {getMismatchBadge(data.output.websiteHealthLabel, snapshot.db.new.websiteHealthLabel)}</div>
                                            <div>Status: {data.output.websiteHealthStatus || 'null'}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Raw JSON */}
                    <details className="bg-gray-50 rounded-lg border p-4">
                        <summary className="cursor-pointer font-bold">Raw JSON</summary>
                        <pre className="mt-4 text-xs overflow-auto">{JSON.stringify(snapshot, null, 2)}</pre>
                    </details>
                </>
            )}

            {!snapshot && !loading && (
                <div className="text-center text-gray-500 py-12">
                    Enter a company ID and click "Load Snapshot" to begin
                </div>
            )}
        </div>
    );
}
