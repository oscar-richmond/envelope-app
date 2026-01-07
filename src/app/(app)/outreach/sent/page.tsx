'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Mail, ArrowRight, Clock, AlertCircle, CheckCircle, MessageSquare, RefreshCw, XCircle } from 'lucide-react';
import ThreadViewer from '@/components/ThreadViewer';

interface StatusCounts {
    actionNeeded: number;
    waiting: number;
    replied: number;
    closed: number;
    all: number;
}

export default function InboxPage() {
    const [emails, setEmails] = useState<any[]>([]);
    const [counts, setCounts] = useState<StatusCounts>({ actionNeeded: 0, waiting: 0, replied: 0, closed: 0, all: 0 });
    const [filter, setFilter] = useState('ACTION_NEEDED'); // Default to ACTION NEEDED
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);

    useEffect(() => {
        fetchEmails();
    }, [filter]);

    async function fetchEmails() {
        setLoading(true);
        try {
            const res = await fetch(`/api/outreach/sent?filter=${filter}`);
            const data = await res.json();
            if (data.sentEmails) setEmails(data.sentEmails);
            if (data.counts) setCounts(data.counts);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    async function syncReplies() {
        setSyncing(true);
        try {
            const res = await fetch('/api/cron/check-replies');
            const data = await res.json();
            console.log('Sync result:', data);
            await fetchEmails();
        } catch (e) {
            console.error('Sync failed:', e);
        } finally {
            setSyncing(false);
        }
    }

    // Tab configuration with proper order
    const tabs = [
        { key: 'ACTION_NEEDED', label: 'Action Needed', count: counts.actionNeeded },
        { key: 'WAITING', label: 'Waiting', count: counts.waiting },
        { key: 'REPLIED', label: 'Replied', count: counts.replied },
        { key: 'ALL', label: 'All', count: counts.all }
    ];

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <header className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
                        Inbox
                    </h1>
                    <p className="text-gray-500 mt-1">Track replies and manage follow-ups.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={syncReplies}
                        disabled={syncing}
                        className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
                        {syncing ? 'Syncing...' : 'Sync Replies'}
                    </button>
                    <Link href="/outreach/follow-ups" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm">
                        <MessageSquare size={16} />
                        Go to Follow Up Queue
                    </Link>
                </div>
            </header>

            {/* Tabs - Ordered: Action Needed, Waiting, Replied, All */}
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg w-fit mb-6">
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setFilter(tab.key)}
                        className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2 ${filter === tab.key
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        {tab.label}
                        {tab.key === 'ACTION_NEEDED' && tab.count > 0 && (
                            <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                {tab.count}
                            </span>
                        )}
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
                                <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                                    {filter === 'ACTION_NEEDED'
                                        ? 'No items need your attention right now.'
                                        : 'No emails found for this filter.'}
                                </td>
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
                                        {/* AI Summary - Only show if valid */}
                                        <AISummary summary={email.replySummary} status={email.status} />
                                    </td>
                                    <td className="px-6 py-4 text-gray-500">
                                        {new Date(email.sentAt).toLocaleDateString()}
                                        <div className="text-[10px] text-gray-300">
                                            {new Date(email.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <StatusBadge
                                            status={email.status}
                                            nextFollowUpAt={email.nextFollowUpAt}
                                            replySentiment={email.replySentiment}
                                        />
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => setSelectedThreadId(email.id)}
                                            className="text-gray-500 hover:text-indigo-600 text-xs font-medium border border-gray-200 hover:border-indigo-200 rounded px-3 py-1.5 transition-colors"
                                        >
                                            View Thread
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Thread Viewer Modal */}
            {selectedThreadId && (
                <ThreadViewer
                    emailId={selectedThreadId}
                    onClose={() => setSelectedThreadId(null)}
                    onReplySent={() => fetchEmails()}
                />
            )}
        </div>
    );
}

/**
 * AI Summary - Only displays if valid summary exists
 * Never shows "failed", "error", etc.
 */
function AISummary({ summary, status }: { summary: string | null; status: string }) {
    // Only show for replied emails with a valid summary
    if (status !== 'REPLIED') return null;
    if (!summary) return null;

    // Never show failure messages to users
    const lowerSummary = summary.toLowerCase();
    if (lowerSummary.includes('failed') ||
        lowerSummary.includes('error') ||
        lowerSummary.includes('analysis') ||
        summary.length < 5) {
        return null;
    }

    return (
        <div className="mt-1 text-[10px] text-indigo-600 bg-indigo-50 border border-indigo-100 p-1 rounded max-w-[300px]">
            {summary}
        </div>
    );
}

/**
 * Status Badge with contextual hints
 * Updated to use new 6-category intent classification
 */
function StatusBadge({
    status,
    nextFollowUpAt,
    replySentiment,
    replyIntent
}: {
    status: string;
    nextFollowUpAt?: string | null;
    replySentiment?: string | null;
    replyIntent?: string | null;
}) {
    // Intent-aware hint labels
    const getIntentLabel = (): string | null => {
        const intent = replyIntent || replySentiment;
        if (!intent) return null;

        switch (intent) {
            case 'INTERESTED': return 'Interested';
            case 'NOT_NOW': return 'Not now';
            case 'NOT_INTERESTED': return 'Not interested';
            case 'REFERRAL': return 'Referral received';
            case 'AUTO_REPLY': case 'OOO': return 'Out of office';
            case 'UNCLEAR': return 'Needs review';
            default: return null;
        }
    };

    // Calculate contextual hint
    const getContextHint = () => {
        if (status === 'FOLLOW_UP_DUE' || status === 'ACTION_NEEDED') {
            return 'Follow-up due';
        }
        if (status === 'REPLIED' || status === 'CLOSED') {
            const intentLabel = getIntentLabel();
            if (intentLabel) return intentLabel;
            return 'Review needed';
        }
        if ((status === 'SENT' || status === 'FOLLOWED_UP' || status === 'WAITING') && nextFollowUpAt) {
            const days = Math.ceil((new Date(nextFollowUpAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            if (days === 0) return 'Follow-up today';
            if (days === 1) return 'Follow-up tomorrow';
            if (days > 0) return `Follow-up in ${days} days`;
            return 'Follow-up overdue';
        }
        return null;
    };

    const hint = getContextHint();

    // Status display
    let badge = null;

    if (status === 'REPLIED') {
        badge = (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-green-50 text-green-700 uppercase tracking-wider">
                <MessageSquare size={10} />
                Reply received
            </span>
        );
    } else if (status === 'FOLLOW_UP_DUE' || status === 'ACTION_NEEDED') {
        badge = (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 uppercase tracking-wider">
                <AlertCircle size={10} />
                Action Needed
            </span>
        );
    } else if (status === 'CLOSED') {
        badge = (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500 uppercase tracking-wider">
                <XCircle size={10} />
                Closed
            </span>
        );
    } else {
        // SENT, FOLLOWED_UP, WAITING → Waiting
        badge = (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500 uppercase tracking-wider">
                <Clock size={10} />
                Waiting for reply
            </span>
        );
    }

    return (
        <div className="flex flex-col gap-1">
            {badge}
            {hint && (
                <span className="text-[10px] text-gray-400">
                    {hint}
                </span>
            )}
        </div>
    );
}
