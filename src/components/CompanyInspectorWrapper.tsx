'use client';

import { ReactNode } from 'react';
import { useCompanyViewer } from '@/components/modals/CompanyViewerProvider';
import CompanyInspector from '@/components/company-hq/CompanyInspector';

export default function CompanyInspectorWrapper({ children }: { children: ReactNode }) {
    const { viewerMode } = useCompanyViewer();

    return (
        <div className="flex flex-1 w-full overflow-hidden">
            <main className="flex-1 overflow-auto min-w-0 transition-all duration-300">
                {children}
            </main>

            {/* Render Inspector if pinned */}
            {viewerMode === 'pinned' && (
                <CompanyInspector />
            )}
        </div>
    );
}
