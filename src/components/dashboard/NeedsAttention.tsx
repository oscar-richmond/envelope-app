'use client';

import Link from 'next/link';
import { ChevronRight, AlertCircle, Clock, PenTool, CheckCircle2 } from 'lucide-react';

interface NeedsAttentionProps {
    stats: any;
    activity: any;
    loading: boolean;
}

export default function NeedsAttention({ stats, activity, loading }: NeedsAttentionProps) {
    if (loading) {
        return (
            <div
                className="h-64 animate-pulse rounded-2xl"
                style={{ background: 'var(--bg-card-muted)' }}
            />
        );
    }

    const items = [];

    if (stats?.actionNeeded > 0) {
        items.push({
            id: 'action',
            title: `${stats.actionNeeded} Replies Need Action`,
            status: 'Action Needed',
            accent: 'warning',
            icon: AlertCircle,
            link: '/outreach/sent?filter=ACTION_NEEDED',
            cta: 'View Inbox'
        });
    }

    if (stats?.followUpsDue > 0) {
        items.push({
            id: 'followup',
            title: `${stats.followUpsDue} Follow-ups Due`,
            status: 'Due Now',
            accent: 'error',
            icon: Clock,
            link: '/outreach/follow-ups',
            cta: 'Start Session'
        });
    }

    if (stats?.draftsWaiting > 0) {
        items.push({
            id: 'drafts',
            title: `${stats.draftsWaiting} Drafts Waiting`,
            status: 'Draft',
            accent: 'default',
            icon: PenTool,
            link: '/leads',
            cta: 'Review'
        });
    }

    const accentStyles: Record<string, { bg: string; color: string; badgeBg: string; badgeColor: string }> = {
        warning: {
            bg: 'var(--status-warning-bg)',
            color: 'var(--status-warning-text)',
            badgeBg: 'var(--status-warning-bg)',
            badgeColor: 'var(--status-warning-text)'
        },
        error: {
            bg: 'var(--status-danger-bg)',
            color: 'var(--status-danger-text)',
            badgeBg: 'var(--status-danger-bg)',
            badgeColor: 'var(--status-danger-text)'
        },
        default: {
            bg: 'var(--bg-card-muted)',
            color: 'var(--text-secondary)',
            badgeBg: 'var(--bg-card-muted)',
            badgeColor: 'var(--text-secondary)'
        }
    };

    if (items.length === 0) {
        return (
            <div
                className="h-full flex flex-col items-center justify-center text-center p-8 rounded-2xl"
                style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-soft)'
                }}
            >
                <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center mb-4"
                    style={{ background: 'var(--mint-soft)', color: 'var(--mint-text)' }}
                >
                    <CheckCircle2 size={28} strokeWidth={1.75} />
                </div>
                <h3
                    className="text-lg font-semibold mb-1"
                    style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
                >
                    All clear!
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    No urgent actions requiring your attention.
                </p>
            </div>
        );
    }

    return (
        <div
            className="h-full flex flex-col overflow-hidden rounded-2xl"
            style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-soft)'
            }}
        >
            {/* Header */}
            <div
                className="px-6 py-5 flex items-center justify-between"
                style={{ borderBottom: '1px solid var(--border-soft)' }}
            >
                <div>
                    <h3
                        className="font-semibold"
                        style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
                    >
                        Needs Attention
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        Priority items requiring action
                    </p>
                </div>
                <span
                    className="text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{
                        background: 'var(--status-danger-bg)',
                        color: 'var(--status-danger-text)'
                    }}
                >
                    {items.length} Priority
                </span>
            </div>

            {/* Items */}
            <div className="flex-1">
                {items.map((item, i) => {
                    const style = accentStyles[item.accent];
                    const Icon = item.icon;

                    return (
                        <div
                            key={item.id}
                            className="px-6 py-4 flex items-center justify-between transition-colors hover:bg-gray-50"
                            style={{
                                borderBottom: i < items.length - 1 ? '1px solid var(--border-soft)' : 'none'
                            }}
                        >
                            <div className="flex items-center gap-4">
                                <div
                                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                                    style={{ background: style.bg, color: style.color }}
                                >
                                    <Icon size={20} strokeWidth={1.75} />
                                </div>
                                <div>
                                    <p
                                        className="text-sm font-medium mb-1"
                                        style={{ color: 'var(--text-primary)' }}
                                    >
                                        {item.title}
                                    </p>
                                    <span
                                        className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full"
                                        style={{ background: style.badgeBg, color: style.badgeColor }}
                                    >
                                        {item.status}
                                    </span>
                                </div>
                            </div>
                            <Link
                                href={item.link}
                                className="btn btn-sm btn-secondary"
                            >
                                {item.cta}
                                <ChevronRight size={14} strokeWidth={1.75} />
                            </Link>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
