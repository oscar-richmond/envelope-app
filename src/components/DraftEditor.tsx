'use client';

import { useState } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import DraftButton from './DraftButton';

type Draft = {
    id: number;
    version: number;
    body: string;
    subjectLine1: string;
    subjectLine2: string;
    createdAt: string;
};

export default function DraftEditor({
    leadId,
    initialDraft,
    draftHistory
}: {
    leadId: number;
    initialDraft: string | null;
    draftHistory: Draft[];
}) {
    const [currentBody, setCurrentBody] = useState(initialDraft || '');
    const [saving, setSaving] = useState(false);

    // If we have history, show tabs
    // "Current" is what's in the textarea.

    const handleSave = async () => {
        setSaving(true);
        try {
            // Just update the main lead draft field (The "Working Copy")
            const res = await fetch(`/api/leads/${leadId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ emailDraft: currentBody })
            });
            if (!res.ok) alert('Failed to save changes');
        } catch (e) { console.error(e); }
        finally { setSaving(false); }
    };

    const loadVersion = (draft: Draft) => {
        if (confirm('Replace current editor content with this version?')) {
            setCurrentBody(draft.body);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-gray-900">Outreach Draft</h3>
                <div className="flex items-center gap-2">
                    <DraftButton leadId={leadId} />
                </div>
            </div>

            {/* History Tabs */}
            {draftHistory.length > 0 && (
                <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
                    {draftHistory.map((d) => (
                        <button
                            key={d.id}
                            onClick={() => loadVersion(d)}
                            className="px-3 py-1 text-xs font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 whitespace-nowrap"
                        >
                            v{d.version} ({new Date(d.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                        </button>
                    ))}
                </div>
            )}

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 min-h-[250px] relative group">
                <textarea
                    className="w-full h-full min-h-[250px] bg-transparent resize-y focus:outline-none text-gray-800 p-2 text-sm font-mono leading-relaxed"
                    value={currentBody}
                    onChange={(e) => setCurrentBody(e.target.value)}
                    placeholder="No draft generated yet..."
                />

                {/* Save Action */}
                <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-1 bg-white border border-gray-300 shadow-sm text-gray-700 px-3 py-1.5 rounded-md text-xs font-medium hover:bg-gray-50"
                    >
                        <Save size={12} />
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>

            <p className="mt-2 text-xs text-gray-400 italic">
                * This is an AI-generated draft. Please review and edit before sending.
            </p>
        </div>
    );
}
