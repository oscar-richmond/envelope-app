'use client';

import { useState } from 'react';

export default function HealthTestsPage() {
    const [results, setResults] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const runTests = async () => {
        setLoading(true);
        setResults(null);
        try {
            const res = await fetch('/api/dev/health-tests');
            const json = await res.json();
            setResults(json);
        } catch (e: any) {
            setResults({ error: e.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-4">🩺 Web Health Golden Path Tests</h1>
            <p className="mb-6 text-gray-600">
                Automated verification of the "Zero-to-Hero" scan flow.
                Verifies: Canonical writes, Report storage, Math consistency, and API surface agreement.
            </p>

            <button
                onClick={runTests}
                disabled={loading}
                className="btn btn-primary px-6 py-2 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
                {loading ? 'Running Tests...' : 'Run Golden Path Tests'}
            </button>

            {results && (
                <div className="mt-8 space-y-6">
                    {/* Summary */}
                    <div className={`p-4 rounded-lg border ${results.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                        <h2 className="font-bold text-lg">{results.success ? '✅ ALL TESTS PASSED' : '❌ TESTS FAILED'}</h2>
                        {results.message && <p>{results.message}</p>}
                    </div>

                    {/* Step Details */}
                    {results.steps?.map((step: any, i: number) => (
                        <div key={i} className="border rounded-lg p-4 bg-white shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-semibold">{step.name}</h3>
                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${step.status === 'PASS' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {step.status}
                                </span>
                            </div>
                            {step.details && (
                                <pre className="bg-gray-50 p-2 rounded text-xs overflow-x-auto">
                                    {JSON.stringify(step.details, null, 2)}
                                </pre>
                            )}
                            {step.error && (
                                <p className="text-sm text-red-600 mt-2 font-mono">{step.error}</p>
                            )}
                        </div>
                    ))}

                    {/* Full Trace */}
                    {results.trace && (
                        <details>
                            <summary className="cursor-pointer text-gray-500 text-sm mt-4">Full Trace Output</summary>
                            <pre className="bg-gray-900 text-green-400 p-4 rounded mt-2 text-xs overflow-x-auto">
                                {JSON.stringify(results.trace, null, 2)}
                            </pre>
                        </details>
                    )}
                </div>
            )}
        </div>
    );
}
