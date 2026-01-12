'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import { useRouter } from 'next/navigation';

export default function ImportLeads() {
    const [file, setFile] = useState<File | null>(null);
    const [importing, setImporting] = useState(false);
    const [stats, setStats] = useState<{ created: number; errors: any[] } | null>(null);
    const router = useRouter();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setStats(null);
        }
    };

    const handleImport = () => {
        if (!file) return;

        setImporting(true);

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                // Transform CSV data to expected API format
                // Expected columns: Company, Website, Industry, Location
                const leads = results.data.map((row: any) => ({
                    companyName: row['Company'] || row['Company Name'] || row['company'],
                    websiteUrl: row['Website'] || row['Website URL'] || row['website'],
                    industry: row['Industry'] || row['industry'],
                    location: row['Location'] || row['location']
                })).filter(l => l.companyName && l.websiteUrl); // Basic filter

                if (leads.length === 0) {
                    alert('No valid leads found in CSV. Check column headers (Company, Website, Industry, Location).');
                    setImporting(false);
                    return;
                }

                try {
                    const res = await fetch('/api/leads/bulk', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ leads })
                    });
                    const data = await res.json();
                    setStats({ created: data.created, errors: data.errors });

                    if (data.created > 0) {
                        // Refresh list if navigating back
                        router.refresh();
                    }
                } catch (e) {
                    console.error(e);
                    alert('Import failed');
                } finally {
                    setImporting(false);
                }
            },
            error: (err) => {
                console.error(err);
                alert('CSV Parsing error');
                setImporting(false);
            }
        });
    };

    return (
        <div className="p-8 max-w-3xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Import Leads</h1>

            {!stats ? (
                <div className="bg-white p-12 rounded-lg shadow-sm border border-dashed border-gray-300 text-center">
                    <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileChange}
                        className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-[var(--brand-soft)] file:text-[var(--brand)]
                  hover:file:bg-[var(--brand-weak)]
                  mx-auto max-w-xs
                "
                    />
                    <p className="text-gray-500 mt-4 text-sm">
                        Required Columns: Company, Website. Optional: Industry, Location.
                    </p>

                    {file && (
                        <div className="mt-6">
                            <button
                                onClick={handleImport}
                                disabled={importing}
                                className="bg-gray-900 text-white px-6 py-2 rounded-md hover:bg-gray-800 disabled:opacity-50"
                            >
                                {importing ? 'Importing...' : 'Upload & Process'}
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200">
                    <h2 className="text-xl font-semibold mb-4 text-green-700">Import Complete</h2>
                    <p className="mb-2">Successfully created: <span className="font-bold">{stats.created}</span> leads.</p>

                    {stats.errors.length > 0 && (
                        <div className="mt-4 p-4 bg-red-50 rounded border border-red-100">
                            <h4 className="font-medium text-red-800 mb-2">Errors / Duplicates ({stats.errors.length})</h4>
                            <ul className="list-disc list-inside text-sm text-red-600 max-h-40 overflow-y-auto">
                                {stats.errors.map((e: any, i: number) => (
                                    <li key={i}>{e.url}: {e.error}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="mt-6">
                        <button
                            onClick={() => { setFile(null); setStats(null); }}
                            className="mr-4 text-gray-600 hover:text-gray-900 font-medium"
                        >
                            Import Another
                        </button>
                        <button
                            onClick={() => router.push('/')}
                            className="btn btn-primary"
                        >
                            Go to Dashboard
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
