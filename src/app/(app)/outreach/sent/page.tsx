'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
    Mail, RefreshCw, MessageSquare, ChevronRight, Search,
    ArrowUpDown, Clock, AlertCircle, CheckCircle, XCircle,
    ArrowUp, Send, Building2, Columns3
} from 'lucide-react';
import ThreadViewer from '@/components/ThreadViewer';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatsCard, StatsGrid } from '@/components/ui/StatsCard';
import { CompanyNameLink } from '@/components/company/CompanyNameLink';
import { displayName } from '@/lib/utils/displayName';

// Types
type UniboxQueue = 'NEEDS_REPLY' | 'FOLLOW_UP_DUE' | 'WAITING' | 'REPLIED' | 'BOUNCED';
type SortBy = 'priority' | 'recency';

interface QueueCounts {
    all: number;
    needsReply: number;
    followUpDue: number;
    waiting: number;
    replied: number;
    bounced: number;
}

interface SentEmailWithQueue {
    id: number;
    subject: string;
    formattedTo: string;
    bodyText: string;
    sentAt: string;
    status: string;
    computedQueue: UniboxQueue;
    nextFollowUpAt?: string | null;
    replyDetectedAt?: string | null;
    replyIntent?: string | null;
    suggestedAction?: string | null;
    objectionType?: string | null;
    replySentiment?: string | null;
    replySummary?: string | null;
    replyConfidence?: number | null;
    lastInboundAt?: string | null;
    lastOutboundAt?: string | null;
    updatedAt: string;
    lead: {
        id: number;
        companyName: string;
        industry?: string | null;
        websiteUrl?: string | null;
        companyProspect?: {
            id: number;
            displayBrandName?: string | null;
            websiteDomain?: string | null;
            contactPriorityBand?: string | null;
            financialActivityBand?: string | null;
        } | null;
    };
}

// Intent badge styling - uses CSS variable tokens from globals.css
const INTENT_STYLES: Record<string, { bg: string; text: string; label: string }> = {
    POSITIVE: { bg: 'var(--status-success-bg)', text: 'var(--status-success-text)', label: 'Interested' },
    NEUTRAL_QUESTION: { bg: 'var(--status-info-bg)', text: 'var(--status-info-text)', label: 'Question' },
    OBJECTION: { bg: 'var(--status-warning-bg)', text: 'var(--status-warning-text)', label: 'Objection' },
    NOT_INTERESTED: { bg: 'var(--status-danger-bg)', text: 'var(--status-danger-text)', label: 'Not Interested' },
    WRONG_PERSON: { bg: 'var(--status-purple-bg)', text: 'var(--status-purple-text)', label: 'Wrong Person' },
    AUTO_REPLY: { bg: 'var(--status-neutral-bg)', text: 'var(--status-neutral-text)', label: 'Auto-Reply' },
    UNCLEAR: { bg: 'var(--status-neutral-bg)', text: 'var(--status-neutral-text)', label: 'Unclear' },
    // Legacy mappings
    INTERESTED: { bg: 'var(--status-success-bg)', text: 'var(--status-success-text)', label: 'Interested' },
    NOT_NOW: { bg: 'var(--status-warning-bg)', text: 'var(--status-warning-text)', label: 'Not Now' },
    REFERRAL: { bg: 'var(--status-purple-bg)', text: 'var(--status-purple-text)', label: 'Referral' }
};

// Tab configuration
const TABS: { key: UniboxQueue | 'ALL'; label: string; icon: React.ReactNode }[] = [
    { key: 'ALL', label: 'All', icon: <Mail size={14} /> },
    { key: 'NEEDS_REPLY', label: 'Needs Reply', icon: <AlertCircle size={14} /> },
    { key: 'FOLLOW_UP_DUE', label: 'Follow-Up Due', icon: <Clock size={14} /> },
    { key: 'WAITING', label: 'Waiting', icon: <Send size={14} /> },
    { key: 'REPLIED', label: 'Replied', icon: <CheckCircle size={14} /> },
    { key: 'BOUNCED', label: 'Bounced', icon: <XCircle size={14} /> }
];

