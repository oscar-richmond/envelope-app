import Link from 'next/link';
import { PenTool, MessageSquare, Trash2 } from 'lucide-react';
import { CompanyNameLink } from '@/components/company/CompanyNameLink';
import MetricTile from '@/components/prospects/MetricTile';

interface LeadResultRowCardProps {
    lead: any;
    index: number;
    onCompose: () => void;
    onViewThread: () => void;
    onDelete: () => void;
}

export default function LeadResultRowCard({
    lead,
    index,
    onCompose,
    onViewThread,
    onDelete
}: LeadResultRowCardProps) {

    // Status Logic
    const status = lead.emailStatus || 'NEW';
    const hasThread = status === 'SENT' || status === 'REPLIED' || lead.sentEmails?.length > 0;

    // Metrics
    const finScore = lead.financialScore ?? 0;
    const finBand = finScore > 75 ? 'Strong' : finScore > 50 ? 'Medium' : 'Low';

    const staleScore = lead.stalenessScore ?? 0;
    const staleLabel = staleScore >= 60 ? 'Outdated' : staleScore >= 30 ? 'Aging' : 'Fresh';

    const priority = lead.priorityScore ?? 0;
    const priorityBand = priority > 70 ? 'High' : priority > 40 ? 'Medium' : 'Low';

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
                        onCompose={onCompose}
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
                    <MetricTile
                        label="Lead Opp"
                        value={priorityBand}
                        score={priority}
                        scoreColor={priorityBand === 'High' ? 'lilac' : 'gray'}
                    />
                    <MetricTile
                        label="Web Health"
                        value={staleLabel}
                        score={staleScore}
                        scoreColor={staleScore >= 60 ? 'red' : 'green'}
                    />
                    <MetricTile
                        label="Fin Health"
                        value={finBand}
                        score={finScore}
                        scoreColor={finBand === 'Strong' ? 'mint' : 'amber'}
                    />
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
