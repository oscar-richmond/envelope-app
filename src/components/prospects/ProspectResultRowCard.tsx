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

    let matchLabel = isMatched ? (matchConfidence === 'HIGH' ? 'High' : matchConfidence === 'MEDIUM' ? 'Medium' : 'Low') : 'No Match';
    let matchColor: any = isMatched ? (matchConfidence === 'HIGH' ? 'green' : matchConfidence === 'MEDIUM' ? 'amber' : 'red') : 'gray';
    let matchHelper = isMatched ? c.websiteUrl?.replace(/^https?:\/\/(www\.)?/, '') : 'No URL found';

    const normalizeUrl = (url: string) => {
        if (!url) return undefined;
        if (url.startsWith('http://') || url.startsWith('https://')) return url;
        return `https://${url}`;
    };
    const websiteLink = isMatched && c.websiteUrl ? normalizeUrl(c.websiteUrl) : undefined;

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

    // --- Formatting ---
    const formatLocation = (loc: string) => loc ? loc.split(',')[0] : 'Unknown';

    return (
        <div
            className="group relative transition-all duration-200"
            style={{
                background: status === 'ADDED' ? 'rgba(166, 244, 179, 0.08)' : 'var(--bg-card)',
                borderRadius: 'var(--radius-card)',
                border: status === 'ADDED' ? '1px solid rgba(166, 244, 179, 0.3)' : '1px solid var(--border-soft)',
                boxShadow: 'var(--shadow-card)',
                padding: '20px 24px'
            }}
        >
            {/* Status Overlay (Added) */}
            {status === 'ADDED' && (
                <div className="absolute top-4 right-4 z-10 pointer-events-none">
                    <span
                        className="px-2.5 py-1 rounded-[var(--radius-badge)] text-[10px] font-bold flex items-center gap-1"
                        style={{
                            background: 'var(--accent-mint-bg)',
                            color: 'var(--accent-mint-text)',
                            border: '1px solid rgba(166, 244, 179, 0.3)'
                        }}
                    >
                        ✓ Added
                    </span>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr_260px] gap-6 items-center h-full">

                {/* 1. Company Identity (Fixed 360px) */}
                <div className="flex flex-col gap-2 pr-6 min-w-0 max-w-[380px] py-1">
                    <CompanyNameLink
                        prospectId={c.id}
                        name={c.companyName}
                        className="font-bold text-lg transition truncate leading-snug block w-full cursor-pointer"
                        style={{
                            fontFamily: 'var(--font-display)',
                            color: 'var(--text-primary)',
                            letterSpacing: '-0.01em'
                        }}
                        onCompose={onDraftEmail}
                    />

                    {/* Compact One-Line Meta */}
                    <div
                        className="flex items-center gap-2 text-sm whitespace-nowrap overflow-hidden text-ellipsis leading-relaxed"
                        style={{ color: 'var(--text-secondary)' }}
                    >
                        <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{c.companyNumber}</span>
                        <span style={{ color: 'var(--border-default)' }}>•</span>
                        {c.location ? (
                            <button
                                onClick={onViewLocation}
                                className="hover:underline truncate max-w-[120px] transition-colors"
                                style={{ color: 'var(--text-secondary)' }}
                                title={c.location}
                            >
                                {formatLocation(c.location)}
                            </button>
                        ) : 'Unknown'}
                        <span style={{ color: 'var(--border-default)' }}>•</span>
                        <span
                            className="capitalize"
                            style={{ color: c.companyStatus === 'active' ? 'var(--success)' : 'var(--text-muted)' }}
                        >
                            {c.companyStatus || 'Active'}
                        </span>
                    </div>

                    {/* Compact Pills (Max 1 + overflow) */}
                    <div className="flex flex-wrap gap-1.5 mt-1 h-6 overflow-hidden">
                        {c.sicCodes?.slice(0, 1).map((code: string) => (
                            <span
                                key={code}
                                className="px-2.5 py-0.5 rounded-[var(--radius-badge)] text-xs truncate max-w-[200px]"
                                style={{
                                    background: 'var(--bg-card-muted)',
                                    color: 'var(--text-secondary)',
                                    border: '1px solid var(--border-soft)'
                                }}
                            >
                                {code}
                            </span>
                        ))}
                        {c.sicCodes?.length > 1 && (
                            <span
                                className="px-2 py-0.5 rounded-[var(--radius-badge)] text-xs"
                                style={{
                                    background: 'var(--bg-card-muted)',
                                    color: 'var(--text-muted)',
                                    border: '1px solid var(--border-soft)'
                                }}
                            >
                                +{c.sicCodes.length - 1}
                            </span>
                        )}
                    </div>
                </div>

                {/* 2. Metrics Grid (Flex 1 - Breathable) */}
                <div
                    className="grid grid-cols-2 lg:grid-cols-4 gap-5 px-6 h-full items-center py-1"
                    style={{ borderLeft: '1px solid var(--border-soft)' }}
                >

                    {/* B. Lead Opportunity (Priority) - 1st */}
                    <MetricTile
                        label="Lead Opportunity"
                        value={priorityBand}
                        score={priorityScore || undefined}
                        scoreColor={priorityColor}
                        subtext="Based on signals"
                        onDetails={onPriorityEvidence}
                    />

                    {/* C. Website Health - 2nd */}
                    <MetricTile
                        label="Website Health"
                        value={c.websiteUrl ? staleLabel : '-'}
                        score={staleScore ?? undefined}
                        scoreColor={staleColor}
                        subtext={staleScore !== undefined ? (staleScore >= 60 ? 'Needs Update' : 'Active') : null}
                        onDetails={c.scoreReasons ? onPriorityEvidence : undefined}
                    />

                    {/* D. Financials - 3rd */}
                    {finBand === 'Unknown' && !isFinancialLoading ? (
                        <MetricTile
                            label="Financial Health"
                            value="Unknown"
                            action={
                                <button
                                    onClick={onCheckFinancials}
                                    className="w-full text-xs font-semibold px-3 py-2 rounded-[var(--radius-button)] transition-all"
                                    style={{
                                        background: 'var(--bg-card)',
                                        border: '1px solid var(--border-default)',
                                        color: 'var(--text-primary)'
                                    }}
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

                    {/* A. Website Match - 4th */}
                    <MetricTile
                        label="Website Match"
                        value={isMatched ? matchLabel : (isMatchLoading ? 'Searching...' : 'Not Matched')}
                        scoreColor={matchColor}
                        subtext={matchHelper}
                        href={websiteLink}
                        action={!isMatched && !isMatchLoading ? (
                            <button
                                onClick={onFindWebsite}
                                className="text-xs font-semibold hover:underline transition-colors"
                                style={{ color: 'var(--accent-blue)' }}
                            >
                                Find Website
                            </button>
                        ) : undefined}
                    />

                </div>

                {/* 3. Actions (Control Panel) */}
                <div
                    className="flex flex-col items-center justify-center gap-3 p-4 h-full"
                    style={{
                        background: 'var(--bg-card-muted)',
                        borderRadius: 'var(--radius-xl)',
                        border: '1px solid var(--border-soft)'
                    }}
                >

                    {/* Primary CTA */}
                    {status !== 'ADDED' ? (
                        <button
                            onClick={onCheckAddLead}
                            className="text-sm font-semibold px-4 py-2.5 flex items-center justify-center gap-2 w-full transition-all"
                            style={{
                                background: 'var(--text-primary)',
                                color: 'white',
                                borderRadius: 'var(--radius-button)',
                                boxShadow: 'var(--shadow-card)'
                            }}
                        >
                            <Plus size={16} /> Add
                        </button>
                    ) : (
                        <div
                            className="w-full h-10 flex items-center justify-center text-xs font-semibold"
                            style={{
                                background: 'var(--accent-mint-bg)',
                                color: 'var(--accent-mint-text)',
                                borderRadius: 'var(--radius-button)',
                                border: '1px solid rgba(166, 244, 179, 0.3)'
                            }}
                        >
                            Added
                        </div>
                    )}

                    {/* Quick Actions Grid */}
                    <div className="flex items-center gap-2 justify-center w-full">
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
    // V2 Color styles with token-based values and always-visible accent colors
    const colorStyles: Record<string, { bg: string; border: string; color: string; hoverBg: string }> = {
        gray: {
            bg: 'var(--bg-card)',
            border: 'var(--border-default)',
            color: 'var(--text-muted)',
            hoverBg: 'var(--bg-card-muted)'
        },
        blue: {
            bg: 'var(--accent-blue-light)',
            border: 'rgba(99, 102, 241, 0.3)',
            color: 'var(--accent-blue)',
            hoverBg: 'rgba(99, 102, 241, 0.15)'
        },
        purple: {
            bg: 'var(--accent-lilac-bg)',
            border: 'rgba(184, 166, 255, 0.3)',
            color: 'var(--accent-lilac-text)',
            hoverBg: 'rgba(184, 166, 255, 0.2)'
        },
        teal: {
            bg: 'var(--accent-mint-bg)',
            border: 'rgba(166, 244, 179, 0.3)',
            color: 'var(--accent-mint-text)',
            hoverBg: 'rgba(166, 244, 179, 0.2)'
        },
        rose: {
            bg: 'var(--error-light)',
            border: 'rgba(255, 77, 77, 0.3)',
            color: 'var(--error-text)',
            hoverBg: 'rgba(255, 77, 77, 0.15)'
        }
    };

    const style = colorStyles[baseColor] || colorStyles.gray;

    return (
        <button
            onClick={onClick}
            className="p-2.5 transition-all"
            style={{
                background: style.bg,
                border: `1px solid ${style.border}`,
                color: style.color,
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-sm)'
            }}
            title={label}
        >
            <Icon size={16} />
        </button>
    );
}
