'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Mail, ArrowRight, Clock, AlertCircle, CheckCircle, MessageSquare, RefreshCw, XCircle, ChevronRight } from 'lucide-react';
import ThreadViewer from '@/components/ThreadViewer';
import { StatsCard, StatsGrid } from '@/components/ui/StatsCard';

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
        <div className="page-container">
            <header className="page-header flex items-center justify-between">
                <div>
                    <h1 className="page-title">Inbox</h1>
                    <p className="page-description">Track replies and manage follow-ups.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={syncReplies}
                        disabled={syncing}
                        className="btn btn-secondary"
                    >
                        <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
                        {syncing ? 'Syncing...' : 'Sync Replies'}
                    </button>
                    <Link href="/outreach/follow-ups" className="btn btn-primary">
                        <MessageSquare size={16} />
                        Go to Queue
                    </Link>
                </div>
            </header>

            {/* Overview Stats */}
            <div className="mb-8">
                <StatsGrid>
                    <StatsCard
                        label="Action Needed"
                        value={counts.actionNeeded}
                        variant="warning"
                        icon={<AlertCircle size={20} />}
                    />
                    <StatsCard
                        label="Waiting"
                        value={counts.waiting}
                        variant="neutral"
                        icon={<Clock size={20} />}
                    />
                    <StatsCard
                        label="Replied"
                        value={counts.replied}
                        variant="mint"
                        icon={<CheckCircle size={20} />}
                    />
                    <StatsCard
                        label="Closed"
                        value={counts.closed}
                        variant="neutral"
                        icon={<XCircle size={20} />}
                    />
                </StatsGrid>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 mb-6">
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setFilter(tab.key)}
                        className={`px-4 py-2 text-sm font-medium rounded-full transition-all flex items-center gap-2 border ${filter === tab.key
                            ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                            }`}
                    >
                        {tab.label}
                        {tab.count > 0 && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${filter === tab.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                                }`}>
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Table */}
            <div className="card table-container">
                <table className="table">
                    <thead>
                        <tr>
                            <th className="w-[25%] pl-6">Recipient</th>
                            <th className="w-[35%]">Subject & Summary</th>
                            <th className="w-[15%]">Sent</th>
                            <th className="w-[15%]">Status</th>
                            <th className="w-[10%] text-right pr-6"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                                    <div className="flex flex-col items-center gap-2">
                                        <RefreshCw className="animate-spin text-gray-300" size={24} />
                                        <span>Loading conversations...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : emails.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-16 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center">
                                            <Mail className="text-gray-300" size={24} />
                                        </div>
                                        <p className="text-gray-500 font-medium">
                                            {filter === 'ACTION_NEEDED'
                                                ? 'You\'re all caught up!'
                                                : 'No emails found for this filter.'}
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            emails.map((email) => (
                                <tr key={email.id}
                                    onClick={() => setSelectedThreadId(email.id)}
                                    className="hover:bg-gray-50/80 transition-colors cursor-pointer group"
                                >
                                    <td className="pl-6 py-4 align-top">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">
                                                {email.lead.companyName.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="font-semibold text-gray-900 text-sm">{email.lead.companyName}</div>
                                                <div className="text-xs text-gray-400 truncate max-w-[150px]">{email.formattedTo}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-4 align-top">
                                        <div className="text-gray-900 font-medium text-sm truncate max-w-[400px] mb-0.5">{email.subject}</div>
                                        <div className="text-xs text-gray-500 truncate max-w-[400px]">{email.bodyText.substring(0, 80)}...</div>
                                        {/* AI Summary - Only show if valid */}
                                        <div className="mt-2">
                                            <AISummary summary={email.replySummary} status={email.status} />
                                        </div>
                                    </td>
                                    <td className="py-4 align-top">
                                        <div className="text-sm text-gray-500 font-medium">
                                            {new Date(email.sentAt).toLocaleDateString()}
                                        </div>
                                        <div className="text-xs text-gray-400 mt-0.5">
                                            {new Date(email.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </td>
                                    <td className="py-4 align-top">
                                        <StatusBadge
                                            status={email.status}
                                            nextFollowUpAt={email.nextFollowUpAt}
                                            replySentiment={email.replySentiment}
                                            replyIntent={email.replyIntent}
                                        />
                                    </td>
                                    <td className="pr-6 py-4 text-right align-middle">
                                        <button className="text-gray-400 group-hover:text-indigo-600 transition-colors">
                                            <ChevronRight size={20} />
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
        <div className="inline-flex items-start gap-1.5 text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-1.5 rounded-lg max-w-[90%]">
            <MessageSquare size={12} className="mt-0.5 shrink-0" />
            <span className="leading-snug">{summary}</span>
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
            return 'Response required';
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
            <span className="badge badge-success">
                Reply received
            </span>
        );
    } else if (status === 'FOLLOW_UP_DUE' || status === 'ACTION_NEEDED') {
        badge = (
            <span className="badge badge-warning">
                Action Needed
            </span>
        );
    } else if (status === 'CLOSED') {
        badge = (
            <span className="badge badge-neutral">
                Closed
            </span>
        );
    } else {
        // SENT, FOLLOWED_UP, WAITING → Waiting
        badge = (
            <span className="badge badge-info bg-gray-100 text-gray-600">
                Waiting
            </span>
        );
    }

    return (
        <div className="flex flex-col gap-1.5 items-start">
            {badge}
            {hint && (
                <span className="text-[10px] font-medium text-gray-400 pl-1 uppercase tracking-wide">
                    {hint}
                </span>
            )}
        </div>
    );
}
