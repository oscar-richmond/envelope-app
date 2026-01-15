import Link from 'next/link';
import { useState } from 'react';
import { PenTool, MessageSquare, Trash2, RefreshCw } from 'lucide-react';
import { CompanyNameLink } from '@/components/company/CompanyNameLink';
import MetricTile from '@/components/prospects/MetricTile';

// Format relative time for last scanned
function formatRelativeTime(dateStr: string | Date): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
}

// Unified Health Card CTA Component
const healthCtaStyles = {
    web: {
        bg: 'rgba(84, 130, 237, 0.12)',
        bgHover: 'rgba(84, 130, 237, 0.18)',
        bgActive: 'rgba(84, 130, 237, 0.25)',
        border: 'rgba(84, 130, 237, 0.35)',
        color: 'rgb(84, 130, 237)',
        cardBg: 'rgba(84, 130, 237, 0.06)',
        cardBorder: 'rgba(84, 130, 237, 0.15)'
    },
    finance: {
        bg: 'rgba(45, 212, 191, 0.12)',
        bgHover: 'rgba(45, 212, 191, 0.18)',
        bgActive: 'rgba(45, 212, 191, 0.25)',
        border: 'rgba(45, 212, 191, 0.35)',
        color: 'rgb(20, 184, 166)',
        cardBg: 'rgba(45, 212, 191, 0.06)',
        cardBorder: 'rgba(45, 212, 191, 0.15)'
    }
};

function HealthCardCTA({
    variant,
    label,
    loadingLabel,
    isLoading,
    onClick,
    size = 'small'
}: {
    variant: 'web' | 'finance';
    label: string;
    loadingLabel?: string;
    isLoading?: boolean;
    onClick: (e: React.MouseEvent) => void;
    size?: 'small' | 'full';
}) {
    const style = healthCtaStyles[variant];

    return (
        <button
            onClick={(e) => {
                e.stopPropagation();
                onClick(e);
            }}
            disabled={isLoading}
            className={`font-medium rounded-lg transition-all hover:scale-[1.02] active:scale-[0.98] ${size === 'full' ? 'w-full text-xs px-3 py-1.5' : 'text-[10px] px-2 py-0.5'
                }`}
            style={{
                background: style.bg,
                border: `1px solid ${style.border}`,
                color: style.color,
                cursor: isLoading ? 'wait' : 'pointer',
                opacity: isLoading ? 0.7 : 1
            }}
        >
            {isLoading ? (loadingLabel || '...') : label}
        </button>
    );
}

interface LeadResultRowCardProps {
    lead: any;
    index: number;
    onCompose: () => void;
    onViewThread: () => void;
    onDelete: () => void;
    onRescan?: (type: 'website' | 'financial' | 'both') => Promise<void>;
}

