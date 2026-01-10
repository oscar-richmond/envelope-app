'use client';

import { useState, useEffect, useRef } from 'react';
import { X, ExternalLink, Maximize2, PinOff, GripVertical } from 'lucide-react';
import Link from 'next/link';
import { useCompanyViewer } from '@/components/modals/CompanyViewerProvider';

// HQ Components
import KPIGrid from '@/components/company-hq/KPIGrid';
import WebsiteAudit from '@/components/company-hq/WebsiteAudit';
import FinancialHealth from '@/components/company-hq/FinancialHealth';
import ContactsCard from '@/components/company-hq/ContactsCard';
import ThreadPreview from '@/components/company-hq/ThreadPreview';

import WebsiteEvidenceModal from '@/components/modals/WebsiteEvidenceModal';
import FinancialReportModal from '@/components/modals/FinancialReportModal';

export default function CompanyInspector() {
    const { activeLeadId, close, togglePin, pinnedWidth, resize } = useCompanyViewer();
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'Overview' | 'Contacts' | 'Thread'>('Overview');

    // Modal State
    const [isWebsiteModalOpen, setIsWebsiteModalOpen] = useState(false);
    const [isFinancialModalOpen, setIsFinancialModalOpen] = useState(false);

    // Resizing Logic
    const isResizing = useRef(false);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing.current) return;
            // Calculate new width: Window Width - Mouse X
            const newWidth = window.innerWidth - e.clientX;
            resize(newWidth);
        };

        const handleMouseUp = () => {
            isResizing.current = false;
            document.body.style.cursor = 'default';
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [resize]);

    // Data Fetching
    useEffect(() => {
        if (!activeLeadId) return;
        async function fetchData() {
            setLoading(true);
            try {
                const res = await fetch(`/api/company/${activeLeadId}/overview`);
                if (res.ok) setData(await res.json());
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [activeLeadId]);

    if (!activeLeadId) return null;

    return (
        <div
            className="h-screen bg-white border-l border-gray-200 shadow-xl flex flex-col relative shrink-0 transition-none"
            style={{ width: pinnedWidth }}
        >
            {/* Resize Handle */}
            <div
                className="absolute left-0 top-0 bottom-0 w-1 hover:bg-indigo-500 cursor-ew-resize z-50 group flex items-center justify-center -ml-0.5"
                onMouseDown={() => {
                    isResizing.current = true;
                    document.body.style.cursor = 'ew-resize';
                }}
            >
                <div className="h-8 w-1 rounded-full bg-gray-300 group-hover:bg-indigo-400" />
            </div>

            {/* Header */}
            <div className="px-5 py-3 border-b border-gray-100 flex items-start justify-between bg-white shrink-0 z-20">
                <div className="min-w-0 pr-2">
                    {loading ? (
                        <div className="h-5 w-32 bg-gray-100 rounded animate-pulse" />
                    ) : (
                        <h2 className="text-lg font-bold text-gray-900 truncate leading-snug">
                            {data?.companyName}
                        </h2>
                    )}
                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                        {data?.websiteUrl ? (
                            <a href={data.websiteUrl} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 truncate flex items-center gap-1">
                                {new URL(data.websiteUrl).hostname} <ExternalLink size={10} />
                            </a>
                        ) : (
                            <span className="italic">No website</span>
                        )}
                        <span>•</span>
                        <span>{data?.industry || 'Unknown'}</span>
                    </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <Link
                        href={`/leads/${activeLeadId}`}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-md hover:bg-gray-50 transition"
                        title="Open Full Page"
                    >
                        <Maximize2 size={18} />
                    </Link>
                    <button onClick={close} className="p-1.5 text-gray-400 hover:text-rose-600 rounded-md hover:bg-gray-50 transition" title="Close Panel">
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="px-5 pt-0 border-b border-gray-100 flex gap-6 text-xs font-semibold text-gray-500 bg-white z-10 sticky top-0">
                {['Overview', 'Contacts', 'Thread'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={`py-3 border-b-2 transition-all ${activeTab === tab
                            ? 'text-indigo-600 border-indigo-600'
                            : 'border-transparent hover:text-gray-900'
                            }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto bg-gray-50/50 p-5">
                {loading && !data ? (
                    <div className="space-y-4 animate-pulse">
                        <div className="h-32 bg-gray-200 rounded-xl" />
                        <div className="h-48 bg-gray-200 rounded-xl" />
                    </div>
                ) : data ? (
                    <>
                        {activeTab === 'Overview' && (
                            <div className="space-y-5">
                                <KPIGrid
                                    opportunityScore={data.kpis.opportunityScore}
                                    financialScore={data.kpis.financialScore}
                                    financialBand={data.kpis.financialBand}
                                    websiteScore={data.kpis.websiteScore}
                                    outreachStatus={data.outreach.status}
                                    isSidebar={true}
                                />
                                <WebsiteAudit
                                    signals={data.websiteSignals}
                                    websiteUrl={data.websiteUrl}
                                    onViewEvidence={() => setIsWebsiteModalOpen(true)}
                                />
                                <FinancialHealth
                                    score={data.kpis.financialScore}
                                    band={data.kpis.financialBand}
                                    signals={data.financialSignals}
                                    onFullReport={() => setIsFinancialModalOpen(true)}
                                />

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
                            </div>
                        )}

                        {activeTab === 'Contacts' && (
                            <ContactsLoader leadId={activeLeadId!} />
                        )}

                        {activeTab === 'Thread' && (
                            <ThreadLoader leadId={activeLeadId!} />
                        )}
                    </>
                ) : null}
            </div>
        </div>
    );
}

// Reuse loaders
function ContactsLoader({ leadId }: { leadId: number }) {
    const [contacts, setContacts] = useState([]);
    useEffect(() => {
        fetch(`/api/company/${leadId}/contacts`, { method: 'POST' }).then(r => r.json()).then(d => setContacts(d.contacts || []));
    }, [leadId]);
    return <ContactsCard leadId={leadId} contacts={contacts} />;
}

function ThreadLoader({ leadId }: { leadId: number }) {
    const [emails, setEmails] = useState<any[]>([]);
    useEffect(() => {
        fetch(`/api/company/${leadId}/overview`).then(r => r.json()).then(d => {
            if (d.sentEmails) setEmails(d.sentEmails);
        });
    }, [leadId]);
    return <ThreadPreview sentEmails={emails} />;
}
