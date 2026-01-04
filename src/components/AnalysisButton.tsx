'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AnalysisButton({ leadId }: { leadId: number }) {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleAnalyze = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ leadId }),
            });
            if (res.ok) {
                router.refresh();
            } else {
                alert('Analysis failed');
            }
        } catch (e) {
            console.error(e);
            alert('Error running analysis');
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleAnalyze}
            disabled={loading}
            className={`flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition ${loading ? 'opacity-50' : ''}`}
        >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Analyzing...' : 'Re-run Analysis'}
        </button>
    );
}
