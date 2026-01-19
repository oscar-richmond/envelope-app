'use client';

import { useState, useEffect } from 'react';
import { scanWebsiteHealth } from '@/lib/websiteHealth/scanClient';
import { saveScanReceipt } from '@/lib/ui/webHealthActions';

export default function GoldenTestSection() {
    const [company, setCompany] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const findCompany = async () => {
        setLoading(true);
        setCompany(null);
        setResult(null);
        setError(null);
        try {
            const res = await fetch('/api/dev/get-test-company');
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setCompany(data);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const runTest = async () => {
        if (!company) return;
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            console.log('Running Golden Test for', company.id);
            const data = await scanWebsiteHealth({
                companyId: company.id,
                surface: 'search', // Simulating search scan
                force: true
            });

            // The scanClient already saves the receipt to the store, but we capture it here too
            setResult(data);

        } catch (e: any) {
            console.error(e);
            setError(e.detail || e.message || 'Scan failed');
        } finally {
            setLoading(false);
        }
    };

    // Assertions
    const receipt = result?.receipt;
    const computedScore = receipt?.computed?.finalScore;
    const persistedScore = receipt?.persistedReadback?.score;
    const reportExists = receipt?.persistedReadback?.reportExists;

    const pass = receipt && reportExists && computedScore === persistedScore;

    return (
        <div className="border border-blue-200 bg-blue-50 p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                ✨ Golden Path Self-Test
            </h2>

            <div className="flex items-center gap-4 mb-4">
                <button
                    onClick={findCompany}
                    disabled={loading}
                    className="px-4 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50 text-sm font-medium"
                >
                    1. Pick Test Company
                </button>

                {company && (
                    <div className="text-sm font-mono">
                        Selected: <span className="font-bold">{company.companyName}</span> (ID: {company.id})
                        <br />
                        <span className="text-gray-500">{company.websiteUrl}</span>
                    </div>
                )}
            </div>

            {company && (
                <div className="mb-4">
                    <button
                        onClick={runTest}
                        disabled={loading}
                        className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold shadow-sm"
                    >
                        {loading ? 'Running Scan...' : '2. Run Golden Scan'}
                    </button>
                </div>
            )}

            {error && (
                <div className="p-4 bg-red-100 text-red-800 rounded border border-red-200 mb-4 font-mono text-sm">
                    ERROR: {error}
                </div>
            )}

            {result && (
                <div className={`p-4 rounded border-2 ${pass ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className={`text-xl font-bold ${pass ? 'text-green-800' : 'text-red-800'}`}>
                            {pass ? 'TEST PASSED' : 'TEST FAILED'}
                        </h3>
                        {pass && <span className="text-4xl">✅</span>}
                        {!pass && <span className="text-4xl">❌</span>}
                    </div>

                    {!pass && (
                        <div className="mb-4 p-3 bg-white rounded border border-red-200 text-red-700 font-bold">
                            Failure Reason:
                            {!receipt && " No receipt returned"}
                            {receipt && !reportExists && " Report NOT persisted (Data missing)"}
                            {receipt && reportExists && computedScore !== persistedScore && ` Divergence: Computed(${computedScore}) != Persisted(${persistedScore})`}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="bg-white p-3 rounded border">
                            <div className="font-bold text-gray-500 text-xs uppercase mb-1">Computed (Memory)</div>
                            <div className="text-2xl font-mono">{computedScore ?? 'NULL'}</div>
                            <div className="text-xs text-gray-400 mt-1">Factors: {receipt?.computed?.factors?.length || 0}</div>
                        </div>
                        <div className="bg-white p-3 rounded border">
                            <div className="font-bold text-gray-500 text-xs uppercase mb-1">Persisted (DB Readback)</div>
                            <div className="text-2xl font-mono">{persistedScore ?? 'NULL'}</div>
                            <div className="text-xs text-gray-400 mt-1">
                                Report Exists: {reportExists ? 'YES' : 'NO'}
                            </div>
                        </div>
                    </div>

                    <div className="mt-4">
                        <details className="cursor-pointer">
                            <summary className="text-xs font-bold text-gray-500 hover:text-gray-800">View Full Receipt JSON</summary>
                            <pre className="mt-2 text-[10px] bg-gray-900 text-green-400 p-4 rounded overflow-auto max-h-60">
                                {JSON.stringify(receipt, null, 2)}
                            </pre>
                        </details>
                    </div>
                </div>
            )}
        </div>
    );
}
