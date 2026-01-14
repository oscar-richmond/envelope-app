'use client';

import Link from 'next/link';
import { ArrowUpRight, ArrowDownLeft, ChevronRight } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';

interface RecentActivityProps {
    outbound: any[];
    replies: any[];
    loading: boolean;
}

export default function RecentActivity({ outbound, replies, loading }: RecentActivityProps) {
    // Ensure arrays are defined to prevent "Cannot read properties of undefined" errors
    const safeOutbound = outbound ?? [];
    const safeReplies = replies ?? [];

    if (loading) {
        return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
                <div
                    className="h-48 animate-pulse rounded-[var(--radius-card)]"
                    style={{ background: 'var(--bg-card-muted)' }}
                />
                <div
                    className="h-48 animate-pulse rounded-[var(--radius-card)]"
                    style={{ background: 'var(--bg-card-muted)' }}
                />
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
            {/* Recent Outbound */}
            <div
                style={{
                    background: 'var(--bg-card)',
                    borderRadius: 'var(--radius-card)',
                    border: '1px solid var(--border-soft)',
                    boxShadow: 'var(--shadow-card)',
                    overflow: 'hidden'
                }}
            >
                <div
                    className="px-6 py-4 flex items-center gap-3"
                    style={{ borderBottom: '1px solid var(--border-soft)' }}
                >
                    <div
                        className="w-8 h-8 rounded-[var(--radius-sm)] flex items-center justify-center"
                        style={{ background: 'var(--bg-card-muted)', color: 'var(--text-muted)' }}
                    >
                        <ArrowUpRight size={16} />
                    </div>
                    <h3
                        className="font-semibold text-sm"
                        style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
                    >
                        Recent Outbound
                    </h3>
                </div>
                <div>
                    {safeOutbound.length === 0 ? (
                        <p
                            className="p-6 text-sm text-center"
                            style={{ color: 'var(--text-muted)' }}
                        >
                            No recent emails sent.
                        </p>
                    ) : (
                        safeOutbound.map((item, i) => (
                            <div
                                key={item.id}
                                className="px-6 py-4 flex items-center justify-between transition-colors hover:bg-[var(--bg-card-muted)]"
                                style={{
                                    borderBottom: i < safeOutbound.length - 1 ? '1px solid var(--border-soft)' : 'none'
                                }}
                            >
                                <div>
                                    <p
                                        className="text-sm font-medium"
                                        style={{ color: 'var(--text-primary)' }}
                                    >
                                        {item.lead.companyName}
                                    </p>
                                    <p
                                        className="text-xs"
                                        style={{ color: 'var(--text-muted)' }}
                                    >
                                        {new Date(item.sentAt).toLocaleDateString()}
                                    </p>
                                </div>
                                <StatusBadge status={item.status} />
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Recent Replies */}
            <div
                style={{
                    background: 'var(--bg-card)',
                    borderRadius: 'var(--radius-card)',
                    border: '1px solid var(--border-soft)',
                    boxShadow: 'var(--shadow-card)',
                    overflow: 'hidden'
                }}
            >
                <div
                    className="px-6 py-4 flex items-center gap-3"
                    style={{ borderBottom: '1px solid var(--border-soft)' }}
                >
                    <div
                        className="w-8 h-8 rounded-[var(--radius-sm)] flex items-center justify-center"
                        style={{ background: 'var(--accent-mint-bg)', color: 'var(--accent-mint-text)' }}
                    >
                        <ArrowDownLeft size={16} />
                    </div>
                    <h3
                        className="font-semibold text-sm"
                        style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
                    >
                        Recent Replies
                    </h3>
                </div>
                <div>
                    {safeReplies.length === 0 ? (
                        <p
                            className="p-6 text-sm text-center"
                            style={{ color: 'var(--text-muted)' }}
                        >
                            No replies yet.
                        </p>
                    ) : (
                        safeReplies.map((item, i) => (
                            <div
                                key={item.id}
                                className="px-6 py-4 flex items-center justify-between transition-colors hover:bg-[var(--bg-card-muted)]"
                                style={{
                                    borderBottom: i < safeReplies.length - 1 ? '1px solid var(--border-soft)' : 'none'
                                }}
                            >
                                <div>
                                    <p
                                        className="text-sm font-medium"
                                        style={{ color: 'var(--text-primary)' }}
                                    >
                                        {item.lead.companyName}
                                    </p>
                                    <p
                                        className="text-xs truncate max-w-[200px]"
                                        style={{ color: 'var(--text-muted)' }}
                                    >
                                        {item.subject}
                                    </p>
                                </div>
                                <Link
                                    href={`/outreach/sent?thread=${item.id}`}
                                    className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-[var(--radius-button)] transition-all"
                                    style={{
                                        background: 'var(--bg-card-muted)',
                                        color: 'var(--text-secondary)'
                                    }}
                                >
                                    View
                                    <ChevronRight size={12} />
                                </Link>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

