import Link from 'next/link';
import { Eye, PenTool, MessageSquare, Trash2, ArrowRight } from 'lucide-react';
import { CompanyNameLink } from '@/components/company/CompanyNameLink';
import MetricTile from '@/components/prospects/MetricTile';

interface LeadResultRowCardProps {
    lead: any; // Ideally typed
    index: number;

    // Actions
    onCompose: () => void;
    onDelete: () => void;
}

export default function LeadResultRowCard({
    lead,
    index,
    onCompose,
    onDelete
}: LeadResultRowCardProps) {

    // --- Logic Helpers ---

    // Status Logic
    const status = lead.emailStatus || 'NEW';
    const isActive = status !== 'REJECTED' && status !== 'ARCHIVED';

    // Metrics (Similar logic to Prospect but reading from Lead model)
    // Assuming Lead model has snapshot scores or we pluck them.
    // If Lead model is simple, we might need to rely on what's passed.
    // Use fallbacks for now.

    const finScore = lead.financialScore ?? 0;
    const finBand = finScore > 75 ? 'Strong' : finScore > 50 ? 'Medium' : 'Low';

    const staleScore = lead.stalenessScore ?? 0;
    const staleLabel = staleScore >= 60 ? 'Outdated' : staleScore >= 30 ? 'Aging' : 'Fresh';

    const priority = lead.priorityScore ?? 0;
    const priorityBand = priority > 70 ? 'High' : priority > 40 ? 'Medium' : 'Low';

    return (
        <div
            className="group bg-white rounded-2xl border border-gray-200 p-2 pl-4 pr-2 transition-all duration-150 hover:shadow-md hover:border-gray-300 hover:bg-slate-50/20 relative"
        >
            <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr_260px] gap-4 items-center h-full">

                {/* 1. Company Identity (Fixed 320px) */}
                <div className="flex flex-col gap-1 pr-6 min-w-0 max-w-[340px] py-1">
                    <CompanyNameLink
                        prospectId={lead.companyProspectId} // If linked
                        leadId={lead.id}
                        name={lead.companyName}
                        className="font-bold text-gray-900 text-base hover:text-indigo-600 transition truncate leading-tight block w-full cursor-pointer"
                        onCompose={onCompose}
                    />

                    {/* Compact One-Line Meta */}
                    <div className="flex items-center gap-2 text-sm text-gray-500 whitespace-nowrap overflow-hidden text-ellipsis">
                        {lead.location ? (
                            <span className="truncate max-w-[100px]">{lead.location}</span>
                        ) : 'Unknown Loc'}
                        <span className="text-gray-300">•</span>
                        <span className="truncate max-w-[100px]">{lead.industry || 'Unknown Ind'}</span>
                    </div>

                    {/* Status Chips */}
                    <div className="mt-1.5 flex flex-wrap gap-2">
                        <span className={`px-2 py-0.5 rounded-md text-xs font-medium border
                            ${status === 'DRAFTED' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                status === 'SENT' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                    status === 'REPLIED' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                                        'bg-gray-50 text-gray-500 border-gray-100'
                            }`}
                        >
                            {status}
                        </span>
                        {lead.lastActivityAt && (
                            <span className="text-xs text-gray-400 flex items-center">
                                {new Date(lead.lastActivityAt).toLocaleDateString()}
                            </span>
                        )}
                    </div>
                </div>

                {/* 2. Signals Strip (Flex 1) */}
                <div className="grid grid-cols-3 gap-3 px-4 border-l border-gray-100 h-full items-center py-1">

                    {/* Lead Opp */}
                    <MetricTile
                        label="Lead Opp"
                        value={priorityBand}
                        score={priority}
                        scoreColor={priorityBand === 'High' ? 'purple' : 'gray'}
                    />

                    {/* Web Health */}
                    <MetricTile
                        label="Web Health"
                        value={staleLabel}
                        score={staleScore}
                        scoreColor={staleScore >= 60 ? 'red' : 'green'}
                    />

                    {/* Fin Health */}
                    <MetricTile
                        label="Fin Health"
                        value={finBand}
                        score={finScore}
                        scoreColor={finBand === 'Strong' ? 'green' : 'amber'}
                    />
                </div>

                {/* 3. Actions (Control Panel - 260px) */}
                <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-xl border border-gray-100 h-full justify-between">

                    <div className="flex gap-2 w-full">
                        <Link
                            href={`/leads/${lead.id}`}
                            className="flex-1 bg-white border border-gray-200 text-gray-900 hover:bg-gray-50 hover:text-indigo-600 transition shadow-sm text-sm font-semibold px-3 py-2 rounded-lg flex items-center justify-center gap-1.5"
                        >
                            Open
                        </Link>
                        <button
                            onClick={onCompose}
                            className="flex-1 bg-white border border-gray-200 text-gray-900 hover:bg-gray-50 hover:text-indigo-600 transition shadow-sm text-sm font-semibold px-3 py-2 rounded-lg flex items-center justify-center gap-1.5"
                        >
                            <PenTool size={14} /> Msg
                        </button>
                    </div>

                    <div className="flex items-center gap-1 border-l border-gray-200 pl-2">
                        {/* Thread / Notes / Remove */}
                        {/* Using simple buttons for now, can be TooltipButtons if imported */}
                        <button onClick={() => { }} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition" title="View Thread">
                            <MessageSquare size={16} />
                        </button>
                        <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition" title="Remove Lead">
                            <Trash2 size={16} />
                        </button>
                    </div>

                </div>

            </div>
        </div>
    );
}