export default function UniboxPage() {
    const [emails, setEmails] = useState<SentEmailWithQueue[]>([]);
    const [counts, setCounts] = useState<QueueCounts>({
        all: 0, needsReply: 0, followUpDue: 0, waiting: 0, replied: 0, bounced: 0
    });
    const [queue, setQueue] = useState<UniboxQueue | 'ALL'>('NEEDS_REPLY');
    const [sortBy, setSortBy] = useState<SortBy>('priority');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);

    // Fetch emails with debounced search
    const fetchEmails = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                queue,
                sort: sortBy,
                ...(search && { search })
            });
            const res = await fetch(`/api/outreach/sent?${params}`);
            const data = await res.json();
            if (data.sentEmails) setEmails(data.sentEmails);
            if (data.counts) setCounts(data.counts);
        } catch (e) {
            console.error('Fetch failed:', e);
        } finally {
            setLoading(false);
        }
    }, [queue, sortBy, search]);

    useEffect(() => {
        const debounce = setTimeout(fetchEmails, search ? 300 : 0);
        return () => clearTimeout(debounce);
    }, [fetchEmails]);

    async function syncReplies() {
        setSyncing(true);
        try {
            await fetch('/api/cron/check-replies');
            await fetchEmails();
        } catch (e) {
            console.error('Sync failed:', e);
        } finally {
            setSyncing(false);
        }
    }

    // Get count for a queue
    const getCount = (q: UniboxQueue | 'ALL'): number => {
        switch (q) {
            case 'ALL': return counts.all;
            case 'NEEDS_REPLY': return counts.needsReply;
            case 'FOLLOW_UP_DUE': return counts.followUpDue;
            case 'WAITING': return counts.waiting;
            case 'REPLIED': return counts.replied;
            case 'BOUNCED': return counts.bounced;
            default: return 0;
        }
    };

    return (
        <div className="page-container">
            <PageHeader
                title="Inbox"
                subtitle="Action-based email queues"
                actions={
                    <>
                        <button
                            onClick={syncReplies}
                            disabled={syncing}
                            className="btn btn-secondary"
                        >
                            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
                            {syncing ? 'Syncing...' : 'Sync Replies'}
                        </button>
                        <Link href="/outreach/deals" className="btn btn-secondary">
                            <Columns3 size={16} />
                            Pipeline
                        </Link>
                        <Link href="/outreach/follow-ups" className="btn btn-primary">
                            <MessageSquare size={16} />
                            Go to Queue
                        </Link>
                    </>
                }
            />

            {/* Stats Overview */}
            <div className="mb-8">
                <StatsGrid>
                    <StatsCard
                        label="Needs Reply"
                        value={counts.needsReply}
                        variant="warning"
                        icon={<AlertCircle size={20} strokeWidth={1.75} />}
                    />
                    <StatsCard
                        label="Follow-Up Due"
                        value={counts.followUpDue}
                        variant="lilac"
                        icon={<Clock size={20} strokeWidth={1.75} />}
                    />
                    <StatsCard
                        label="Waiting"
                        value={counts.waiting}
                        variant="neutral"
                        icon={<Send size={20} strokeWidth={1.75} />}
                    />
                    <StatsCard
                        label="Replied"
                        value={counts.replied}
                        variant="mint"
                        icon={<CheckCircle size={20} strokeWidth={1.75} />}
                    />
                </StatsGrid>

                {/* Review Queue CTA - Hero Surface */}
                {counts.followUpDue > 0 && (
                    <div className="hero-surface hero-surface-lilac mt-6 p-5 flex items-center justify-between">
                        <div>
                            <h3
                                className="font-semibold text-base"
                                style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
                            >
                                You have {counts.followUpDue} follow-ups due
                            </h3>
                            <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                                Review and send personalised follow-up emails
                            </p>
                        </div>
                        <Link
                            href="/outreach/follow-ups"
                            className="btn btn-primary"
                        >
                            <Send size={16} strokeWidth={1.75} />
                            Review Queue
                        </Link>
                    </div>
                )}
            </div>

            {/* Tabs + Controls */}
            <div className="flex items-center justify-between mb-6 gap-4">
                {/* Queue Tabs */}
                <div className="flex items-center gap-1 flex-wrap">
                    {TABS.map((tab) => {
                        const count = getCount(tab.key);
                        const isActive = queue === tab.key;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setQueue(tab.key)}
                                className={`px-4 py-2 text-sm font-medium rounded-full transition-all flex items-center gap-2 border ${isActive
                                    ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                    }`}
                            >
                                {tab.icon}
                                {tab.label}
                                {count > 0 && (
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                                        }`}>
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Controls */}
                <div className="flex items-center gap-3">
                    {/* Search */}
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg w-48 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                    </div>

                    {/* Sort Dropdown */}
                    <div className="relative">
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as SortBy)}
                            className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="priority">Priority</option>
                            <option value="recency">Recency</option>
                        </select>
                        <ArrowUpDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                </div>
            </div>

            {/* Email Table */}
            <div className="card table-container">
                <table className="table">
                    <thead>
                        <tr>
                            <th className="w-[22%] pl-6">Company</th>
                            <th className="w-[18%]">Recipients</th>
                            <th className="w-[25%]">Subject</th>
                            <th className="w-[12%]">Last Activity</th>
                            <th className="w-[13%]">Status</th>
                            <th className="w-[10%] text-right pr-6"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                                    <div className="flex flex-col items-center gap-2">
                                        <RefreshCw className="animate-spin text-gray-300" size={24} />
                                        <span>Loading conversations...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : emails.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-16 text-center">
                                    <EmptyState queue={queue} />
                                </td>
                            </tr>
                        ) : (
                            emails.map((email) => (
                                <EmailRow
                                    key={email.id}
                                    email={email}
                                    onClick={() => setSelectedThreadId(email.id)}
                                />
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

// ─────────────────────────────────────────
// Email Row Component
// ─────────────────────────────────────────

function EmailRow({
    email,
    onClick
}: {
    email: SentEmailWithQueue;
    onClick: () => void;
}) {
    const companyName = email.lead.companyProspect?.displayBrandName || email.lead.companyName;
    const initials = companyName.substring(0, 2).toUpperCase();

    // Extract email address from formatted string
    const recipientEmail = email.formattedTo.match(/<(.+)>/)?.[1] || email.formattedTo;
    const recipientName = email.formattedTo.replace(/<.+>/, '').trim();

    // Last activity time
    const lastActivity = email.lastInboundAt || email.lastOutboundAt || email.updatedAt;

    return (
        <tr
            onClick={onClick}
            className="hover:bg-gray-50/80 transition-colors cursor-pointer group"
        >
            {/* Company */}
            <td className="pl-6 py-4 align-top">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">
                        {initials}
                    </div>
                    <div className="min-w-0">
                        <CompanyNameLink
                            leadId={email.leadId}
                            name={companyName}
                            className="font-semibold text-gray-900 text-sm truncate max-w-[160px] block"
                        />
                        {email.lead.industry && (
                            <div className="text-[11px] text-gray-400 truncate max-w-[160px]">
                                {email.lead.industry}
                            </div>
                        )}
                    </div>
                </div>
            </td>

            {/* Recipients */}
            <td className="py-4 align-top">
                <div className="text-sm text-gray-700 truncate max-w-[150px]">
                    {recipientName || recipientEmail}
                </div>
                {recipientName && (
                    <div className="text-xs text-gray-400 truncate max-w-[150px]">
                        {recipientEmail}
                    </div>
                )}
            </td>

            {/* Subject */}
            <td className="py-4 align-top">
                <div className="text-gray-900 font-medium text-sm truncate max-w-[280px] mb-0.5">
                    {email.subject}
                </div>
                <div className="text-xs text-gray-500 truncate max-w-[280px]">
                    {email.bodyText.substring(0, 60)}...
                </div>
            </td>

            {/* Last Activity */}
            <td className="py-4 align-top">
                <div className="text-sm text-gray-600">
                    {formatRelativeTime(lastActivity)}
                </div>
                <div className="text-[11px] text-gray-400">
                    {email.lastInboundAt ? 'Inbound' : 'Outbound'}
                </div>
            </td>

            {/* Status + Intent */}
            <td className="py-4 align-top">
                <div className="flex flex-col gap-1.5">
                    <QueueBadge queue={email.computedQueue} />
                    {email.replyIntent && email.replyIntent !== 'UNCLEAR' && (
                        <IntentBadge intent={email.replyIntent} confidence={email.replyConfidence} />
                    )}
                    <NextActionLabel queue={email.computedQueue} email={email} />
                </div>
            </td>

            {/* Arrow */}
            <td className="pr-6 py-4 text-right align-middle">
                <button className="text-gray-400 group-hover:text-indigo-600 transition-colors">
                    <ChevronRight size={20} />
                </button>
            </td>
        </tr>
    );
}

// ─────────────────────────────────────────
// Queue Badge Component
// ─────────────────────────────────────────

function QueueBadge({ queue }: { queue: UniboxQueue }) {
    const config = {
        NEEDS_REPLY: { label: 'Needs Reply', className: 'badge-warning' },
        FOLLOW_UP_DUE: { label: 'Follow-Up Due', className: 'badge-info bg-amber-100 text-amber-700' },
        WAITING: { label: 'Waiting', className: 'badge-info bg-gray-100 text-gray-600' },
        REPLIED: { label: 'Replied', className: 'badge-success' },
        BOUNCED: { label: 'Bounced', className: 'badge-error bg-red-100 text-red-600' }
    };

    const { label, className } = config[queue] || { label: queue, className: 'badge-neutral' };

    return (
        <span className={`badge ${className}`}>
            {label}
        </span>
    );
}

// ─────────────────────────────────────────
// Intent Badge Component
// ─────────────────────────────────────────

function IntentBadge({ intent, confidence }: { intent: string; confidence?: number | null }) {
    const style = INTENT_STYLES[intent] || INTENT_STYLES['UNCLEAR'];

    return (
        <span
            className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full"
            style={{ background: style.bg, color: style.text }}
        >
            {style.label}
            {confidence && confidence > 0 && (
                <span className="opacity-60">{confidence}%</span>
            )}
        </span>
    );
}

// ─────────────────────────────────────────
// Next Action Label
// ─────────────────────────────────────────

function NextActionLabel({ queue, email }: { queue: UniboxQueue; email: SentEmailWithQueue }) {
    let label = '';

    switch (queue) {
        case 'NEEDS_REPLY':
            label = 'Reply needed';
            break;
        case 'FOLLOW_UP_DUE':
            label = 'Approve follow-up';
            break;
        case 'WAITING':
            if (email.nextFollowUpAt) {
                const days = Math.ceil((new Date(email.nextFollowUpAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                if (days <= 0) label = 'Follow-up overdue';
                else if (days === 1) label = 'Follow-up tomorrow';
                else label = `Follow-up in ${days}d`;
            } else {
                label = 'Waiting for reply';
            }
            break;
        case 'REPLIED':
            if (email.replyIntent === 'INTERESTED') label = 'Interested lead';
            else if (email.replyIntent === 'NOT_NOW') label = 'Follow up later';
            else label = 'Review response';
            break;
        case 'BOUNCED':
            label = 'Delivery failed';
            break;
    }

    if (!label) return null;

    return (
        <span className="text-[10px] font-medium text-gray-400 pl-1 uppercase tracking-wide block mt-1">
            {label}
        </span>
    );
}

// ─────────────────────────────────────────
// Empty State
// ─────────────────────────────────────────

function EmptyState({ queue }: { queue: UniboxQueue | 'ALL' }) {
    const messages: Record<UniboxQueue | 'ALL', { title: string; subtitle: string }> = {
        ALL: { title: 'No emails yet', subtitle: 'Send your first outreach to get started.' },
        NEEDS_REPLY: { title: "You're all caught up!", subtitle: 'No emails need a reply right now.' },
        FOLLOW_UP_DUE: { title: 'No follow-ups due', subtitle: 'Your follow-up queue is clear.' },
        WAITING: { title: 'Nothing waiting', subtitle: 'All threads have been responded to.' },
        REPLIED: { title: 'No replies yet', subtitle: 'Replies will appear here when detected.' },
        BOUNCED: { title: 'No bounces', subtitle: 'All emails delivered successfully.' }
    };

    const { title, subtitle } = messages[queue];

    return (
        <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center">
                <Mail className="text-gray-300" size={24} />
            </div>
            <div>
                <p className="text-gray-700 font-medium">{title}</p>
                <p className="text-gray-400 text-sm">{subtitle}</p>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────

function formatRelativeTime(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}
