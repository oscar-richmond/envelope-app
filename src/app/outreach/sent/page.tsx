'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Mail, ArrowRight, Clock, AlertCircle, CheckCircle, MessageSquare } from 'lucide-react';

export default function SentBoxPage() {
    const [emails, setEmails] = useState<any[]>([]);
    const [filter, setFilter] = useState('ALL');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchEmails();
    }, [filter]);

    async function fetchEmails() {
        setLoading(true);
        try {
            const res = await fetch(`/api/outreach/sent?filter=${filter}`);
            const data = await res.json();
            if (data.sentEmails) setEmails(data.sentEmails);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <header className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
                        Sent Box
                    </h1>
                    <p className="text-gray-500 mt-1">Track replies and manage follow-ups.</p>
                </div>
                <div className="flex gap-2">
                    <Link href="/outreach/follow-ups" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm">
                        <MessageSquare size={16} />
                        Go to Follow Up Queue
                    </Link>
                </div>
            </header>

            {/* Filters */}
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg w-fit mb-6">
                {['ALL', 'WAITING', 'ACTION_NEEDED', 'REPLIED'].map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        {f.replace('_', ' ')}
                    </button>
                ))}
            </div>

            {/* Table */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                        <tr>
                            <th className="px-6 py-3">Recipient</th>
                            <th className="px-6 py-3">Subject</th>
                            <th className="px-6 py-3">Sent</th>
                            <th className="px-6 py-3">Status</th>
                            <th className="px-6 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-gray-400">Loading...</td>
                            </tr>
                        ) : emails.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-gray-400">No sent emails found for this filter.</td>
                            </tr>
                        ) : (
                            emails.map((email) => (
                                <tr key={email.id} className="hover:bg-gray-50/50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-gray-900">{email.lead.companyName}</div>
                                        <div className="text-xs text-gray-400 truncate max-w-[200px]">{email.formattedTo}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-gray-700 font-medium truncate max-w-[300px]">{email.subject}</div>
                                        <div className="text-xs text-gray-400 truncate max-w-[300px]">{email.bodyText.substring(0, 50)}...</div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-500">
                                        {new Date(email.sentAt).toLocaleDateString()}
                                        <div className="text-[10px] text-gray-300">
                                            {new Date(email.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <StatusBadge status={email.status} />
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button className="text-gray-400 hover:text-indigo-600 text-xs font-medium border border-gray-200 rounded px-2 py-1">
                                                View Thread
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    if (status === 'REPLIED') {
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-green-50 text-green-700 uppercase tracking-wider"><MessageSquare size={10} /> Replied</span>
    }
    if (status === 'FOLLOW_UP_DUE') {
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 uppercase tracking-wider"><AlertCircle size={10} /> Follow Up Due</span>
    }
    if (status === 'FOLLOWED_UP') {
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 uppercase tracking-wider"><CheckCircle size={10} /> Followed Up</span>
    }
    return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500 uppercase tracking-wider"><Clock size={10} /> Waiting</span>
}
