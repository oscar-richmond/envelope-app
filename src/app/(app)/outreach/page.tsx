'use client';

import { useState, useEffect } from 'react';
import { Mail, Send, Edit2, Loader2, Check } from 'lucide-react';

export default function OutreachQueue() {
    const [messages, setMessages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState<number | null>(null);

    useEffect(() => {
        fetch('/api/outreach')
            .then(res => res.json())
            .then(data => {
                setMessages(data);
                setLoading(false);
            });
    }, []);

    const handleSync = async (id: number) => {
        setSyncing(id);
        try {
            const res = await fetch(`/api/outreach/${id}/sync`, { method: 'POST' });
            if (res.ok) {
                const updated = await res.json();
                setMessages(messages.map(m => m.id === id ? { ...m, status: 'QUEUED', gmailDraftId: updated.gmailDraftId } : m));
            } else {
                alert("Failed to sync (Check connection or limits)");
            }
        } catch (e) { console.error(e); }
        finally { setSyncing(null); }
    };

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">Outreach Queue</h1>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-semibold">
                        <tr>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">To</th>
                            <th className="px-6 py-4">Subject</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {messages.map((m) => (
                            <tr key={m.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4">
                                    <span className={`text-xs font-medium px-2 py-1 rounded-full border ${m.status === 'DRAFT' ? 'bg-gray-100 text-gray-600 border-gray-200' :
                                            m.status === 'QUEUED' ? 'bg-yellow-50 text-yellow-600 border-yellow-200' :
                                                'bg-green-50 text-green-600 border-green-200'
                                        }`}>
                                        {m.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="font-medium text-gray-900">{m.contact?.firstName} {m.contact?.lastName}</div>
                                    <div className="text-xs text-gray-500">{m.lead?.companyName}</div>
                                </td>
                                <td className="px-6 py-4 text-gray-600 text-sm truncate max-w-[300px]">
                                    {m.subject}
                                </td>
                                <td className="px-6 py-4 text-right flex justify-end gap-2">
                                    {m.status === 'DRAFT' && (
                                        <button
                                            onClick={() => handleSync(m.id)}
                                            disabled={!!syncing}
                                            className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-blue-700 flex items-center gap-1"
                                        >
                                            {syncing === m.id ? <Loader2 className="animate-spin" size={12} /> : <Mail size={12} />}
                                            Sync to Gmail
                                        </button>
                                    )}
                                    {m.status === 'QUEUED' && (
                                        <span className="text-xs text-gray-400 flex items-center gap-1">
                                            <Check size={12} /> In Gmail Drafts
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {!loading && messages.length === 0 && (
                            <tr>
                                <td colSpan={4} className="text-center py-8 text-gray-400">No pending outreach. Draft emails from the Lead Detail page.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
