'use client';

import { Target, TrendingUp, Monitor, Send } from 'lucide-react';
import { StatsCard, StatsGrid } from '@/components/ui/StatsCard';

interface KPIGridProps {
    opportunityScore: number;
    financialScore: number;
    financialBand: string;
    websiteScore: number;
    outreachStatus: string;
}

export default function KPIGrid({
    opportunityScore,
    financialScore,
    financialBand,
    websiteScore,
    outreachStatus
}: KPIGridProps) {

    // Helper to determine color
    const getScoreColor = (score: number) => {
        if (score >= 75) return 'green';
        if (score >= 50) return 'amber';
        return 'rose';
    };

    return (
        <StatsGrid>
            <StatsCard
                label="Lead Opportunity"
                value={`${opportunityScore}/100`}
                icon={<Target size={20} />}
                color={getScoreColor(opportunityScore)}
            />
            <StatsCard
                label="Financial Health"
                value={`${financialScore} - ${financialBand}`}
                icon={<TrendingUp size={20} />}
                color={getScoreColor(financialScore)}
            />
            <StatsCard
                label="Website Health"
                value={`${websiteScore}/100`}
                icon={<Monitor size={20} />}
                color={getScoreColor(websiteScore)}
            />
            <StatsCard
                label="Outreach Status"
                value={outreachStatus.replace('_', ' ')}
                icon={<Send size={20} />}
                color="indigo"
            />
        </StatsGrid>
    );
}
