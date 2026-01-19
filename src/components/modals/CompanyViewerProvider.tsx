'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import CompanyOverviewModal from './CompanyOverviewModal';
import WebsiteReviewModal from './WebsiteReviewModal';
import FinancialReportModal from './FinancialReportModal';
import PriorityBreakdownModal from './PriorityBreakdownModal';

/**
 * CompanyViewerProvider - Unified overlay management for the entire app
 * 
 * This is the SINGLE SOURCE OF TRUTH for all company-related popups.
 * All pages (Lead Board, Search, Company Profile, etc.) should use this provider
 * instead of local modal state.
 * 
 * DATA CONTRACT:
 * - companyId: number (CompanyProspect.id) - Required for all overlays
 * - This maps to: lead.companyProspectId, company.id, prospect.id
 * 
 * ADDING NEW OVERLAYS:
 * 1. Add overlay type to OverlayType union
 * 2. Add open method to context type and implementation
 * 3. Add modal rendering in the provider
 */

type ViewerMode = 'closed' | 'modal' | 'pinned';
type OverlayType = 'none' | 'companyOverview' | 'websiteReview' | 'financialHealth' | 'leadOpportunity';

interface CompanyRef {
    companyId: number;
    companyName?: string;
    websiteUrl?: string;
    companiesHouseNumber?: string;
}

interface CompanyViewerContextType {
    // Company Overview (legacy - uses leadId)
    viewerMode: ViewerMode;
    activeLeadId: number | null;
    openOrUpdate: (leadId: number) => void;
    togglePin: () => void;
    close: () => void;
    pinnedWidth: number;
    resize: (width: number) => void;

    // Report Overlays (new - uses companyId)
    activeOverlay: OverlayType;
    activeCompanyRef: CompanyRef | null;
    openWebsiteReport: (companyId: number, companyName?: string, websiteUrl?: string) => void;
    openFinancialReport: (companyId: number, companyName?: string) => void;
    openLeadOpportunityReport: (companyId: number, companyName?: string) => void;
    closeOverlay: () => void;
}

const CompanyViewerContext = createContext<CompanyViewerContextType | undefined>(undefined);

