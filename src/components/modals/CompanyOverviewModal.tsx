'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    X, ExternalLink, Maximize2, Copy,
    Monitor, TrendingUp, Target,
    Mail, User, ArrowRight, RefreshCw,
    MessageSquare, Send, Plus
} from 'lucide-react';
import { useCompanyViewer } from '@/components/modals/CompanyViewerProvider';
import CompanyLogo from '@/components/ui/CompanyLogo';
import WebsitePreview from '@/components/company-hq/WebsitePreview';
import ContactsCard from '@/components/company-hq/ContactsCard';
import ThreadPreview from '@/components/company-hq/ThreadPreview';

// Modals
import WebsiteEvidenceModal from '@/components/modals/WebsiteEvidenceModal';
import FinancialReportModal from '@/components/modals/FinancialReportModal';

// --- Subcomponents for Modal Only ---

function ScoreCard({
    label,
    score,
    band,
    color,
    icon: Icon,
    onWhy
}: {
    label: string,
    score: number,
    band?: string,
    color: 'emerald' | 'amber' | 'rose' | 'indigo',
    icon: any,
    onWhy?: () => void
}) {
    const colorStyles = {
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        amber: 'bg-amber-50 text-amber-700 border-amber-100',
        rose: 'bg-rose-50 text-rose-700 border-rose-100',
        indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    };

    return (
        <div className="flex-1 bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className={`absolute top-0 left-0 w-1 h-full ${color === 'emerald' ? 'bg-emerald-500' : color === 'amber' ? 'bg-amber-500' : color === 'rose' ? 'bg-rose-500' : 'bg-indigo-500'}`} />

            <div className="flex justify-between items-start mb-2 pl-2">
                <div className="flex items-center gap-2">
                    <Icon size={16} className="text-gray-400" />
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</span>
                </div>
            </div>

            <div className="pl-2">
                <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-gray-900 tracking-tight">{score}</span>
                    <span className="text-xs text-gray-400 font-medium">/100</span>
                </div>
                {band && (
                    <div className={`mt-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${colorStyles[color]}`}>
                        {band}
                    </div>
                )}
            </div>

            {onWhy && (
                <button
                    onClick={onWhy}
                    className="absolute bottom-3 right-3 text-xs text-gray-400 hover:text-indigo-600 font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                    Why? <ArrowRight size={12} />
                </button>
            )}
        </div>
    );
}

