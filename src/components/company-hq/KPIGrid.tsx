'use client';

import { Target, TrendingUp, Monitor, Send } from 'lucide-react';
import { StatsCard, StatsGrid } from '@/components/ui/StatsCard';

interface KPIGridProps {
    opportunityScore: number | null;
    financialScore: number | null;
    financialBand: string | null;
    websiteScore: number | null;
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

    // Helper to determine variant based on score
    const getScoreVariant = (score: number | null): 'mint' | 'warning' | 'danger' | 'neutral' => {
        if (score === null) return 'neutral';
        if (score >= 70) return 'mint';
        if (score >= 40) return 'warning';
        return 'danger';
    };

    // Format score for display
    const formatScore = (score: number | null) => {
        if (score === null || score === undefined) return '--';
        return score.toString();
    };

    // Financial band variant
    const getFinancialVariant = (band: string | null): 'mint' | 'warning' | 'danger' | 'neutral' => {
        if (!band || band === 'Unknown') return 'neutral';
        if (band === 'Strong' || band === 'Very Strong') return 'mint';
        if (band === 'Medium') return 'warning';
        return 'danger';
    };

    // Status variant
    const getStatusVariant = (status: string): 'lilac' | 'teal' | 'blue' | 'neutral' => {
        switch (status) {
            case 'REPLIED': return 'lilac';
            case 'SENT': return 'teal';
            case 'DRAFTED': return 'blue';
            default: return 'neutral';
        }
    };

    // Financial Value Formatted
    const financialValue = financialScore !== null ? (
        <div className="flex flex-col items-start leading-none gap-1">
            <span>{financialScore}</span>
            {financialBand && financialBand !== 'Unknown' && (
                <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded-full
                    ${financialBand === 'Strong' || financialBand === 'Very Strong' ? 'bg-green-100 text-green-700' :
                        financialBand === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                    {financialBand}
                </span>
            )}
        </div>
    ) : <span>--</span>;

    return (
        <StatsGrid className={isSidebar ? 'grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-4'}>
            <StatsCard
                label="Lead Opp."
                value={formatScore(opportunityScore)}
                icon={<Target size={18} />}
                variant={getScoreVariant(opportunityScore)}
                compact={isSidebar}
            />
            <StatsCard
                label="Financial"
                value={financialValue}
                icon={<TrendingUp size={18} />}
                variant={getFinancialVariant(financialBand)}
                compact={isSidebar}
            />
            <StatsCard
                label="Website"
                value={formatScore(websiteScore)}
                icon={<Monitor size={18} />}
                variant={getScoreVariant(websiteScore)}
                compact={isSidebar}
            />
            <StatsCard
                label="Status"
                value={<span className="text-base truncate block">{outreachStatus.replace(/_/g, ' ')}</span>}
                icon={<Send size={18} />}
                variant={getStatusVariant(outreachStatus)}
                compact={isSidebar}
            />
        </StatsGrid>
    );
}
