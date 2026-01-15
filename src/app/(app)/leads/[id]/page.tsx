import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import prisma from '@/lib/prisma';

// New HQ Components
import KPIGrid from '@/components/company-hq/KPIGrid';
import WebsitePreview from '@/components/company-hq/WebsitePreview';
import ContactsCard from '@/components/company-hq/ContactsCard';
import ThreadPreview from '@/components/company-hq/ThreadPreview';
import { RefreshDataButton, WebsiteReviewCard, FinancialHealthCard } from '@/components/company-hq/LeadDetailActions';

// Legacy / Shared Components
import DraftEditor from '@/components/DraftEditor';
import StatusBadge from '@/components/StatusBadge';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import DebugPanel from '@/components/DebugPanel';

// FORCE DYNAMIC for fetching fresh data
export const dynamic = 'force-dynamic';

export default async function LeadDetail({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const leadId = parseInt(id);

    // Expanded Fetch
    const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        include: {
            companyProspect: true,
            drafts: { orderBy: { version: 'desc' } },
            contacts: { orderBy: { confidence: 'desc' } },
            sentEmails: { orderBy: { sentAt: 'desc' }, take: 1 } // Latest thread
        }
    });

    if (!lead) {
        return <div className="p-8">Lead not found</div>;
    }

    // Data Parsing
    const financialScore = lead.companyProspect?.financialActivityScore || 0;
    const financialBand = lead.companyProspect?.financialActivityBand || 'Unknown';
    const websiteScore = lead.companyProspect?.stalenessScore || 0;
    const outreachStatus = lead.emailStatus;

    let websiteSignals: string[] = [];
    if (lead.companyProspect?.signals) {
        try {
            const parsed = JSON.parse(lead.companyProspect.signals);
            if (Array.isArray(parsed)) websiteSignals = parsed;
        } catch (e) { }
    }

    let financialSignals: string[] = [];
    if (lead.companyProspect?.financialSignals) {
        try {
            const parsed = JSON.parse(lead.companyProspect.financialSignals);
            if (Array.isArray(parsed)) financialSignals = parsed;
        } catch (e) { }
    }

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            {/* 1. Header & Meta */}
            <div>
                <Link href="/" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 mb-6 transition">
                    <ArrowLeft size={16} className="mr-1" /> Back to Dashboard
                </Link>

                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2 items-center flex gap-3">
                            {lead.companyName}
                            <StatusBadge status={lead.emailStatus} />
                        </h1>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                            <a href={lead.websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-indigo-600 transition font-medium">
                                {new URL(lead.websiteUrl).hostname} <ExternalLink size={14} />
                            </a>
                            <span>•</span>
                            <span>{lead.industry || lead.companyProspect?.industry || 'Industry not set'}</span>
                            <span>•</span>
                            <span>{lead.location || lead.companyProspect?.registeredLocation || 'Location not set'}</span>
                        </div>
                    </div>
                    {/* Primary Actions */}
                    <div className="flex gap-3">
                        <RefreshDataButton
                            leadId={lead.id}
                            companyProspectId={lead.companyProspectId}
                        />
                    </div>
                </div>
            </div>

            {/* 2. KPI Grid */}
            <KPIGrid
                opportunityScore={lead.stalenessScore}
                financialScore={financialScore}
                financialBand={financialBand}
                websiteScore={websiteScore}
                outreachStatus={outreachStatus}
            />

            {/* 3. Main Dashboard Grid (2 Columns) */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

                {/* Left Column: Analysis (1 col) */}
                <div className="space-y-6 xl:col-span-1">
                    <WebsitePreview url={lead.websiteUrl} />
                    <WebsiteReviewCard signals={websiteSignals} websiteUrl={lead.websiteUrl} score={websiteScore} />
                    <FinancialHealthCard score={financialScore} band={financialBand} signals={financialSignals} />
                </div>

                {/* Right Column: Execution (2 cols) */}
                <div className="space-y-8 xl:col-span-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <ErrorBoundary sectionName="Contacts Widget">
                            <ContactsCard leadId={lead.id} contacts={(lead.contacts || []).map(c => ({
                                id: c.id,
                                firstName: c.firstName,
                                lastName: c.lastName,
                                title: c.title,
                                email: c.email,
                                confidence: c.confidence
                            }))} />
                        </ErrorBoundary>
                        <ErrorBoundary sectionName="Thread Widget">
                            <ThreadPreview sentEmails={(lead.sentEmails || []).map(e => ({
                                ...e,
                                sentAt: e.sentAt.toISOString(),
                                createdAt: e.createdAt.toISOString(),
                                updatedAt: e.updatedAt.toISOString()
                            }))} />
                        </ErrorBoundary>
                    </div>

                    {/* Composer Area */}
                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
                        <h3 className="text-sm font-semibold text-gray-900 mb-4">Outreach Composer</h3>
                        <ErrorBoundary sectionName="Draft Composer">
                            <DraftEditor
                                leadId={lead.id}
                                initialDraft={lead.emailDraft}
                                draftHistory={(lead.drafts || []).map(d => ({
                                    ...d,
                                    createdAt: d.createdAt.toISOString()
                                }))}
                            />
                        </ErrorBoundary>
                    </div>
                </div>
            </div>

            <DebugPanel data={{
                leadId: lead.id,
                companyName: lead.companyName,
                contactsCount: lead.contacts?.length,
                emailStatus: lead.emailStatus,
                financialScore
            }} />
        </div>
    );
}
