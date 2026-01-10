import { Building2, Plus, PenTool, Database, X, Eye, Maximize2 } from 'lucide-react';
import { CompanyNameLink } from '@/components/company/CompanyNameLink';
import SignalBlock from './SignalBlock';

interface ProspectResultRowCardProps {
    company: any;
    index: number;
    status?: string;

    // Actions / Handlers
    onAction: (action: 'ADD' | 'REJECT') => void;
    onCheckAddLead: () => void; // Smart gating wrapper around Add
    onFindEmails: () => void;
    onDraftEmail: () => void;
    onViewLocation: () => void;

    // Evidence Handlers
    onMatchEvidence: () => void;
    onFinancialEvidence: () => void;
    onPriorityEvidence: () => void;
    onWebsiteEvidence?: () => void; // Optional if we break it down

    // Logic Triggers
    onFindWebsite: () => void;
    onCheckFinancials: () => void;
    onRefreshAnalysis: () => void;

    isFinancialLoading?: boolean;
    isMatchLoading?: boolean;
}

export default function ProspectResultRowCard({
    company: c,
    index,
    status,
    onAction,
    onCheckAddLead,
    onFindEmails,
    onDraftEmail,
    onViewLocation,
    onMatchEvidence,
    onFinancialEvidence,
    onPriorityEvidence,
    onFindWebsite,
    onCheckFinancials,
    onRefreshAnalysis,
    isFinancialLoading,
    isMatchLoading
}: ProspectResultRowCardProps) {

    // --- Helpers for Display ---

    // Website Match Logic
    const matchStatus = c.websiteMatchStatus || 'NEW';
    const matchConfidence = c.websiteConfidence || 'LOW';
    const isMatched = matchStatus === 'MATCHED' || (matchStatus === 'NEW' && c.websiteUrl);

    let matchLabel = isMatched ? (matchConfidence === 'HIGH' ? 'High Match' : matchConfidence === 'MEDIUM' ? 'Medium Match' : 'Low Match') : 'No Match';
    let matchColor: any = isMatched ? (matchConfidence === 'HIGH' ? 'green' : matchConfidence === 'MEDIUM' ? 'amber' : 'red') : 'gray';
    let matchHelper = isMatched ? c.websiteUrl?.replace(/^https?:\/\/(www\.)?/, '') : 'No URL found';

    // Financial Logic
    const finScore = c.financialActivityScore || 0;
    const finBand = c.financialActivityBand || 'Unknown';
    let finColor: any = finBand === 'Very Strong' || finBand === 'Strong' ? 'green' : finBand === 'Medium' ? 'amber' : 'gray';
    if (finBand === 'Low' || finBand === 'Very Low') finColor = 'red';

    // Website Health (Staleness) Logic
    const staleScore = c.stalenessScore;
    let staleLabel = 'Pending';
    let staleColor: any = 'gray';

    if (staleScore !== undefined && staleScore !== null) {
        if (staleScore >= 60) { staleLabel = 'Outdated'; staleColor = 'red'; }
        else if (staleScore >= 30) { staleLabel = 'Aging'; staleColor = 'amber'; }
        else { staleLabel = 'Fresh'; staleColor = 'green'; }
    }

    // Lead Priority Logic
    const priorityBand = c.contactPriorityBand || '-';
    let priorityColor: any = priorityBand === 'High' ? 'purple' : priorityBand === 'Medium' ? 'blue' : 'gray';
    const priorityScore = c.contactPriorityScore;

    // --- Interaction Wrappers ---
    const handleMatchClick = (e: any) => { e.stopPropagation(); if (isMatched) onMatchEvidence(); else onFindWebsite(); };

    return (
        <div
            className={`
                group bg-white rounded-xl border border-gray-200 p-4 transition-all duration-200
                hover:shadow-md hover:border-gray-300 relative
                ${status === 'ADDED' ? 'bg-green-50/30 border-green-200' : ''}
            `}
        >
            {/* Status Overlay (Added/Rejected) */}
            {status === 'ADDED' && (
                <div className="absolute top-3 right-3 z-10">
                    <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold border border-green-200 flex items-center gap-1">
                        ✓ Added
                    </span>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">

                {/* 1. Company Identity (4 Cols) */}
                <div className="lg:col-span-4 flex flex-col gap-1 pr-4 border-r border-gray-100 lg:border-none">
                    <CompanyNameLink
                        prospectId={c.id}
                        name={c.companyName}
                        className="font-bold text-gray-900 text-lg hover:text-indigo-600 transition truncate leading-tight"
                        onCompose={onDraftEmail}
                    />

                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                        <span className="font-mono bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">{c.companyNumber}</span>
                        {c.location && (
                            <button onClick={onViewLocation} className="hover:text-indigo-600 hover:underline truncate max-w-[120px]">
                                {c.location}
                            </button>
                        )}
                        <span className="text-gray-300">•</span>
                        <span className="truncate max-w-[140px]">{c.industry || 'Unknown Sector'}</span>
                    </div>

                    <div className="flex flex-wrap gap-1 mt-2">
                        {c.sicCodes?.slice(0, 2).map((code: string) => (
                            <span key={code} className="bg-gray-50 text-gray-500 border border-gray-200 px-1.5 py-0.5 rounded text-[10px]">
                                {code}
                            </span>
                        ))}
                        {c.sicCodes?.length > 2 && (
                            <span className="bg-gray-50 text-gray-400 border border-gray-200 px-1.5 py-0.5 rounded text-[10px]">
                                +{c.sicCodes.length - 2}
                            </span>
                        )}
                    </div>
                </div>

                {/* 2. Signals Grid (6 cols) */}
                <div className="lg:col-span-6 grid grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-y-4 gap-x-2">

                    {/* A. Website Match */}
                    <SignalBlock
                        label="Website Match"
                        value={isMatched ? matchLabel : (isMatchLoading ? 'Searching...' : 'Not Matched')}
                        scoreColor={matchColor}
                        helper={
                            isMatched ? (
                                <a href={c.websiteUrl} target="_blank" className="hover:underline text-blue-600 truncate block">
                                    {matchHelper}
                                </a>
                            ) : (
                                <button onClick={onFindWebsite} className="text-blue-600 hover:underline">Find Website</button>
                            )
                        }
                        onExplain={isMatched ? onMatchEvidence : undefined}
                    />

                    {/* B. Website Health */}
                    <SignalBlock
                        label="Website Health"
                        value={c.websiteUrl ? staleLabel : '-'}
                        score={staleScore ?? undefined}
                        scoreColor={staleColor}
                        helper={staleScore !== undefined ? (staleScore >= 60 ? 'Needs Update' : 'Active') : null}
                        onExplain={c.scoreReasons ? onPriorityEvidence : undefined} // Sharing modal for now
                    />

                    {/* C. Financials */}
                    {finBand === 'Unknown' && !isFinancialLoading ? (
                        <div className="flex flex-col min-w-[120px] justify-center">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Financial Health</span>
                            <button
                                onClick={onCheckFinancials}
                                className="text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1 text-gray-600 hover:bg-white hover:text-indigo-600 transition"
                            >
                                Check Financials
                            </button>
                        </div>
                    ) : (
                        <SignalBlock
                            label="Financial Health"
                            value={isFinancialLoading ? 'Analyzing...' : finBand}
                            score={finScore || undefined}
                            scoreColor={finColor}
                            helper={c.financialLastCheckedAt ? 'Verified' : 'Unverified'}
                            onExplain={onFinancialEvidence}
                        />
                    )}

                    {/* D. Lead Opportunity */}
                    <SignalBlock
                        label="Lead Opportunity"
                        value={priorityBand}
                        score={priorityScore || undefined}
                        scoreColor={priorityColor}
                        helper="Based on all signals"
                        onExplain={onPriorityEvidence}
                    />

                </div>

                {/* 3. Actions (2 cols) - Stacked / Aligned */}
                <div className="lg:col-span-2 flex flex-col sm:flex-row lg:flex-col lg:items-end gap-3 justify-center pl-2 border-l border-gray-100 lg:border-none">

                    {/* Primary CTA */}
                    {status !== 'ADDED' && (
                        <button
                            onClick={onCheckAddLead}
                            className="bg-gray-900 text-white hover:bg-black transition shadow-lg shadow-gray-200 text-sm font-semibold px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 w-full sm:w-auto lg:w-full"
                        >
                            <Plus size={16} /> Add
                        </button>
                    )}

                    {/* Secondary Icon Row */}
                    <div className="flex items-center gap-2 mt-1 justify-end w-full">
                        <TooltipButton
                            icon={Maximize2}
                            onClick={() => document.getElementById(`company-link-${c.id}`)?.click()}
                            label="Inspect"
                            baseColor="blue"
                        />
                        <TooltipButton
                            icon={PenTool}
                            onClick={onDraftEmail}
                            label="Compose"
                            baseColor="purple"
                        />
                        <TooltipButton
                            icon={Database}
                            onClick={onFindEmails}
                            label="Find Emails"
                            baseColor="teal"
                        />
                        {status !== 'ADDED' && (
                            <TooltipButton
                                icon={X}
                                onClick={() => onAction('REJECT')}
                                label="Remove"
                                baseColor="rose"
                            />
                        )}
                    </div>

                </div>

            </div>
        </div>
    );
}

function TooltipButton({ icon: Icon, onClick, label, baseColor = "gray" }: any) {
    const colorStyles: any = {
        gray: "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100 hover:border-gray-300 hover:text-gray-700",
        blue: "bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100 hover:border-blue-300 hover:text-blue-700",
        purple: "bg-purple-50 border-purple-200 text-purple-600 hover:bg-purple-100 hover:border-purple-300 hover:text-purple-700",
        teal: "bg-teal-50 border-teal-200 text-teal-600 hover:bg-teal-100 hover:border-teal-300 hover:text-teal-700",
        rose: "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100 hover:border-rose-300 hover:text-rose-700"
    };

    return (
        <button
            onClick={onClick}
            className={`p-2.5 rounded-xl transition-all border ${colorStyles[baseColor]}`}
            title={label}
        >
            <Icon size={18} />
        </button>
    );
}