export function CompanyViewerProvider({ children }: { children: ReactNode }) {
    const router = useRouter();

    // Company Overview state (legacy)
    const [viewerMode, setViewerMode] = useState<ViewerMode>('closed');
    const [activeLeadId, setActiveLeadId] = useState<number | null>(null);
    const [pinnedWidth, setPinnedWidth] = useState(450);

    // Report Overlay state (new unified system)
    const [activeOverlay, setActiveOverlay] = useState<OverlayType>('none');
    const [activeCompanyRef, setActiveCompanyRef] = useState<CompanyRef | null>(null);

    // Load persisted state on mount
    useEffect(() => {
        const storedWidth = localStorage.getItem('inspector-width');
        if (storedWidth) setPinnedWidth(parseInt(storedWidth));
    }, []);

    // Company Overview methods (legacy)
    const openOrUpdate = (leadId: number) => {
        if (typeof leadId !== 'number' || isNaN(leadId)) {
            console.error('[CompanyViewerProvider] Invalid leadId:', leadId);
            return;
        }
        setActiveLeadId(leadId);
        if (viewerMode === 'closed') {
            setViewerMode('modal');
        }
    };

    const togglePin = () => {
        if (viewerMode === 'modal') {
            setViewerMode('pinned');
        } else if (viewerMode === 'pinned') {
            setViewerMode('modal');
        }
    };

    const close = () => {
        setViewerMode('closed');
        setActiveLeadId(null);
    };

    const resize = (width: number) => {
        const newWidth = Math.max(350, Math.min(width, 800));
        setPinnedWidth(newWidth);
        localStorage.setItem('inspector-width', String(newWidth));
    };

    // Report Overlay methods (new unified system)
    const openWebsiteReport = (companyId: number, companyName?: string, websiteUrl?: string) => {
        if (typeof companyId !== 'number' || isNaN(companyId)) {
            console.error('[CompanyViewerProvider] openWebsiteReport: Invalid companyId:', companyId);
            return;
        }
        console.log('[CompanyViewerProvider] Opening website report for company:', companyId);
        setActiveCompanyRef({ companyId, companyName, websiteUrl });
        setActiveOverlay('websiteReview');
    };

    const openFinancialReport = (companyId: number, companyName?: string) => {
        if (typeof companyId !== 'number' || isNaN(companyId)) {
            console.error('[CompanyViewerProvider] openFinancialReport: Invalid companyId:', companyId);
            return;
        }
        console.log('[CompanyViewerProvider] Opening financial report for company:', companyId);
        setActiveCompanyRef({ companyId, companyName });
        setActiveOverlay('financialHealth');
    };

    const openLeadOpportunityReport = (companyId: number, companyName?: string) => {
        if (typeof companyId !== 'number' || isNaN(companyId)) {
            console.error('[CompanyViewerProvider] openLeadOpportunityReport: Invalid companyId:', companyId);
            return;
        }
        console.log('[CompanyViewerProvider] Opening lead opportunity report for company:', companyId);
        setActiveCompanyRef({ companyId, companyName });
        setActiveOverlay('leadOpportunity');
    };

    const closeOverlay = () => {
        setActiveOverlay('none');
        setActiveCompanyRef(null);

        // Check if we need to refresh the list after modal close
        if (sessionStorage.getItem('pendingListRefresh') === 'true') {
            sessionStorage.removeItem('pendingListRefresh');
            console.log('[CompanyViewerProvider] Reloading page to sync list state');
            window.location.reload();
        }
    };

    // Listen for OPEN_WEB_HEALTH_MODAL events
    useEffect(() => {
        const handleOpenWebHealthModal = (e: CustomEvent) => {
            const { companyId, surface } = e.detail;
            if (typeof companyId === 'number' && !isNaN(companyId)) {
                console.log('[CompanyViewerProvider] OPEN_WEB_HEALTH_MODAL received:', { companyId, surface });
                openWebsiteReport(companyId);
            }
        };

        window.addEventListener('OPEN_WEB_HEALTH_MODAL', handleOpenWebHealthModal as EventListener);
        return () => {
            window.removeEventListener('OPEN_WEB_HEALTH_MODAL', handleOpenWebHealthModal as EventListener);
        };
    }, []);

    // Callback for when data is updated in modal - triggers page reload to sync parent list
    const handleDataUpdated = () => {
        console.log('[CompanyViewerProvider] Data updated - will refresh page after modal closes');
        // Set a flag that we'll check on modal close
        sessionStorage.setItem('pendingListRefresh', 'true');
    };

    return (
        <CompanyViewerContext.Provider value={{
            viewerMode,
            activeLeadId,
            openOrUpdate,
            togglePin,
            close,
            pinnedWidth,
            resize,
            activeOverlay,
            activeCompanyRef,
            openWebsiteReport,
            openFinancialReport,
            openLeadOpportunityReport,
            closeOverlay
        }}>
            {children}

            {/* Company Overview Modal (legacy) */}
            {viewerMode === 'modal' && activeLeadId && (
                <CompanyOverviewModal leadId={activeLeadId} onClose={close} />
            )}

            {/* Website Review Modal */}
            {activeOverlay === 'websiteReview' && activeCompanyRef && (
                <WebsiteReviewModal
                    isOpen={true}
                    onClose={closeOverlay}
                    companyId={activeCompanyRef.companyId}
                    companyName={activeCompanyRef.companyName}
                    websiteUrl={activeCompanyRef.websiteUrl}
                    onDataUpdated={handleDataUpdated}
                />
            )}

            {/* Financial Health Modal */}
            {activeOverlay === 'financialHealth' && activeCompanyRef && (
                <FinancialReportModal
                    isOpen={true}
                    onClose={closeOverlay}
                    companyId={activeCompanyRef.companyId}
                    score={null}
                    band={undefined}
                    evidence={[]}
                />
            )}

            {/* Lead Opportunity Modal */}
            {activeOverlay === 'leadOpportunity' && activeCompanyRef && (
                <PriorityBreakdownModal
                    isOpen={true}
                    onClose={closeOverlay}
                    companyId={activeCompanyRef.companyId}
                    companyName={activeCompanyRef.companyName}
                />
            )}
        </CompanyViewerContext.Provider>
    );
}

export function useCompanyViewer() {
    const context = useContext(CompanyViewerContext);
    if (context === undefined) {
        throw new Error('useCompanyViewer must be used within a CompanyViewerProvider');
    }
    return context;
}
