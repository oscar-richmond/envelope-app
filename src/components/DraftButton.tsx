'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function DraftButton({ leadId }: { leadId: number }) {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleDraft = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/draft', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ leadId }),
            });
            if (res.ok) {
                router.refresh();
            } else {
                alert('Drafting failed');
            }
        } catch (e) {
            console.error(e);
            alert('Error generating draft');
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleDraft}
            disabled={loading}
            className="text-sm text-blue-600 font-medium hover:underline flex items-center gap-1"
        >
            <Sparkles size={14} />
            {loading ? 'Generating...' : 'Generate with AI'}
        </button>
    );
}