export default function LeadResultRowCard({
    lead,
    index,
    onCompose,
    onViewThread,
    onDelete,
    onRescan
}: LeadResultRowCardProps) {

    const [scanningWeb, setScanningWeb] = useState(false);
    const [scanningFin, setScanningFin] = useState(false);

    // Handle per-company website scan
    const handleWebScan = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (scanningWeb || !onRescan) return;
        setScanningWeb(true);
        try {
            await onRescan('website');
        } finally {
            setScanningWeb(false);
        }
    };

    // Handle per-company financial scan
    const handleFinScan = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (scanningFin || !onRescan) return;
        setScanningFin(true);
        try {
            await onRescan('financial');
        } finally {
            setScanningFin(false);
        }
    };


    // Status Logic
    const status = lead.emailStatus || 'NEW';
    const hasThread = status === 'SENT' || status === 'REPLIED' || lead.sentEmails?.length > 0;

    // Metrics - handle null properly (use signals contract when available)
    const signals = lead.signals;

    // Financial Health
    const finScore = signals?.finHealth?.score ?? lead.financialScore;
    const finBand = signals?.finHealth?.label ?? lead.financialBand;
    const hasFinData = finScore !== null && finScore !== undefined;

    // Web Health (staleness)
    const staleScore = signals?.webHealth?.score ?? lead.stalenessScore;
    const staleLabel = signals?.webHealth?.label ?? lead.stalenessLabel;
    const hasWebData = staleScore !== null && staleScore !== undefined;

    // Lead Opportunity (priority)
    const priority = signals?.leadOpp?.score ?? lead.priorityScore;
    const priorityBand = signals?.leadOpp?.label ?? lead.priorityBand;
    const hasPriorityData = priority !== null && priority !== undefined;

    // Status color mapping
    const statusStyles: Record<string, { bg: string; color: string; border: string }> = {
        DRAFTED: { bg: 'var(--warning-light)', color: 'var(--warning-text)', border: 'rgba(245, 158, 11, 0.3)' },
        SENT: { bg: 'var(--accent-blue-light)', color: 'var(--accent-blue-text)', border: 'rgba(99, 102, 241, 0.3)' },
        REPLIED: { bg: 'var(--accent-lilac-bg)', color: 'var(--accent-lilac-text)', border: 'rgba(184, 166, 255, 0.3)' },
        NEW: { bg: 'var(--bg-card-muted)', color: 'var(--text-secondary)', border: 'var(--border-soft)' }
    };

    const currentStatusStyle = statusStyles[status] || statusStyles.NEW;

    // Stop propagation helper
    const handleClick = (e: React.MouseEvent, handler: () => void) => {
        e.stopPropagation();
        e.preventDefault();
        handler();
    };

    return (
        <div
            className="group relative transition-all duration-200"
            style={{
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius-card)',
                border: '1px solid var(--border-soft)',
                boxShadow: 'var(--shadow-card)',
                padding: '20px 24px'
            }}
        >
            <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr_260px] gap-6 items-center h-full">

                {/* 1. Company Identity */}
                <div className="flex flex-col gap-2 pr-6 min-w-0 max-w-[380px] py-1">
                    <CompanyNameLink
                        prospectId={lead.companyProspectId}
                        leadId={lead.id}
                        name={lead.companyName}
                        className="font-bold text-lg transition truncate leading-snug block w-full cursor-pointer"
                        style={{
                            fontFamily: 'var(--font-display)',
                            color: 'var(--text-primary)',
                            letterSpacing: '-0.01em'
                        }}
                    />

                    {/* Meta Line */}
                    <div
                        className="flex items-center gap-2 text-sm whitespace-nowrap overflow-hidden text-ellipsis"
                        style={{ color: 'var(--text-secondary)' }}
                    >
                        {lead.location ? (
                            <span className="truncate max-w-[100px]">{lead.location}</span>
                        ) : 'Unknown'}
                        <span style={{ color: 'var(--border-default)' }}>•</span>
                        <span className="truncate max-w-[100px]">{lead.industry || 'Unknown'}</span>
                    </div>

                    {/* Status Chips */}
                    <div className="mt-1.5 flex flex-wrap gap-2 items-center">
                        <span
                            className="px-2.5 py-0.5 rounded-[var(--radius-badge)] text-xs font-semibold"
                            style={{
                                background: currentStatusStyle.bg,
                                color: currentStatusStyle.color,
                                border: `1px solid ${currentStatusStyle.border}`
                            }}
                        >
                            {status}
                        </span>
                        {lead.lastActivityAt && (
                            <span
                                className="text-xs flex items-center"
                                style={{ color: 'var(--text-muted)' }}
                            >
                                {new Date(lead.lastActivityAt).toLocaleDateString()}
                            </span>
                        )}
                    </div>
                </div>

                {/* 2. Signals Strip */}
                <div
                    className="grid grid-cols-3 gap-5 px-6 h-full items-center py-1"
                    style={{ borderLeft: '1px solid var(--border-soft)' }}
                >
                    {/* Lead Opp */}
                    <div className="flex flex-col gap-1">
                        {hasPriorityData ? (
                            <MetricTile
                                label="Lead Opp"
                                value={priorityBand}
                                score={priority}
                                scoreColor={priorityBand === 'High' ? 'lilac' : 'gray'}
                            />
                        ) : (
                            <div className="flex flex-col gap-1 p-3 rounded-lg" style={{ background: 'var(--bg-card-muted)' }}>
                                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Lead Opp</span>
                                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Pending</span>
                                <div className="flex gap-1 mt-1">
                                    {!hasWebData && (
                                        <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'rgb(217, 119, 6)' }}>Web</span>
                                    )}
                                    {!hasFinData && (
                                        <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'rgb(217, 119, 6)' }}>Fin</span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Web Health */}
                    <div className="flex flex-col gap-1">
                        {hasWebData ? (
                            <MetricTile
                                label="Web Health"
                                value={staleLabel}
                                score={staleScore}
                                scoreColor={(staleScore ?? 0) >= 60 ? 'red' : 'green'}
                            />
                        ) : (
                            <div className="flex flex-col gap-2 p-3 rounded-lg h-full justify-center" style={{ background: healthCtaStyles.web.cardBg, border: `1px solid ${healthCtaStyles.web.cardBorder}` }}>
                                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Web Health</span>
                                <HealthCardCTA
                                    variant="web"
                                    label="Scan Website"
                                    loadingLabel="Scanning..."
                                    isLoading={scanningWeb}
                                    onClick={handleWebScan}
                                    size="full"
                                />
                            </div>
                        )}
                    </div>

                    {/* Fin Health */}
                    <div className="flex flex-col gap-1">
                        {hasFinData ? (
                            <MetricTile
                                label="Fin Health"
                                value={finBand}
                                score={finScore}
                                scoreColor={finBand === 'Strong' ? 'mint' : 'amber'}
                            />
                        ) : (
                            <div className="flex flex-col gap-2 p-3 rounded-lg h-full justify-center" style={{ background: healthCtaStyles.finance.cardBg, border: `1px solid ${healthCtaStyles.finance.cardBorder}` }}>
                                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Fin Health</span>
                                <HealthCardCTA
                                    variant="finance"
                                    label="Scan Financials"
                                    loadingLabel="Scanning..."
                                    isLoading={scanningFin}
                                    onClick={handleFinScan}
                                    size="full"
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. Actions Panel - All CTAs as direct children */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'var(--bg-card-muted)',
                        borderRadius: 'var(--radius-xl)',
                        border: '1px solid var(--border-soft)',
                        padding: '8px 12px',
                        overflow: 'hidden',
                        width: 'fit-content',
                        maxWidth: '100%',
                        flexShrink: 0
                    }}
                >
                    {/* Open CTA - Dark style for anchor action */}
                    <Link
                        href={`/leads/${lead.id}`}
                        className="btn btn-dark"
                        style={{
                            fontSize: '13px',
                            fontWeight: 600,
                            padding: '0 16px',
                            height: '36px',
                            borderRadius: 'var(--radius-button)',
                            flex: '0 0 auto',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        Open
                    </Link>

                    {/* Msg CTA */}
                    <button
                        onClick={(e) => handleClick(e, onCompose)}
                        className="btn"
                        style={{
                            fontSize: '13px',
                            fontWeight: 600,
                            padding: '0 14px',
                            height: '36px',
                            borderRadius: 'var(--radius-button)',
                            background: 'var(--lilac-soft)',
                            color: 'var(--lilac-text)',
                            border: '1px solid var(--chip-lilac-border)',
                            flex: '0 0 auto',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                        }}
                        title="Compose outreach"
                    >
                        <PenTool size={14} /> Msg
                    </button>

                    {/* Divider */}
                    <div
                        style={{
                            width: '1px',
                            height: '24px',
                            background: 'var(--border-default)',
                            flex: '0 0 auto'
                        }}
                    />

                    {/* Thread Icon */}
                    <button
                        onClick={(e) => handleClick(e, onViewThread)}
                        className={`icon-btn ${hasThread ? 'icon-btn-lilac' : ''}`}
                        style={{ flex: '0 0 auto', width: '36px', height: '36px' }}
                        title={hasThread ? "View thread" : "No thread yet"}
                    >
                        <MessageSquare size={15} />
                    </button>

                    {/* Delete Icon */}
                    <button
                        onClick={(e) => handleClick(e, onDelete)}
                        className="icon-btn icon-btn-danger"
                        style={{ flex: '0 0 auto', width: '36px', height: '36px' }}
                        title="Remove lead"
                    >
                        <Trash2 size={15} />
                    </button>
                </div>

            </div>
        </div>
    );
}
