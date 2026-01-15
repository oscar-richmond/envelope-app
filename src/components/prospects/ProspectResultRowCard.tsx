import { Building2, Plus, PenTool, Database, X, Eye, Maximize2 } from 'lucide-react';
import { CompanyName } from '@/components/company/CompanyName';
import MetricTile from './MetricTile';
import { getWebsiteHealthDisplay } from '@/lib/scoring/websiteHealthUtils';

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
    onInspect: () => void; // Opens company overview modal

    // Evidence Handlers
    onMatchEvidence: () => void;
    onFinancialEvidence: () => void;
    onPriorityEvidence: () => void;
    onWebsiteHealthEvidence: () => void;

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
    onInspect,
    onMatchEvidence,
    onFinancialEvidence,
    onPriorityEvidence,
    onWebsiteHealthEvidence,
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

    // Website Health (Staleness) Logic - using unified utility
    const webHealth = getWebsiteHealthDisplay({
        stalenessScore: c.stalenessScore,
        lastAnalysedAt: c.lastAnalysedAt || c.lastAnalyzedAt,
        websiteUrl: c.websiteUrl,
        stalenessConfidence: c.stalenessConfidence,
        scoreReasons: c.scoreReasons
    });
    const staleScore = webHealth.showScore ? webHealth.score : null;
    const staleLabel = webHealth.label;
    const staleColor = webHealth.color === 'red' ? 'red'
        : webHealth.color === 'orange' ? 'amber'
            : webHealth.color === 'amber' ? 'amber'
                : webHealth.color === 'green' ? 'green'
                    : 'gray';

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

            <div className="grid grid-cols-1 lg:grid-cols-[270px_1fr_auto] gap-4 items-center h-full">

                {/* 1. Company Identity (Fixed 270px - reduced from 360px for more card space) */}
                <div className="flex flex-col gap-1.5 pr-4 min-w-0 max-w-[280px] py-1">
                    <CompanyName
                        company={c}
                        prospectId={c.id}
                        variant="row"
                        className="font-bold text-base truncate leading-snug block w-full"
                        style={{
                            fontFamily: 'var(--font-display)',
                            color: 'var(--text-primary)',
                            letterSpacing: '-0.01em'
                        }}
                    />

                    {/* Compact One-Line Meta */}
                    <div
                        className="flex items-center gap-1.5 text-xs whitespace-nowrap overflow-hidden text-ellipsis leading-relaxed"
                        style={{ color: 'var(--text-secondary)' }}
                    >
                        <span className="font-mono text-[11px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{c.companyNumber}</span>
                        <span style={{ color: 'var(--border-default)' }}>•</span>
                        {c.location ? (
                            <button
                                onClick={onViewLocation}
                                className="hover:underline truncate max-w-[90px] transition-colors"
                                style={{ color: 'var(--text-secondary)' }}
                                title={c.location}
                            >
                                {formatLocation(c.location)}
                            </button>
                        ) : 'Unknown'}
                        <span style={{ color: 'var(--border-default)' }}>•</span>
                        <span
                            className="capitalize flex-shrink-0"
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
                    className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-4 h-full items-center py-1"
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
                        onDetails={c.scoreReasons ? onWebsiteHealthEvidence : undefined}
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

                {/* 3. Action Stack (Fixed Width Container) */}
                <div
                    className="justify-self-end"
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '12px',
                        background: 'var(--bg-card-muted)',
                        borderRadius: 'var(--radius-xl)',
                        border: '1px solid var(--border-soft)',
                        width: 'fit-content',
                        minWidth: status !== 'ADDED' ? '184px' : '152px'
                    }}
                >

                    {/* Primary CTA - Dark style for "Add" anchor action */}
                    {status !== 'ADDED' ? (
                        <button
                            onClick={onCheckAddLead}
                            className="btn btn-dark text-sm font-semibold flex items-center justify-center gap-2"
                            style={{
                                height: '40px',
                                width: '100%',
                                borderRadius: 'var(--radius-button)'
                            }}
                        >
                            <Plus size={15} /> Add
                        </button>
                    ) : (
                        <div
                            className="flex items-center justify-center text-xs font-semibold"
                            style={{
                                height: '36px',
                                width: '100%',
                                background: 'var(--accent-mint-bg)',
                                color: 'var(--accent-mint-text)',
                                borderRadius: 'var(--radius-button)',
                                border: '1px solid rgba(166, 244, 179, 0.3)'
                            }}
                        >
                            Added
                        </div>
                    )}

                    {/* Quick Actions Row - Fixed 4 icons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <TooltipButton
                            icon={Maximize2}
                            onClick={onInspect}
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
    // Vibrant colors with strong visibility
    const colorStyles: Record<string, {
        bg: string;
        border: string;
        color: string;
        hoverBg: string;
        hoverBorder: string;
    }> = {
        gray: {
            bg: 'var(--bg-card)',
            border: 'var(--border-default)',
            color: 'var(--text-secondary)',
            hoverBg: 'var(--bg-card-muted)',
            hoverBorder: 'var(--border-strong)'
        },
        blue: {
            bg: 'var(--lilac-soft)',
            border: 'var(--chip-lilac-border)',
            color: 'var(--lilac-text)',
            hoverBg: 'var(--lilac)',
            hoverBorder: 'var(--lilac)'
        },
        purple: {
            bg: 'var(--lilac-soft)',
            border: 'var(--chip-lilac-border)',
            color: 'var(--lilac-text)',
            hoverBg: 'var(--lilac)',
            hoverBorder: 'var(--lilac)'
        },
        teal: {
            bg: 'var(--mint-soft)',
            border: 'var(--chip-mint-border)',
            color: 'var(--mint-text)',
            hoverBg: 'var(--mint)',
            hoverBorder: 'var(--mint)'
        },
        rose: {
            bg: 'var(--danger-soft)',
            border: 'var(--chip-danger-border)',
            color: 'var(--danger-text)',
            hoverBg: '#fecaca',
            hoverBorder: '#f87171'
        }
    };

    const style = colorStyles[baseColor] || colorStyles.gray;

    return (
        <button
            onClick={onClick}
            className="transition-all duration-150 ease-out"
            style={{
                background: style.bg,
                border: `1px solid ${style.border}`,
                color: style.color,
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-sm)',
                padding: '10px',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
            }}
            title={label}
            onMouseEnter={(e) => {
                e.currentTarget.style.background = style.hoverBg;
                e.currentTarget.style.borderColor = style.hoverBorder;
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.background = style.bg;
                e.currentTarget.style.borderColor = style.border;
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
            }}
            onMouseDown={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'var(--shadow-xs)';
            }}
            onMouseUp={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
            }}
            onFocus={(e) => {
                e.currentTarget.style.boxShadow = 'var(--shadow-focus)';
            }}
            onBlur={(e) => {
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
            }}
        >
            <Icon size={17} />
        </button>
    );
}
