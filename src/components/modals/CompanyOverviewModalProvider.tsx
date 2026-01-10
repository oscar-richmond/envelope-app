'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import CompanyOverviewModal from './CompanyOverviewModal';

interface CompanyOverviewContextType {
    openCompanyOverview: (leadId: number) => void;
    closeCompanyOverview: () => void;
}

const CompanyOverviewContext = createContext<CompanyOverviewContextType | undefined>(undefined);

export function CompanyOverviewModalProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [activeLeadId, setActiveLeadId] = useState<number | null>(null);

    const openCompanyOverview = (leadId: number) => {
        setActiveLeadId(leadId);
        setIsOpen(true);
    };

    const closeCompanyOverview = () => {
        setIsOpen(false);
        setActiveLeadId(null);
    };

    return (
        <CompanyOverviewContext.Provider value={{ openCompanyOverview, closeCompanyOverview }}>
            {children}
            {isOpen && activeLeadId && (
                <CompanyOverviewModal leadId={activeLeadId} onClose={closeCompanyOverview} />
            )}
        </CompanyOverviewContext.Provider>
    );
}

export function useCompanyOverviewModal() {
    const context = useContext(CompanyOverviewContext);
    if (context === undefined) {
        throw new Error('useCompanyOverviewModal must be used within a CompanyOverviewModalProvider');
    }
    return context;
}
