'use client';

import { Users, Target, MessageCircle, Clock, TrendingUp, TrendingDown } from 'lucide-react';

interface DashboardKPIsProps {
    stats: {
        prospectsFound: number;
        highOpportunity: number;
        replies: number;
        followUpsDue: number;
    } | null;
    loading: boolean;
}

export default function DashboardKPIs({ stats, loading }: DashboardKPIsProps) {
    if (loading || !stats) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
                {[1, 2, 3, 4].map((i) => (
                    <div
                        key={i}
                        className="h-32 animate-pulse rounded-[var(--radius-card)]"
                        style={{ background: 'var(--bg-card-muted)' }}
                    />
                ))}
            </div>
        );
    }

    const cards = [
        {
            label: 'New Prospects',
            value: stats.prospectsFound,
            icon: Users,
            trend: '+12%',
            trendUp: true,
            accent: 'mint'
        },
        {
            label: 'High Opportunity',
            value: stats.highOpportunity,
            icon: Target,
            trend: '+8%',
            trendUp: true,
            accent: 'lilac'
        },
        {
            label: 'Total Replies',
            value: stats.replies,
            icon: MessageCircle,
            trend: null,
            accent: 'default'
        },
        {
            label: 'Follow-ups Due',
            value: stats.followUpsDue,
            icon: Clock,
            trend: stats.followUpsDue > 5 ? 'Overdue' : null,
            trendUp: false,
            accent: stats.followUpsDue > 5 ? 'warning' : 'default'
        }
    ];

    const accentStyles: Record<string, { border: string; iconBg: string; iconColor: string }> = {
        mint: {
            border: 'var(--accent-mint)',
            iconBg: 'var(--accent-mint-bg)',
            iconColor: 'var(--accent-mint-text)'
        },
        lilac: {
            border: 'var(--accent-lilac)',
            iconBg: 'var(--accent-lilac-bg)',
            iconColor: 'var(--accent-lilac-text)'
        },
        warning: {
            border: 'var(--warning)',
            iconBg: 'var(--warning-light)',
            iconColor: 'var(--warning-text)'
        },
        default: {
            border: 'var(--border-default)',
            iconBg: 'var(--bg-card-muted)',
            iconColor: 'var(--text-muted)'
        }
    };

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            {cards.map((card, i) => {
                const style = accentStyles[card.accent];
                const Icon = card.icon;

                return (
                    <div
                        key={i}
                        className="relative overflow-hidden transition-all duration-200 hover:shadow-[var(--shadow-card-hover)] group"
                        style={{
                            background: 'var(--bg-card)',
                            borderRadius: 'var(--radius-card)',
                            border: `1px solid var(--border-soft)`,
                            borderLeft: `4px solid ${style.border}`,
                            boxShadow: 'var(--shadow-card)',
                            padding: '24px'
                        }}
                    >
                        {/* Top Row: Label + Icon */}
                        <div className="flex items-start justify-between mb-3">
                            <span
                                className="text-[10px] font-semibold uppercase tracking-wider"
                                style={{ color: 'var(--text-muted)' }}
                            >
                                {card.label}
                            </span>
                            <div
                                className="w-9 h-9 rounded-[var(--radius-md)] flex items-center justify-center shrink-0"
                                style={{ background: style.iconBg, color: style.iconColor }}
                            >
                                <Icon size={18} />
                            </div>
                        </div>

                        {/* Big Number */}
                        <div
                            className="text-4xl font-bold tracking-tight"
                            style={{
                                fontFamily: 'var(--font-display)',
                                color: 'var(--text-primary)',
                                letterSpacing: '-0.03em'
                            }}
                        >
                            {card.value}
                        </div>

                        {/* Trend */}
                        {card.trend && (
                            <div className="flex items-center gap-1.5 mt-2">
                                {card.trendUp !== undefined && (
                                    card.trendUp
                                        ? <TrendingUp size={14} style={{ color: 'var(--success)' }} />
                                        : <TrendingDown size={14} style={{ color: 'var(--error)' }} />
                                )}
                                <span
                                    className="text-xs font-medium"
                                    style={{
                                        color: card.trendUp ? 'var(--success)' : (card.accent === 'warning' ? 'var(--error)' : 'var(--text-muted)')
                                    }}
                                >
                                    {card.trend}
                                </span>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

