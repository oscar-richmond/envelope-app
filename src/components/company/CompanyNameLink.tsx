'use client';

import { useCompanyOverviewModal } from '@/components/modals/CompanyOverviewModalProvider';

interface Props {
    prospectId?: number;
    leadId?: number;
    name: string;
    className?: string;
    style?: React.CSSProperties;
}

export function CompanyNameLink({ prospectId, leadId, name, className = '', style }: Props) {
    const { openCompanyOverview } = useCompanyOverviewModal();

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (leadId) {
            openCompanyOverview({ leadId });
        } else if (prospectId) {
            openCompanyOverview({ prospectId });
        }
    };

    return (
        <button
            id={prospectId ? `company-link-${prospectId}` : leadId ? `company-link-lead-${leadId}` : undefined}
            onClick={handleClick}
            className={`text-left transition-colors cursor-pointer hover:text-[var(--lilac-text)] hover:underline ${className}`}
            style={style}
            type="button"
            aria-label={`Open ${name} company profile`}
        >
            {name}
        </button>
    );
}

