'use client';

import { Users, Target, MessageCircle, Clock } from 'lucide-react';
import { KpiCard, KpiGrid, KpiTheme } from '@/components/ui/KpiCard';

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

    const cards: {
        label: string;
        value: number;
        icon: typeof Users;
        trend?: string;
        trendUp?: boolean;
        theme: KpiTheme;
        key: string;
    }[] = [
            {
                label: 'New Prospects',
                value: stats.prospectsFound,
                icon: Users,
                trend: '+12%',
                trendUp: true,
                theme: 'mint',
                key: 'new-prospects'
            },
            {
                label: 'High Opportunity',
                value: stats.highOpportunity,
                icon: Target,
                trend: '+8%',
                trendUp: true,
                theme: 'lilac',
                key: 'high-opportunity'
            },
            {
                label: 'Total Replies',
                value: stats.replies,
                icon: MessageCircle,
                theme: 'default',
                key: 'total-replies'
            },
            {
                label: 'Follow-ups Due',
                value: stats.followUpsDue,
                icon: Clock,
                trend: stats.followUpsDue > 5 ? 'Overdue' : undefined,
                trendUp: stats.followUpsDue > 5 ? false : undefined,
                theme: stats.followUpsDue > 5 ? 'warning' : 'default',
                key: 'follow-ups-due'
            }
        ];

    return (
        <KpiGrid>
            {cards.map((card) => (
                <KpiCard
                    key={card.key}
                    label={card.label}
                    value={card.value}
                    icon={card.icon}
                    trend={card.trend}
                    trendUp={card.trendUp}
                    theme={card.theme}
                    data-kpi-key={card.key}
                />
            ))}
        </KpiGrid>
    );
}
