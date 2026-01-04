import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import prisma from '@/lib/prisma';
import AnalysisCard from '@/components/AnalysisCard';
import AnalysisButton from '@/components/AnalysisButton';
import StatusBadge from '@/components/StatusBadge';
import DraftEditor from '@/components/DraftEditor';
import ContactList from '@/components/ContactList';

// FORCE DYNAMIC for fetching fresh data
export const dynamic = 'force-dynamic';

export default async function LeadDetail({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const leadId = parseInt(id);
    const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        include: {
            drafts: { orderBy: { version: 'desc' } },
            contacts: { orderBy: { confidence: 'desc' } }
        }
    });

    if (!lead) {
        return <div className="p-8">Lead not found</div>;
    }

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <Link href="/" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 mb-6 transition">
                <ArrowLeft size={16} className="mr-1" /> Back to List
            </Link>

            <header className="flex justify-between items-start mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">{lead.companyName}</h1>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                        <a href={lead.websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-blue-600 transition">
                            {lead.websiteUrl} <ExternalLink size={14} />
                        </a>
                        <span>•</span>
                        <span>{lead.industry || 'Unknown Industry'}</span>
                        <span>•</span>
                        <span>{lead.location || 'Unknown Location'}</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <StatusBadge status={lead.emailStatus} />
                    <AnalysisButton leadId={lead.id} />
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <section>
                        <AnalysisCard lead={lead} />
                    </section>

                    <section>
                        <DraftEditor
                            leadId={lead.id}
                            initialDraft={lead.emailDraft}
                            draftHistory={lead.drafts.map(d => ({
                                ...d,
                                createdAt: d.createdAt.toISOString()
                            }))}
                        />
                    </section>
                </div>

                <div className="lg:col-span-1">
                    <ContactList leadId={lead.id} initialContacts={lead.contacts} />
                </div>
            </div>
        </div>
    );
}
