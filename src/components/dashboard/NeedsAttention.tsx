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
                className="h-64 animate-pulse rounded-[var(--radius-card)]"
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
            bg: 'var(--warning-light)',
            color: 'var(--warning-text)',
            badgeBg: 'var(--warning-light)',
            badgeColor: 'var(--warning-text)'
        },
        error: {
            bg: 'var(--error-light)',
            color: 'var(--error-text)',
            badgeBg: 'var(--error-light)',
            badgeColor: 'var(--error-text)'
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
                className="h-full flex flex-col items-center justify-center text-center p-8"
                style={{
                    background: 'var(--bg-card)',
                    borderRadius: 'var(--radius-card)',
                    border: '1px solid var(--border-soft)',
                    boxShadow: 'var(--shadow-card)'
                }}
            >
                <div
                    className="w-14 h-14 rounded-[var(--radius-lg)] flex items-center justify-center mb-4"
                    style={{ background: 'var(--success-light)', color: 'var(--success-text)' }}
                >
                    <CheckCircle2 size={28} />
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
            className="h-full flex flex-col"
            style={{
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius-card)',
                border: '1px solid var(--border-soft)',
                boxShadow: 'var(--shadow-card)',
                overflow: 'hidden'
            }}
        >
            {/* Header */}
            <div
                className="px-6 py-5 flex items-center justify-between"
                style={{
                    background: 'var(--bg-card-muted)',
                    borderBottom: '1px solid var(--border-soft)'
                }}
            >
                <h3
                    className="font-semibold"
                    style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
                >
                    Needs Attention
                </h3>
                <span
                    className="text-xs font-bold px-2.5 py-1 rounded-[var(--radius-badge)]"
                    style={{
                        background: 'var(--error-light)',
                        color: 'var(--error-text)'
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
                            className="px-6 py-4 flex items-center justify-between transition-colors hover:bg-[var(--bg-card-muted)]"
                            style={{
                                borderBottom: i < items.length - 1 ? '1px solid var(--border-soft)' : 'none'
                            }}
                        >
                            <div className="flex items-center gap-4">
                                <div
                                    className="w-10 h-10 rounded-[var(--radius-md)] flex items-center justify-center shrink-0"
                                    style={{ background: style.bg, color: style.color }}
                                >
                                    <Icon size={20} />
                                </div>
                                <div>
                                    <p
                                        className="text-sm font-medium mb-1"
                                        style={{ color: 'var(--text-primary)' }}
                                    >
                                        {item.title}
                                    </p>
                                    <span
                                        className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-[var(--radius-badge)]"
                                        style={{ background: style.badgeBg, color: style.badgeColor }}
                                    >
                                        {item.status}
                                    </span>
                                </div>
                            </div>
                            <Link
                                href={item.link}
                                className="flex items-center gap-1 text-xs font-semibold px-4 py-2 rounded-[var(--radius-button)] transition-all"
                                style={{
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border-default)',
                                    color: 'var(--text-primary)'
                                }}
                            >
                                {item.cta}
                                <ChevronRight size={14} />
                            </Link>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

