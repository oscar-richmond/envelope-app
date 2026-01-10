'use client';

import { useEffect, useState } from 'react';
import { X, ExternalLink, Maximize2, GalleryHorizontalEnd } from 'lucide-react';
import Link from 'next/link';
import { useCompanyViewer } from '@/components/modals/CompanyViewerProvider';
import Modal from '@/components/ui/Modal'; // Assuming generic Modal, but implementing custom for specific layout needs if strictly required. 
// Using a custom overlay for now to match specific layout specs (large width)

import KPIGrid from '@/components/company-hq/KPIGrid';
import WebsitePreview from '@/components/company-hq/WebsitePreview';
import WebsiteAudit from '@/components/company-hq/WebsiteAudit';
import FinancialHealth from '@/components/company-hq/FinancialHealth';
import ContactsCard from '@/components/company-hq/ContactsCard';
import WebsiteEvidenceModal from '@/components/modals/WebsiteEvidenceModal';
import FinancialReportModal from '@/components/modals/FinancialReportModal';

// ... (imports remain)

export default function CompanyOverviewModal({ leadId, onClose }: CompanyOverviewModalProps) {
    const { togglePin } = useCompanyViewer();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [isWebsiteModalOpen, setIsWebsiteModalOpen] = useState(false);
    const [isFinancialModalOpen, setIsFinancialModalOpen] = useState(false);

    // ... (useEffect fetches remain)

    // ... (Escape handler remains)

    // ... (Loading state remains)

    if (!data) return null;

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                {/* Backdrop click to close */}
                <div className="absolute inset-0" onClick={onClose} />

                <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col relative z-10 overflow-hidden">
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-3">
                                {data.companyName}
                                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-gray-100 text-gray-600`}>
                                    {data.outreach.status}
                                </span>
                            </h2>
                            <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                                <a href={data.websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-indigo-600 transition">
                                    {new URL(data.websiteUrl).hostname} <ExternalLink size={12} />
                                </a>
                                <span>•</span>
                                <span>{data.industry || 'Unknown'}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">

                            {/* Pin Button */}
                            <button onClick={togglePin} className="btn btn-secondary text-xs" title="Pin to side">
                                <GalleryHorizontalEnd size={14} className="mr-2" /> Pin Inspector
                            </button>

                            <Link href={`/leads/${leadId}`} className="btn btn-secondary text-xs" onClick={onClose}>
                                <Maximize2 size={14} className="mr-2" /> Open Full Page
                            </Link>
                            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition">
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Scrollable Body */}
                    <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
                        <div className="mb-6">
                            <KPIGrid
                                opportunityScore={data.kpis.opportunityScore}
                                financialScore={data.kpis.financialScore}
                                financialBand={data.kpis.financialBand}
                                websiteScore={data.kpis.websiteScore}
                                outreachStatus={data.outreach.status}
                            />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Analysis Column */}
                            <div className="space-y-6">
                                <WebsitePreview url={data.websiteUrl} />
                                <WebsiteAudit
                                    signals={Array.isArray(data.websiteSignals) ? data.websiteSignals : []}
                                    websiteUrl={data.websiteUrl}
                                    onViewEvidence={() => setIsWebsiteModalOpen(true)}
                                />
                                <FinancialHealth
                                    score={data.kpis.financialScore}
                                    band={data.kpis.financialBand}
                                    signals={Array.isArray(data.financialSignals) ? data.financialSignals : (data.financialSignals?.details || [])}
                                    onFullReport={() => setIsFinancialModalOpen(true)}
                                />
                            </div>

                            {/* Execution Column */}
                            <div className="space-y-6">
                                <ContactsCard leadId={leadId} contacts={data.contacts || []} />
                                <ThreadPreview sentEmails={data.sentEmails || []} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Evidence Modals */}
            <WebsiteEvidenceModal
                isOpen={isWebsiteModalOpen}
                onClose={() => setIsWebsiteModalOpen(false)}
                evidence={Array.isArray(data.websiteSignals) ? data.websiteSignals : []}
                url={data.websiteUrl}
            />

            <FinancialReportModal
                isOpen={isFinancialModalOpen}
                onClose={() => setIsFinancialModalOpen(false)}
                score={data.kpis.financialScore}
                band={data.kpis.financialBand}
                evidence={data.financialSignals}
                companyName={data.companyName}
            />
        </>
    );
}