function SignalPill({ label, type = 'neutral' }: { label: string, type?: 'danger' | 'warning' | 'neutral' }) {
    const styles = {
        danger: 'bg-rose-50 text-rose-700 border-rose-100',
        warning: 'bg-amber-50 text-amber-700 border-amber-100',
        neutral: 'bg-gray-50 text-gray-600 border-gray-200'
    };
    return (
        <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium border ${styles[type]} whitespace-nowrap`}>
            {label}
        </span>
    );
}

// --- Main Modal Component ---

interface CompanyOverviewModalProps {
    leadId: number;
    onClose: () => void;
}

export default function CompanyOverviewModal({ leadId, onClose }: CompanyOverviewModalProps) {
    const { togglePin } = useCompanyViewer();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);

    // Modal States
    const [isWebsiteModalOpen, setIsWebsiteModalOpen] = useState(false);
    const [isFinancialModalOpen, setIsFinancialModalOpen] = useState(false);

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            try {
                const res = await fetch(`/api/company/${leadId}/overview`);
                if (res.ok) {
                    setData(await res.json());
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [leadId]);

    // Close on ESC
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    if (!data && loading) return null; // Or skeleton
    if (!data) return null;

    // Derived Data
    const domain = data.websiteUrl ? new URL(data.websiteUrl).hostname : undefined;

    // Score Colors
    const getScoreColor = (score: number) => score >= 70 ? 'emerald' : score >= 40 ? 'amber' : 'rose';

    // Parse Signals for Chips
    let displaySignals: { label: string, type: 'danger' | 'warning' | 'neutral' }[] = [];
    if (data.websiteSignals && Array.isArray(data.websiteSignals)) {
        displaySignals = data.websiteSignals.slice(0, 6).map((s: string) => ({
            label: s,
            type: s.match(/copyright|inactive|error/i) ? 'danger' : 'neutral'
        }));
    }

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="absolute inset-0" onClick={onClose} />

                <div
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col relative z-10 overflow-hidden ring-1 ring-black/5"
                    role="dialog"
                    aria-modal="true"
                >
                    {/* --- Header --- */}
                    <div className="px-8 py-6 border-b border-gray-100 flex items-start justify-between bg-white shrink-0">
                        <div className="flex items-center gap-5">
                            <CompanyLogo
                                name={data.companyName}
                                domain={domain}
                                logoUrl={data.logoUrl} // Assuming backend might have logoUrl
                                size="lg"
                                className="shadow-md"
                            />
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                                    {data.companyName}
                                </h2>
                                <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                                    {domain && (
                                        <a href={data.websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-indigo-600 transition font-medium">
                                            {domain} <ExternalLink size={12} className="opacity-50" />
                                        </a>
                                    )}
                                    {data.industry && (
                                        <>
                                            <span className="text-gray-300">•</span>
                                            <span>{data.industry}</span>
                                        </>
                                    )}
                                    {data.location && (
                                        <>
                                            <span className="text-gray-300">•</span>
                                            <span>{data.location}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition" title="Copy Link">
                                <Copy size={20} />
                            </button>
                            <Link href={`/leads/${leadId}`} className="p-2 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-gray-100 transition" title="Open Full Page">
                                <Maximize2 size={20} />
                            </Link>
                            <button onClick={onClose} className="p-2 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-gray-100 transition" title="Close">
                                <X size={24} />
                            </button>
                        </div>
                    </div>

                    {/* --- Body --- */}
                    <div className="flex-1 overflow-y-auto bg-gray-50/50 p-8">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                            {/* Left Column (Primary) */}
                            <div className="lg:col-span-7 space-y-8">

                                {/* Score Cards */}
                                <div className="grid grid-cols-3 gap-4">
                                    <ScoreCard
                                        label="Lead Opportunity"
                                        score={data.kpis.opportunityScore}
                                        band={data.outreach.status.replace('_', ' ')} // Using status as 'band' equivalent for now
                                        color={getScoreColor(data.kpis.opportunityScore)}
                                        icon={Target}
                                    />
                                    <ScoreCard
                                        label="Financial Health"
                                        score={data.kpis.financialScore}
                                        band={data.kpis.financialBand}
                                        color={getScoreColor(data.kpis.financialScore)}
                                        icon={TrendingUp}
                                        onWhy={() => setIsFinancialModalOpen(true)}
                                    />
                                    <ScoreCard
                                        label="Website Health"
                                        score={data.kpis.websiteScore}
                                        band={data.kpis.websiteScore > 60 ? 'Healthy' : 'Needs Work'} // Mock band
                                        color={getScoreColor(data.kpis.websiteScore)}
                                        icon={Monitor}
                                        onWhy={() => setIsWebsiteModalOpen(true)}
                                    />
                                </div>

                                {/* Website Preview & Signals */}
                                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                                    <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                        <h3 className="font-semibold text-gray-900">Website Intelligence</h3>
                                        <button
                                            onClick={() => setIsWebsiteModalOpen(true)}
                                            className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                                        >
                                            View breakdown
                                        </button>
                                    </div>
                                    <div className="p-5">
                                        <div className="mb-6 rounded-lg overflow-hidden border border-gray-100 shadow-sm">
                                            <WebsitePreview url={data.websiteUrl} />
                                        </div>

                                        <div>
                                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Detected Signals</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {displaySignals.length > 0 ? displaySignals.map((s, i) => (
                                                    <SignalPill key={i} label={s.label} type={s.type} />
                                                )) : (
                                                    <span className="text-sm text-gray-400 italic">No significant signals detected.</span>
                                                )}
                                                {data.websiteSignals?.length > 6 && (
                                                    <span className="text-xs text-gray-400 self-center pl-1">+{data.websiteSignals.length - 6} more</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                            </div>

                            {/* Right Column (Secondary) */}
                            <div className="lg:col-span-5 space-y-8">

                                {/* Contacts */}
                                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                                    <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                        <h3 className="font-semibold text-gray-900">Key Contacts</h3>
                                        <button className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                                            <RefreshCw size={12} /> Find More
                                        </button>
                                    </div>
                                    <div className="flex-1 max-h-[400px] overflow-y-auto">
                                        <ContactsCard leadId={leadId} contacts={data.contacts || []} />
                                    </div>
                                </div>

                                {/* Thread / Activity */}
                                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                                    <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                        <h3 className="font-semibold text-gray-900">Recent Activity</h3>
                                        <button className="text-xs font-medium text-indigo-600 hover:text-indigo-700">View Thread</button>
                                    </div>
                                    <div className="p-0">
                                        <ThreadPreview sentEmails={data.sentEmails || []} />
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>

                    {/* --- Footer Actions --- */}
                    <div className="px-8 py-5 border-t border-gray-100 bg-white flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-2">
                            <button className="p-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition" title="Refresh Data">
                                <RefreshCw size={18} />
                            </button>
                            <div className="h-6 w-px bg-gray-200 mx-1"></div>
                            <span className="text-xs text-gray-400">
                                Last updated {new Date().toLocaleDateString()}
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <ButtonSecondary icon={MessageSquare} label="View Thread" />
                            <ButtonSecondary icon={Plus} label="Add Tag" />
                            <button className="btn btn-primary shadow-lg shadow-indigo-100 px-6 py-2.5 flex items-center gap-2">
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
            />

            <FinancialReportModal
                isOpen={isFinancialModalOpen}
                onClose={() => setIsFinancialModalOpen(false)}
                score={data.kpis.financialScore}
                band={data.kpis.financialBand}
                evidence={data.financialSignals}
                companyName={data.companyName}
            />
        </>
    );
}

function ButtonSecondary({ icon: Icon, label }: { icon: any, label: string }) {
    return (
        <button className="px-4 py-2 bg-white border border-gray-200 text-gray-700 font-medium text-sm rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors flex items-center gap-2">
            <Icon size={16} className="text-gray-400" />
            {label}
        </button>
    );
}
