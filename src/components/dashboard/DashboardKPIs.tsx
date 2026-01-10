'use client';

import { Users, Target, MessageCircle, Clock } from 'lucide-react';
import { StatsCard, StatsGrid } from '@/components/ui/StatsCard';

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
    if (loading || !stats) return <div className="h-24 animate-pulse bg-gray-100 rounded-xl mb-8" />;

    return (
        <StatsGrid>
            <StatsCard
                label="New Prospects"
                value={stats.prospectsFound}
                icon={<Users size={20} />}
                color="indigo"
            />
            <StatsCard
                label="High Opportunity"
                value={stats.highOpportunity}
                icon={<Target size={20} />}
                color="green"
            />
            <StatsCard
                label="Total Replies"
                value={stats.replies}
                icon={<MessageCircle size={20} />}
                color="default"
            />
            <StatsCard
                label="Follow-ups Due"
                value={stats.followUpsDue}
                icon={<Clock size={20} />}
                color="amber"
            />
        </StatsGrid>
    );
}
