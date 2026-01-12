'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    X, ExternalLink, Maximize2, Copy,
    Monitor, TrendingUp, Target, Mail,
    RefreshCw, Send, Plus, ChevronRight,
    Users, MessageSquare
} from 'lucide-react';
import { useCompanyViewer } from '@/components/modals/CompanyViewerProvider';
import CompanyLogo from '@/components/ui/CompanyLogo';
import WebsitePreview from '@/components/company-hq/WebsitePreview';
import ContactsCard from '@/components/company-hq/ContactsCard';
import ThreadPreview from '@/components/company-hq/ThreadPreview';

import WebsiteEvidenceModal from '@/components/modals/WebsiteEvidenceModal';
import FinancialReportModal from '@/components/modals/FinancialReportModal';

// --- Score Card Component (V2 Style) ---
function ScoreCard({
    label,
    score,
    band,
    accent,
    icon: Icon,
    onWhy
}: {
    label: string;
    score: number;
    band?: string;
    accent: 'mint' | 'lilac' | 'blue' | 'default';
    icon: any;
    onWhy?: () => void;
}) {
    const accentStyles: Record<string, { border: string; iconBg: string; iconColor: string; badgeBg: string; badgeColor: string }> = {
        mint: {
            border: 'var(--accent-mint)',
            iconBg: 'var(--accent-mint-bg)',
            iconColor: 'var(--accent-mint-text)',
            badgeBg: 'var(--accent-mint-bg)',
            badgeColor: 'var(--accent-mint-text)'
        },
        lilac: {
            border: 'var(--accent-lilac)',
            iconBg: 'var(--accent-lilac-bg)',
            iconColor: 'var(--accent-lilac-text)',
            badgeBg: 'var(--accent-lilac-bg)',
            badgeColor: 'var(--accent-lilac-text)'
        },
        blue: {
            border: 'var(--accent-blue)',
            iconBg: 'var(--accent-blue-light)',
            iconColor: 'var(--accent-blue)',
            badgeBg: 'var(--accent-blue-light)',
            badgeColor: 'var(--accent-blue-text)'
        },
        default: {
            border: 'var(--border-default)',
            iconBg: 'var(--bg-card-muted)',
            iconColor: 'var(--text-secondary)',
            badgeBg: 'var(--bg-card-muted)',
            badgeColor: 'var(--text-secondary)'
        }
    };

    const style = accentStyles[accent];

    return (
        <div
            className="relative overflow-hidden transition-all duration-200 group cursor-pointer"
            style={{
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--border-soft)',
                borderLeft: `4px solid ${style.border}`,
                boxShadow: 'var(--shadow-card)',
                padding: '20px'
            }}
            onClick={onWhy}
        >
            {/* Header */}
            <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                    <div
                        className="w-8 h-8 rounded-[var(--radius-md)] flex items-center justify-center"
                        style={{ background: style.iconBg, color: style.iconColor }}
                    >
                        <Icon size={16} />
                    </div>
                    <span
                        className="text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: 'var(--text-muted)' }}
                    >
                        {label}
                    </span>
                </div>
            </div>

            {/* Score */}
            <div className="flex items-baseline gap-1.5">
                <span
                    className="text-4xl font-bold tracking-tight"
                    style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)', letterSpacing: '-0.03em' }}
                >
                    {score}
                </span>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>/100</span>
            </div>

            {/* Band */}
            {band && (
                <div
                    className="mt-3 inline-flex items-center px-2.5 py-1 rounded-[var(--radius-badge)] text-[10px] font-bold uppercase tracking-wide"
                    style={{ background: style.badgeBg, color: style.badgeColor }}
                >
                    {band}
                </div>
            )}

            {/* View CTA */}
            {onWhy && (
                <div
                    className="absolute bottom-4 right-4 text-xs font-semibold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: 'var(--accent-blue)' }}
                >
                    View <ChevronRight size={12} />
                </div>
            )}
        </div>
    );
}

