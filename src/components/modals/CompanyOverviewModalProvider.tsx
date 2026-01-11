'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import CompanyOverviewModal from './CompanyOverviewModal';

interface CompanyOverviewParams {
    leadId?: number;
    prospectId?: number;
}

interface CompanyOverviewContextType {
    openCompanyOverview: (params: CompanyOverviewParams) => void;
    closeCompanyOverview: () => void;
}

const CompanyOverviewContext = createContext<CompanyOverviewContextType | undefined>(undefined);

export function CompanyOverviewModalProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [activeParams, setActiveParams] = useState<CompanyOverviewParams | null>(null);

    const openCompanyOverview = (params: CompanyOverviewParams) => {
        setActiveParams(params);
        setIsOpen(true);
    };

    const closeCompanyOverview = () => {
        setIsOpen(false);
        setActiveParams(null);
    };

    return (
        <CompanyOverviewContext.Provider value={{ openCompanyOverview, closeCompanyOverview }}>
            {children}
            {isOpen && activeParams && (
                <CompanyOverviewModal
                    leadId={activeParams.leadId}
                    prospectId={activeParams.prospectId}
                    onClose={closeCompanyOverview}
                />
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
