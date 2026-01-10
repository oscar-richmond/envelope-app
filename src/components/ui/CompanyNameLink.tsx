'use client';

import { useCompanyOverviewModal } from '@/components/modals/CompanyOverviewModalProvider';
import { ExternalLink } from 'lucide-react';

interface CompanyNameLinkProps {
    leadId: number;
    companyName: string;
    className?: string; // Additional classes
}

export default function CompanyNameLink({ leadId, companyName, className = '' }: CompanyNameLinkProps) {
    const { openCompanyOverview } = useCompanyOverviewModal();

    const handleClick = (e: React.MouseEvent) => {
        // If CMD/CTRL click, let it bubble to default behavior (if strictly a link) or open in new tab
        if (e.metaKey || e.ctrlKey) {
            window.open(`/leads/${leadId}`, '_blank');
            e.stopPropagation(); // prevent row click if nested
            return;
        }

        e.preventDefault();
        e.stopPropagation(); // Stop propagation to prevent row clicks (e.g. in Inbox)
        openCompanyOverview(leadId);
    };

    return (
        <span
            onClick={handleClick}
            className={`font-medium text-gray-900 hover:text-indigo-600 hover:underline cursor-pointer transition-colors inline-flex items-center gap-1 group ${className}`}
        >
            {companyName}
            {/* Optional subtle icon on hover */}
            <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400" />
        </span>
    );
}
