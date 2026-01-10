'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import CompanyOverviewModal from './CompanyOverviewModal';

type ViewerMode = 'closed' | 'modal' | 'pinned';

interface CompanyViewerContextType {
    viewerMode: ViewerMode;
    activeLeadId: number | null;
    openOrUpdate: (leadId: number) => void;
    togglePin: () => void;
    close: () => void;
    pinnedWidth: number;
    resize: (width: number) => void;
}

const CompanyViewerContext = createContext<CompanyViewerContextType | undefined>(undefined);

export function CompanyViewerProvider({ children }: { children: ReactNode }) {
    const [viewerMode, setViewerMode] = useState<ViewerMode>('closed');
    const [activeLeadId, setActiveLeadId] = useState<number | null>(null);
    const [pinnedWidth, setPinnedWidth] = useState(450); // Default width

    // Load persisted state on mount
    useEffect(() => {
        const storedWidth = localStorage.getItem('inspector-width');
        if (storedWidth) setPinnedWidth(parseInt(storedWidth));

        // Optional: Persist pinned state across reloads? 
        // For now, let's start fresh on reload to avoid confusion, 
        // or just persist the *preference* to be pinned if open.
    }, []);

    const openOrUpdate = (leadId: number) => {
        setActiveLeadId(leadId);
        // If already pinned, stay pinned. Else open modal.
        if (viewerMode === 'closed') {
            setViewerMode('modal');
        }
        // If 'modal' or 'pinned', state remains, just content updates
    };

    const togglePin = () => {
        if (viewerMode === 'modal') {
            setViewerMode('pinned');
        } else if (viewerMode === 'pinned') {
            setViewerMode('modal');
        }
    };

    const close = () => {
        // If pinned, we might want to just "deselect" but keep panel ready?
        // For now, close completely.
        setViewerMode('closed');
        setActiveLeadId(null);
    };

    const resize = (width: number) => {
        // Clamp width
        const newWidth = Math.max(350, Math.min(width, 800));
        setPinnedWidth(newWidth);
        localStorage.setItem('inspector-width', String(newWidth));
    };

    return (
        <CompanyViewerContext.Provider value={{
            viewerMode,
            activeLeadId,
            openOrUpdate,
            togglePin,
            close,
            pinnedWidth,
            resize
        }}>
            {children}
            {viewerMode === 'modal' && activeLeadId && (
                <CompanyOverviewModal leadId={activeLeadId} onClose={close} />
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