// --- Tab Component ---
function TabButton({ label, active, onClick, icon: Icon }: { label: string; active: boolean; onClick: () => void; icon: any }) {
    return (
        <button
            onClick={onClick}
            className="flex items-center gap-2 px-5 py-3 text-sm font-semibold transition-all relative"
            style={{
                color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                borderBottom: active ? '2px solid var(--accent-blue)' : '2px solid transparent'
            }}
        >
            <Icon size={16} />
            {label}
        </button>
    );
}

// --- Signal Pill (V2) ---
function SignalPill({ label, type = 'neutral' }: { label: string; type?: 'danger' | 'warning' | 'neutral' }) {
    const styles: Record<string, { bg: string; color: string; border: string }> = {
        danger: { bg: 'var(--error-light)', color: 'var(--error-text)', border: 'rgba(255, 77, 77, 0.3)' },
        warning: { bg: 'var(--warning-light)', color: 'var(--warning-text)', border: 'rgba(245, 158, 11, 0.3)' },
        neutral: { bg: 'var(--bg-card-muted)', color: 'var(--text-secondary)', border: 'var(--border-soft)' }
    };
    const style = styles[type];

    return (
        <span
            className="px-2.5 py-1 rounded-[var(--radius-badge)] text-[11px] font-semibold whitespace-nowrap"
            style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}
        >
            {label}
        </span>
    );
}

// --- Main Modal ---
interface CompanyOverviewModalProps {
    leadId?: number;
    prospectId?: number;
    onClose: () => void;
}

