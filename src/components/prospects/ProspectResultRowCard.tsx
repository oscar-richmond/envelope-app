import { Building2, Plus, PenTool, Database, X, Eye, Maximize2 } from 'lucide-react';
import { CompanyNameLink } from '@/components/company/CompanyNameLink';
import MetricTile from './MetricTile';

interface ProspectResultRowCardProps {
    company: any;
    index: number;
    status?: string;

    // Actions / Handlers
    onAction: (action: 'ADD' | 'REJECT') => void;
    onCheckAddLead: () => void;
    onFindEmails: () => void;
    onDraftEmail: () => void;
    onViewLocation: () => void;

    // Evidence Handlers
    onMatchEvidence: () => void;
    onFinancialEvidence: () => void;
    onPriorityEvidence: () => void;

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
    // const handleMatchClick = (e: any) => { e.stopPropagation(); if (isMatched) onMatchEvidence(); else onFindWebsite(); };
    const formatLocation = (loc: string) => loc ? loc.split(',')[0] : 'Unknown Location';

    return (
        <div
            className={`
                group bg-white rounded-2xl border border-gray-200 py-3 px-4 transition-all duration-200
                hover:shadow-md hover:border-gray-300 relative
                ${status === 'ADDED' ? 'bg-green-50/30 border-green-200' : ''}
            `}
        >
            {/* Status Overlay (Added) */}
            {status === 'ADDED' && (
                <div className="absolute top-2 right-2 z-10 pointer-events-none">
                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold border border-green-200 flex items-center gap-1 shadow-sm">
                        ✓ Added
                    </span>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_180px] gap-4 items-center">

                {/* 1. Company Identity (Fixed 280px) */}
                <div className="flex flex-col gap-0.5 pr-4 border-r border-gray-100 lg:border-none min-w-0">
                    <CompanyNameLink
                        prospectId={c.id}
                        name={c.companyName}
                        className="font-semibold text-gray-900 text-base hover:text-indigo-600 transition truncate leading-tight block w-full"
                        onCompose={onDraftEmail}
                    />

                    <div className="flex items-center gap-1.5 text-xs text-gray-500 truncate w-full">
                        <span className="font-mono text-gray-400">{c.companyNumber}</span>
                        <span className="text-gray-300">•</span>
                        {c.location && (
                            <button onClick={onViewLocation} className="hover:text-indigo-600 hover:underline truncate">
                                {formatLocation(c.location)}
                            </button>
                        )}
                        <span className="text-gray-300">•</span>
                        <span className={`px-1 rounded text-[10px] ${c.companyStatus === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'}`}>
                            {c.companyStatus || 'active'}
                        </span>
                    </div>

                    <div className="flex flex-wrap gap-1 mt-1.5 h-6 overflow-hidden">
                        {c.sicCodes?.slice(0, 2).map((code: string) => (
                            <span key={code} className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full text-[10px] font-medium border border-gray-200">
                                {code}
                            </span>
                        ))}
                        {c.sicCodes?.length > 2 && (
                            <span className="bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full text-[10px] font-medium border border-gray-200">
                                +{c.sicCodes.length - 2}
                            </span>
                        )}
                    </div>
                </div>

                {/* 2. Metrics Strip (Flex 1) */}
                <div className="flex items-center justify-between gap-6 px-4 border-l border-gray-50 lg:border-none overflow-x-auto no-scrollbar">

                    {/* A. Website Match */}
                    <MetricTile
                        label="Website Match"
                        value={isMatched ? matchLabel : (isMatchLoading ? 'Searching...' : 'Not Matched')}
                        scoreColor={matchColor}
                        subtext={matchHelper}
                        onDetails={isMatched ? onMatchEvidence : undefined}
                        action={!isMatched ? (
                            <button onClick={onFindWebsite} className="text-xs text-blue-600 hover:underline font-medium">Find Website</button>
                        ) : undefined}
                    />

                    {/* B. Website Health */}
                    <MetricTile
                        label="Website Health"
                        value={c.websiteUrl ? staleLabel : '-'}
                        score={staleScore ?? undefined}
                        scoreColor={staleColor}
                        subtext={staleScore !== undefined ? (staleScore >= 60 ? 'Needs Update' : 'Active') : null}
                        onDetails={c.scoreReasons ? onPriorityEvidence : undefined}
                    />

                    {/* C. Financials */}
                    {finBand === 'Unknown' && !isFinancialLoading ? (
                        <MetricTile
                            label="Financial Health"
                            value="Unknown"
                            action={
                                <button
                                    onClick={onCheckFinancials}
                                    className="text-[10px] whitespace-nowrap bg-gray-50 border border-gray-200 rounded px-2 py-1 text-gray-600 hover:bg-white hover:text-indigo-600 transition"
                                >
                                    Check Info
                                </button>
                            }
                        />
                    ) : (
                        <MetricTile
                            label="Financial Health"
                            value={isFinancialLoading ? 'Analyzing...' : finBand}
                            score={finScore || undefined}
                            scoreColor={finColor}
                            subtext={c.financialLastCheckedAt ? 'Verified' : 'Unverified'}
                            onDetails={onFinancialEvidence}
                        />
                    )}

                    {/* D. Lead Opportunity */}
                    <MetricTile
                        label="Lead Opportunity"
                        value={priorityBand}
                        score={priorityScore || undefined}
                        scoreColor={priorityColor}
                        subtext="Based on signals"
                        onDetails={onPriorityEvidence}
                    />

                </div>

                {/* 3. Actions (Fixed 180px) */}
                <div className="flex flex-col items-end gap-2 justify-center pl-4 border-l border-gray-100 h-full">

                    {/* Primary CTA */}
                    {status !== 'ADDED' && (
                        <button
                            onClick={onCheckAddLead}
                            className="bg-gray-900 text-white hover:bg-black transition shadow-sm hover:shadow-md text-sm font-semibold px-5 py-2 rounded-full flex items-center justify-center gap-1.5 w-full"
                        >
                            <Plus size={16} /> Add
                        </button>
                    )}

                    {/* Quick Actions Label + Icons */}
                    <div className="flex flex-col items-end gap-1 w-full">
                        <span className="text-[9px] text-gray-300 uppercase tracking-widest font-bold pr-1">Quick Actions</span>
                        <div className="flex items-center gap-2 justify-end">
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
            className={`p-2 rounded-xl transition-all border ${colorStyles[baseColor]}`}
            title={label}
        >
            <Icon size={16} />
        </button>
    );
}
