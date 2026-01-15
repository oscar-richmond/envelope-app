import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import prisma from '@/lib/prisma';

// New HQ Components
import KPIGrid from '@/components/company-hq/KPIGrid';
import WebsitePreview from '@/components/company-hq/WebsitePreview';
import ContactsCard from '@/components/company-hq/ContactsCard';
import ThreadPreview from '@/components/company-hq/ThreadPreview';
import { RefreshDataButton, WebsiteReviewCard, FinancialHealthCard } from '@/components/company-hq/LeadDetailActions';
import FloatingComposerButton from '@/components/company-hq/FloatingComposerButton';

// Legacy / Shared Components
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
            sentEmails: { orderBy: { sentAt: 'desc' }, take: 1 }
        }
    });

    if (!lead) {
        return <div className="p-8">Lead not found</div>;
    }

    // Parse webHealthData JSON for score and signals
    let websiteScore = 0;
    let websiteSignals: string[] = [];
    if (lead.companyProspect?.webHealthData) {
        try {
            const parsed = JSON.parse(lead.companyProspect.webHealthData);
            websiteScore = parsed.score ?? lead.companyProspect?.stalenessScore ?? 0;
            // Check multiple possible signal sources in webHealthData
            if (Array.isArray(parsed.signals) && parsed.signals.length > 0) {
                websiteSignals = parsed.signals;
            } else if (Array.isArray(parsed.breakdown) && parsed.breakdown.length > 0) {
                // Extract labels from breakdown objects if signals is empty
                websiteSignals = parsed.breakdown.map((b: any) => b.label || b.text || String(b));
            }
        } catch (e) { /* ignore */ }
    }

    // Fallbacks: try websiteSignals field, then scoreReasons
    if (websiteSignals.length === 0) {
        websiteScore = websiteScore || (lead.companyProspect?.stalenessScore ?? 0);
        // Try websiteSignals field
        if (lead.companyProspect?.websiteSignals) {
            try {
                const parsed = JSON.parse(lead.companyProspect.websiteSignals);
                if (Array.isArray(parsed)) websiteSignals = parsed;
            } catch (e) { /* ignore */ }
        }
        // Try scoreReasons field
        if (websiteSignals.length === 0 && lead.companyProspect?.scoreReasons) {
            try {
                const parsed = JSON.parse(lead.companyProspect.scoreReasons);
                if (Array.isArray(parsed)) websiteSignals = parsed;
            } catch (e) { /* ignore */ }
        }
        // Try legacy signals field
        if (websiteSignals.length === 0 && lead.companyProspect?.signals) {
            try {
                const parsed = JSON.parse(lead.companyProspect.signals);
                if (Array.isArray(parsed)) websiteSignals = parsed;
            } catch (e) { /* ignore */ }
        }
    }

    // Parse finHealthData JSON for score, band and signals
    let financialScore = 0;
    let financialBand = 'Unknown';
    let financialSignals: string[] = [];
    if (lead.companyProspect?.finHealthData) {
        try {
            const parsed = JSON.parse(lead.companyProspect.finHealthData);
            financialScore = parsed.score ?? lead.companyProspect?.financialActivityScore ?? 0;
            financialBand = parsed.band ?? lead.companyProspect?.financialActivityBand ?? 'Unknown';
            // breakdown is array of objects, extract labels as strings
            if (Array.isArray(parsed.breakdown) && parsed.breakdown.length > 0) {
                financialSignals = parsed.breakdown.map((b: any) => {
                    if (typeof b === 'string') return b;
                    return b.label || b.text || b.title || JSON.stringify(b);
                });
            } else if (Array.isArray(parsed.signals) && parsed.signals.length > 0) {
                financialSignals = parsed.signals;
            }
        } catch (e) { /* ignore */ }
    }

    // Fallbacks if finHealthData didn't provide signals
    if (financialSignals.length === 0) {
        financialScore = financialScore || (lead.companyProspect?.financialActivityScore ?? 0);
        financialBand = financialBand || (lead.companyProspect?.financialActivityBand ?? 'Unknown');
        // Try financialSignals field
        if (lead.companyProspect?.financialSignals) {
            try {
                const parsed = JSON.parse(lead.companyProspect.financialSignals);
                if (Array.isArray(parsed)) {
                    // Handle both string arrays and object arrays
                    financialSignals = parsed.map((item: any) => {
                        if (typeof item === 'string') return item;
                        return item.label || item.text || item.title || JSON.stringify(item);
                    });
                }
            } catch (e) { /* ignore */ }
        }
    }

    const outreachStatus = lead.emailStatus;

    // Industry with proper fallback (NOT status)
    const industry = lead.industry || lead.companyProspect?.industry || lead.companyProspect?.sicDescription || 'Industry not set';

    // Prepare contacts for components
    const contactsData = (lead.contacts || []).map(c => ({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        title: c.title,
        email: c.email,
        confidence: c.confidence
    }));

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
                        <div className="flex items-center gap-2 text-sm text-gray-500 flex-wrap">
                            <a href={lead.websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-indigo-600 transition font-medium">
                                {new URL(lead.websiteUrl).hostname} <ExternalLink size={14} />
                            </a>
                            <span>·</span>
                            <span>{lead.location || lead.companyProspect?.registeredLocation || 'Unknown location'}</span>
                            <span>·</span>
                            <span>{industry}</span>
                            <span>·</span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
                                Active
                            </span>
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
                    <WebsiteReviewCard
                        signals={websiteSignals}
                        websiteUrl={lead.websiteUrl}
                        score={websiteScore}
                        leadId={lead.id}
                        companyProspectId={lead.companyProspectId}
                    />
                    <FinancialHealthCard
                        score={financialScore}
                        band={financialBand}
                        signals={financialSignals}
                        leadId={lead.id}
                        companyProspectId={lead.companyProspectId}
                    />
                </div>

                {/* Right Column: Execution (2 cols) */}
                <div className="space-y-8 xl:col-span-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <ErrorBoundary sectionName="Contacts Widget">
                            <ContactsCard
                                leadId={lead.id}
                                prospectId={lead.companyProspectId || undefined}
                                contacts={contactsData}
                            />
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
                </div>
            </div>

            {/* Floating Composer Button */}
            <FloatingComposerButton
                leadId={lead.id}
                companyName={lead.companyName}
                contacts={contactsData}
                existingEmailId={lead.sentEmails?.[0]?.id || null}
            />

            <DebugPanel data={{
                leadId: lead.id,
                companyName: lead.companyName,
                contactsCount: lead.contacts?.length,
                emailStatus: lead.emailStatus,
                financialScore,
                websiteScore,
                industry
            }} />
        </div>
    );
}