export default function CompanyOverviewModal({ leadId, prospectId, onClose }: CompanyOverviewModalProps) {
    const { togglePin } = useCompanyViewer();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'contacts' | 'thread'>('overview');
    const [resolvedLeadId, setResolvedLeadId] = useState<number | null>(leadId || null);

    const [isWebsiteModalOpen, setIsWebsiteModalOpen] = useState(false);
    const [isFinancialModalOpen, setIsFinancialModalOpen] = useState(false);

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            try {
                let res;
                if (leadId) {
                    // Fetch lead data
                    res = await fetch(`/api/company/${leadId}/overview`);
                } else if (prospectId) {
                    // Fetch prospect data
                    res = await fetch(`/api/prospects/${prospectId}/overview`);
                } else {
                    setLoading(false);
                    return;
                }

                if (res.ok) {
                    const json = await res.json();

                    // Handle redirect if prospect already has a lead
                    if (json.redirectToLead) {
                        setResolvedLeadId(json.redirectToLead);
                        const leadRes = await fetch(`/api/company/${json.redirectToLead}/overview`);
                        if (leadRes.ok) setData(await leadRes.json());
                    } else {
                        setData(json);
                        if (json.leadId) setResolvedLeadId(json.leadId);
                    }
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [leadId, prospectId]);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    if (!data && loading) return null;
    if (!data) return null;

    // Check if this is a prospect (not yet a lead)
    const isProspect = data.isProspect === true;
    const domain = data.websiteUrl ? (() => { try { return new URL(data.websiteUrl).hostname; } catch { return undefined; } })() : undefined;

    // Score band helpers
    const getScoreAccent = (score: number): 'mint' | 'lilac' | 'default' =>
        score >= 70 ? 'mint' : score >= 40 ? 'lilac' : 'default';

    // Signals
    let displaySignals: { label: string; type: 'danger' | 'warning' | 'neutral' }[] = [];
    if (data.websiteSignals && Array.isArray(data.websiteSignals)) {
        displaySignals = data.websiteSignals.slice(0, 6).map((s: string) => ({
            label: s,
            type: s.match(/copyright|inactive|error/i) ? 'danger' : 'neutral'
        }));
    }

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
                style={{ background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(4px)' }}>
                <div className="absolute inset-0" onClick={onClose} />

                <div
                    className="relative z-10 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"
                    style={{
                        background: 'var(--bg-card)',
                        borderRadius: 'var(--radius-2xl)',
                        boxShadow: 'var(--shadow-float)',
                        border: '1px solid var(--border-soft)'
                    }}
                    role="dialog"
                    aria-modal="true"
                >
                    {/* Header */}
                    <div
                        className="px-8 py-6 flex items-start justify-between shrink-0"
                        style={{ borderBottom: '1px solid var(--border-soft)' }}
                    >
                        <div className="flex items-center gap-5">
                            <CompanyLogo
                                name={data.companyName}
                                domain={domain}
                                logoUrl={data.logoUrl}
                                size="lg"
                                className="shadow-lg"
                            />
                            <div>
                                <h2
                                    className="text-2xl font-bold flex items-center gap-3"
                                    style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
                                >
                                    {data.companyName}
                                </h2>
                                <div
                                    className="flex items-center gap-3 text-sm mt-1.5"
                                    style={{ color: 'var(--text-secondary)' }}
                                >
                                    {domain && (
                                        <a
                                            href={data.websiteUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 font-medium transition-colors"
                                            style={{ color: 'var(--accent-blue)' }}
                                        >
                                            {domain} <ExternalLink size={12} style={{ opacity: 0.7 }} />
                                        </a>
                                    )}
                                    {data.industry && (
                                        <>
                                            <span style={{ color: 'var(--border-default)' }}>•</span>
                                            <span>{data.industry}</span>
                                        </>
                                    )}
                                    {data.location && (
                                        <>
                                            <span style={{ color: 'var(--border-default)' }}>•</span>
                                            <span>{data.location}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                className="p-2.5 transition-all rounded-[var(--radius-md)]"
                                style={{ color: 'var(--text-muted)', background: 'transparent' }}
                                title="Copy Link"
                            >
                                <Copy size={18} />
                            </button>
                            <Link
                                href={data.companyProspectId ? `/company/${data.companyProspectId}` : `/company/${prospectId || leadId}`}
                                className="p-2.5 transition-all rounded-[var(--radius-md)]"
                                style={{ color: 'var(--text-muted)', background: 'transparent' }}
                                title="Open Full Workspace"
                            >
                                <Maximize2 size={18} />
                            </Link>
                            <button
                                onClick={onClose}
                                className="p-2.5 transition-all rounded-[var(--radius-md)]"
                                style={{ color: 'var(--text-muted)', background: 'transparent' }}
                                title="Close"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Score Cards Row */}
                    <div className="px-8 py-6 shrink-0" style={{ borderBottom: '1px solid var(--border-soft)' }}>
                        <div className="grid grid-cols-4 gap-5">
                            <ScoreCard
                                label="Lead Opportunity"
                                score={data.kpis.opportunityScore}
                                band={data.kpis.opportunityScore >= 70 ? 'High' : data.kpis.opportunityScore >= 40 ? 'Medium' : 'Low'}
                                accent="lilac"
                                icon={Target}
                            />
                            <ScoreCard
                                label="Website Health"
                                score={data.kpis.websiteScore}
                                band={data.kpis.websiteScore >= 60 ? 'Healthy' : 'Needs Work'}
                                accent={getScoreAccent(data.kpis.websiteScore)}
                                icon={Monitor}
                                onWhy={() => setIsWebsiteModalOpen(true)}
                            />
                            <ScoreCard
                                label="Financial Health"
                                score={data.kpis.financialScore}
                                band={data.kpis.financialBand}
                                accent={getScoreAccent(data.kpis.financialScore)}
                                icon={TrendingUp}
                                onWhy={() => setIsFinancialModalOpen(true)}
                            />
                            <ScoreCard
                                label="Outreach Status"
                                score={data.outreach?.emailsSent || 0}
                                band={data.outreach?.status?.replace('_', ' ') || 'Not Started'}
                                accent="blue"
                                icon={Mail}
                            />
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="px-8 shrink-0" style={{ borderBottom: '1px solid var(--border-soft)' }}>
                        <div className="flex gap-0">
                            <TabButton
                                label="Overview"
                                active={activeTab === 'overview'}
                                onClick={() => setActiveTab('overview')}
                                icon={Monitor}
                            />
                            <TabButton
                                label="Contacts"
                                active={activeTab === 'contacts'}
                                onClick={() => setActiveTab('contacts')}
                                icon={Users}
                            />
                            <TabButton
                                label="Thread"
                                active={activeTab === 'thread'}
                                onClick={() => setActiveTab('thread')}
                                icon={MessageSquare}
                            />
                        </div>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto p-8" style={{ background: 'var(--bg-page)' }}>

                        {activeTab === 'overview' && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Website Intelligence Card */}
                                <div
                                    style={{
                                        background: 'var(--bg-card)',
                                        borderRadius: 'var(--radius-xl)',
                                        border: '1px solid var(--border-soft)',
                                        boxShadow: 'var(--shadow-card)',
                                        overflow: 'hidden'
                                    }}
                                >
                                    <div
                                        className="px-6 py-4 flex justify-between items-center"
                                        style={{ background: 'var(--bg-card-muted)', borderBottom: '1px solid var(--border-soft)' }}
                                    >
                                        <h3
                                            className="font-semibold"
                                            style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
                                        >
                                            Website Intelligence
                                        </h3>
                                        <button
                                            onClick={() => setIsWebsiteModalOpen(true)}
                                            className="text-xs font-semibold flex items-center gap-1 transition-colors"
                                            style={{ color: 'var(--accent-blue)' }}
                                        >
                                            View Evidence <ChevronRight size={14} />
                                        </button>
                                    </div>
                                    <div className="p-6">
                                        {/* Screenshot Preview */}
                                        <div
                                            className="mb-5 overflow-hidden"
                                            style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-soft)' }}
                                        >
                                            <WebsitePreview url={data.websiteUrl} />
                                        </div>

                                        {/* Signals */}
                                        <div>
                                            <h4
                                                className="text-[10px] font-bold uppercase tracking-wider mb-3"
                                                style={{ color: 'var(--text-muted)' }}
                                            >
                                                Detected Signals
                                            </h4>
                                            <div className="flex flex-wrap gap-2">
                                                {displaySignals.length > 0 ? displaySignals.map((s, i) => (
                                                    <SignalPill key={i} label={s.label} type={s.type} />
                                                )) : (
                                                    <span className="text-sm italic" style={{ color: 'var(--text-muted)' }}>
                                                        No significant signals detected.
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Financial Health Card */}
                                <div
                                    style={{
                                        background: 'var(--bg-card)',
                                        borderRadius: 'var(--radius-xl)',
                                        border: '1px solid var(--border-soft)',
                                        boxShadow: 'var(--shadow-card)',
                                        overflow: 'hidden'
                                    }}
                                >
                                    <div
                                        className="px-6 py-4 flex justify-between items-center"
                                        style={{ background: 'var(--accent-mint-bg)', borderBottom: '1px solid rgba(166, 244, 179, 0.3)' }}
                                    >
                                        <h3
                                            className="font-semibold"
                                            style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-mint-text)' }}
                                        >
                                            Financial Health
                                        </h3>
                                        <button
                                            onClick={() => setIsFinancialModalOpen(true)}
                                            className="text-xs font-semibold flex items-center gap-1 transition-colors"
                                            style={{ color: 'var(--accent-mint-text)' }}
                                        >
                                            Full Report <ChevronRight size={14} />
                                        </button>
                                    </div>
                                    <div className="p-6">
                                        <div className="flex items-center gap-6 mb-5">
                                            <div>
                                                <span
                                                    className="text-5xl font-bold tracking-tight"
                                                    style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)', letterSpacing: '-0.03em' }}
                                                >
                                                    {data.kpis.financialScore}
                                                </span>
                                                <span className="text-lg ml-1" style={{ color: 'var(--text-muted)' }}>/100</span>
                                            </div>
                                            <div
                                                className="px-4 py-2 rounded-[var(--radius-button)] font-bold text-sm"
                                                style={{ background: 'var(--accent-mint-bg)', color: 'var(--accent-mint-text)' }}
                                            >
                                                {data.kpis.financialBand}
                                            </div>
                                        </div>
                                        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                            Based on Companies House filings and financial indicators. Click "Full Report" for complete breakdown.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'contacts' && (
                            <div
                                style={{
                                    background: 'var(--bg-card)',
                                    borderRadius: 'var(--radius-xl)',
                                    border: '1px solid var(--border-soft)',
                                    boxShadow: 'var(--shadow-card)',
                                    overflow: 'hidden'
                                }}
                            >
                                <div
                                    className="px-6 py-4 flex justify-between items-center"
                                    style={{ background: 'var(--accent-lilac-bg)', borderBottom: '1px solid rgba(184, 166, 255, 0.3)' }}
                                >
                                    <h3
                                        className="font-semibold"
                                        style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-lilac-text)' }}
                                    >
                                        Key Contacts
                                    </h3>
                                    <button
                                        className="text-xs font-semibold flex items-center gap-1 transition-colors"
                                        style={{ color: 'var(--accent-lilac-text)' }}
                                    >
                                        <RefreshCw size={12} /> Find More
                                    </button>
                                </div>
                                <div className="max-h-[400px] overflow-y-auto">
                                    <ContactsCard leadId={leadId} contacts={data.contacts || []} />
                                </div>
                            </div>
                        )}

                        {activeTab === 'thread' && (
                            <div
                                style={{
                                    background: 'var(--bg-card)',
                                    borderRadius: 'var(--radius-xl)',
                                    border: '1px solid var(--border-soft)',
                                    boxShadow: 'var(--shadow-card)',
                                    overflow: 'hidden'
                                }}
                            >
                                <div
                                    className="px-6 py-4 flex justify-between items-center"
                                    style={{ background: 'var(--bg-card-muted)', borderBottom: '1px solid var(--border-soft)' }}
                                >
                                    <h3
                                        className="font-semibold"
                                        style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
                                    >
                                        Email Thread
                                    </h3>
                                </div>
                                <ThreadPreview sentEmails={data.sentEmails || []} />
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div
                        className="px-8 py-5 flex justify-between items-center shrink-0"
                        style={{ borderTop: '1px solid var(--border-soft)', background: 'var(--bg-card)' }}
                    >
                        <div className="flex items-center gap-3">
                            <button
                                className="p-2.5 transition-all rounded-[var(--radius-md)]"
                                style={{ color: 'var(--text-muted)' }}
                                title="Refresh Data"
                            >
                                <RefreshCw size={18} />
                            </button>
                            <div style={{ width: '1px', height: '20px', background: 'var(--border-default)' }} />
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                Last updated {new Date().toLocaleDateString()}
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                className="px-4 py-2.5 text-sm font-semibold flex items-center gap-2 transition-all"
                                style={{
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border-default)',
                                    borderRadius: 'var(--radius-button)',
                                    color: 'var(--text-primary)'
                                }}
                            >
                                <Plus size={16} /> Add Tag
                            </button>
                            <button
                                className="px-5 py-2.5 text-sm font-semibold flex items-center gap-2 transition-all"
                                style={{
                                    background: 'var(--text-primary)',
                                    color: 'white',
                                    borderRadius: 'var(--radius-button)',
                                    boxShadow: 'var(--shadow-card)'
                                }}
                            >
                                <Send size={16} /> Compose Outreach
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sub-Modals */}
            <WebsiteEvidenceModal
                isOpen={isWebsiteModalOpen}
                onClose={() => setIsWebsiteModalOpen(false)}
                evidence={Array.isArray(data.websiteSignals) ? data.websiteSignals : []}
                url={data.websiteUrl}
                lastChecked={data.companyProspect?.websiteDiscoveryDate}
            />

            <FinancialReportModal
                isOpen={isFinancialModalOpen}
                onClose={() => setIsFinancialModalOpen(false)}
                score={data.kpis.financialScore}
                band={data.kpis.financialBand}
                evidence={data.financialSignals}
                companyName={data.companyName}
                lastChecked={data.companyProspect?.financialLastCheckedAt}
            />
        </>
    );
}
