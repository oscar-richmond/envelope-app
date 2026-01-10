'use client';

import { Target, TrendingUp, Monitor, Send } from 'lucide-react';
import { StatsCard, StatsGrid } from '@/components/ui/StatsCard';

interface KPIGridProps {
    opportunityScore: number;
    financialScore: number;
    financialBand: string;
    websiteScore: number;
    outreachStatus: string;
    isSidebar?: boolean;
}

export default function KPIGrid({
    opportunityScore,
    financialScore,
    financialBand,
    websiteScore,
    outreachStatus,
    isSidebar = false
}: KPIGridProps) {

    // Helper to determine color
    const getScoreColor = (score: number) => {
        if (score >= 75) return 'green';
        if (score >= 50) return 'amber';
        return 'rose';
    };

    // Financial Value Formatted
    const financialValue = (
        <div className="flex flex-col items-start leading-none gap-1">
            <span>{financialScore}</span>
            <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded-full border border-current opacity-80
                ${financialBand === 'Strong' || financialBand === 'Very Strong' ? 'bg-green-50 text-green-700' :
                    financialBand === 'Medium' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>
                {financialBand}
            </span>
        </div>
    );

    return (
        <StatsGrid className={isSidebar ? 'grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-4'}>
            <StatsCard
                label="Lead Opp."
                value={`${opportunityScore}/100`}
                icon={<Target size={18} />}
                color={getScoreColor(opportunityScore)}
                compact={isSidebar}
            />
            <StatsCard
                label="Financial"
                value={financialValue} // Render formatted node
                icon={<TrendingUp size={18} />}
                color={getScoreColor(financialScore)}
                compact={isSidebar}
            />
            <StatsCard
                label="Website"
                value={`${websiteScore}/100`}
                icon={<Monitor size={18} />}
                color={getScoreColor(websiteScore)}
                compact={isSidebar}
            />
            <StatsCard
                label="Status"
                value={<span className="text-base truncate block">{outreachStatus.replace(/_/g, ' ')}</span>}
                icon={<Send size={18} />}
                color="indigo"
                compact={isSidebar}
            />
        </StatsGrid>
    );
}
