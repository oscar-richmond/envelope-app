'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft, Building2, Globe, MapPin, Phone, Star, Users,
    RefreshCw, ExternalLink, Mail, Send, TrendingUp, Activity,
    Clock, AlertCircle, CheckCircle, ChevronRight, FileText,
    DollarSign, BarChart3, Eye, MessageSquare, Calendar
} from 'lucide-react';

interface CompanyProfile {
    company: {
        id: number;
        name: string;
        legalName: string;
        companyNumber: string;
        industry: string | null;
        employeeSize: string | null;
        location: string | null;
        website: string | null;
        websiteDomain: string | null;
        status: string;
    };
    financial: {
        score: number | null;
        band: string | null;
        signals: any;
        lastCheckedAt: string | null;
    };
    staleness: {
        score: number | null;
        confidence: string | null;
        signals: any;
        reasons: any;
        lastAnalysedAt: string | null;
    };
    priority: {
        score: number | null;
        band: string | null;
    };
    places: {
        displayName: string;
        category: string;
        address: string;
        phone: string;
        mapsUrl: string;
        rating: number;
        reviewCount: number;
    } | null;
    website: {
        url: string | null;
        confidence: string;
        matchEvidence: any;
        meta: { title: string; description: string; fetchedAt: string | null };
    };
    ai: {
        oneLiner: string;
        overview: string;
        reputation: string;
        generatedAt: string;
    } | null;
    contacts: Array<{
        id: number;
        name: string;
        email: string;
        role: string | null;
        status: string;
    }>;
    outreachTimeline: Array<{
        id: number;
        subject: string;
        status: string;
        sentAt: string;
        replyDetectedAt: string | null;
        replyIntent: string | null;
        contactName: string;
        contactEmail: string;
    }>;
    discoveredEmails: Array<{ email: string; confidence: string }>;
}

export default function CompanyWorkspacePage() {
    const params = useParams();
    const router = useRouter();
    const companyId = params.id as string;

    const [profile, setProfile] = useState<CompanyProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
    const [screenshotLoading, setScreenshotLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'financial' | 'contacts'>('overview');

    useEffect(() => {
        fetchProfile();
    }, [companyId]);

    async function fetchProfile() {
        setLoading(true);
        try {
            const res = await fetch(`/api/company/${companyId}`);
            if (res.ok) {
                const data = await res.json();
                setProfile(data);
                // Auto-fetch screenshot if website exists
                if (data.company.website) {
                    fetchScreenshot(data.company.website);
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    async function fetchScreenshot(url: string, refresh = false) {
        setScreenshotLoading(true);
        try {
            const res = await fetch(`/api/company/${companyId}/screenshot?url=${encodeURIComponent(url)}&refresh=${refresh}`);
            const data = await res.json();
            if (data.success) {
                setScreenshotUrl(data.screenshotUrl);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setScreenshotLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-gray-400 animate-pulse">Loading company...</div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
                <AlertCircle size={48} className="text-gray-300 mb-4" />
                <h2 className="text-lg font-semibold text-gray-700">Company not found</h2>
                <Link href="/prospects" className="mt-4 text-indigo-600 hover:underline">
                    ← Back to Prospects
                </Link>
            </div>
        );
    }

    const { company, financial, staleness, priority, places, website, ai, contacts, outreachTimeline, discoveredEmails } = profile;

    return (
        <div className="min-h-screen" style={{ background: 'var(--bg-page)' }}>
            {/* Header - Hero Surface */}
            <header className="hero-surface hero-surface-brand px-6 py-6 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="icon-btn icon-btn-ghost"
                            aria-label="Go back"
                        >
                            <ArrowLeft size={20} strokeWidth={1.75} />
                        </button>
                        <div className="flex items-center gap-3">
                            <div
                                className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                                style={{
                                    background: 'linear-gradient(135deg, var(--brand) 0%, var(--lilac) 100%)',
                                    boxShadow: '0 4px 12px var(--brand-glow)'
                                }}
                            >
                                {company.name.charAt(0)}
                            </div>
                            <div>
                                <h1
                                    className="text-xl font-bold"
                                    style={{
                                        fontFamily: 'var(--font-display)',
                                        color: 'var(--text-primary)',
                                        letterSpacing: '-0.02em'
                                    }}
                                >
                                    {company.name}
                                </h1>
                                <p className="text-sm flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                                    {company.industry && <span>{company.industry}</span>}
                                    {company.location && <span>• {company.location}</span>}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {company.website && (
                            <a
                                href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-secondary btn-sm"
                            >
                                <Globe size={16} strokeWidth={1.75} />
                                Website
                                <ExternalLink size={12} />
                            </a>
                        )}
                        <Link href={`/outreach?companyId=${company.id}`} className="btn btn-primary btn-sm">
                            <Send size={16} strokeWidth={1.75} />
                            Compose Email
                        </Link>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-6">
                {/* Top Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                    {/* Website Screenshot */}
                    <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 overflow-hidden">
                        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                <Eye size={16} className="text-gray-400" />
                                Website Preview
                            </h3>
                            <button
                                onClick={() => company.website && fetchScreenshot(company.website, true)}
                                disabled={screenshotLoading}
                                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                            >
                                <RefreshCw size={14} className={screenshotLoading ? 'animate-spin' : ''} />
                                Refresh
                            </button>
                        </div>
                        <div className="aspect-video bg-gray-100 relative">
                            {screenshotLoading ? (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <RefreshCw size={32} className="text-gray-300 animate-spin" />
                                </div>
                            ) : screenshotUrl ? (
                                <img src={screenshotUrl} alt="Website" className="w-full h-full object-cover object-top" />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                                    <Globe size={48} />
                                </div>
                            )}
                        </div>
                        {website.meta.title && (
                            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
                                <p className="font-medium text-gray-800 text-sm truncate">{website.meta.title}</p>
                                {website.meta.description && (
                                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{website.meta.description}</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Priority Score Card */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-5">
                        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <TrendingUp size={16} className="text-indigo-500" />
                            Priority Score
                        </h3>
                        <div className="text-center py-4">
                            <div className={`text-5xl font-bold ${priority.band === 'High' ? 'text-green-600' :
                                priority.band === 'Medium' ? 'text-amber-500' : 'text-gray-400'
                                }`}>
                                {priority.score || 0}
                            </div>
                            <div className={`inline-flex mt-2 px-3 py-1 rounded-full text-sm font-medium ${priority.band === 'High' ? 'bg-green-100 text-green-700' :
                                priority.band === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                                }`}>
                                {priority.band || 'Not Scored'}
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                            <ScoreRow label="Financial Activity" score={financial.score} band={financial.band} />
                            <ScoreRow label="Website Health" score={staleness.score} band={staleness.confidence} invert />
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6">
                    {(['overview', 'financial', 'contacts'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === tab
                                ? 'bg-gray-900 text-white'
                                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* AI Summary */}
                        {ai && (
                            <Card title="AI Summary" icon={<MessageSquare size={16} className="text-purple-500" />}>
                                <p className="text-lg font-medium text-gray-800 mb-3">{ai.oneLiner}</p>
                                <p className="text-sm text-gray-600 leading-relaxed">{ai.overview}</p>
                            </Card>
                        )}

                        {/* Company Info */}
                        <Card title="Company Details" icon={<Building2 size={16} className="text-gray-400" />}>
                            <div className="space-y-3">
                                <InfoRow label="Legal Name" value={company.legalName} />
                                <InfoRow label="Company #" value={company.companyNumber} />
                                <InfoRow label="Industry" value={company.industry} />
                                <InfoRow label="Employees" value={company.employeeSize} />
                                {places && (
                                    <>
                                        <InfoRow label="Address" value={places.address} />
                                        <InfoRow label="Phone" value={places.phone} />
                                        {places.rating && (
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="text-gray-500 w-24">Rating</span>
                                                <span className="flex items-center gap-1 text-amber-500">
                                                    <Star size={14} fill="currentColor" />
                                                    {places.rating} ({places.reviewCount} reviews)
                                                </span>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </Card>

                        {/* Outreach Timeline */}
                        <Card title="Outreach Timeline" icon={<Mail size={16} className="text-blue-500" />} className="lg:col-span-2">
                            {outreachTimeline.length === 0 ? (
                                <div className="text-center py-8 text-gray-400">
                                    <Mail size={32} className="mx-auto mb-2 opacity-50" />
                                    <p>No outreach yet</p>
                                    <Link href={`/outreach?companyId=${company.id}`} className="text-indigo-600 text-sm hover:underline mt-2 inline-block">
                                        Start a conversation →
                                    </Link>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {outreachTimeline.slice(0, 5).map(item => (
                                        <Link
                                            key={item.id}
                                            href={`/outreach/sent?open=${item.id}`}
                                            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                                        >
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${item.replyDetectedAt ? 'bg-green-100' : 'bg-gray-100'
                                                }`}>
                                                {item.replyDetectedAt ? (
                                                    <CheckCircle size={14} className="text-green-600" />
                                                ) : (
                                                    <Send size={14} className="text-gray-400" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-800 truncate">{item.subject}</p>
                                                <p className="text-xs text-gray-500">
                                                    To: {item.contactName || item.contactEmail} • {formatDate(item.sentAt)}
                                                </p>
                                            </div>
                                            {item.replyIntent && (
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${getIntentStyle(item.replyIntent)}`}>
                                                    {item.replyIntent.replace('_', ' ')}
                                                </span>
                                            )}
                                            <ChevronRight size={16} className="text-gray-300" />
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </Card>
                    </div>
                )}

                {activeTab === 'financial' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card title="Financial Health" icon={<DollarSign size={16} className="text-green-500" />}>
                            <div className="text-center py-4 mb-4">
                                <div className={`text-4xl font-bold ${financial.band === 'Very Strong' || financial.band === 'Strong' ? 'text-green-600' :
                                    financial.band === 'Medium' ? 'text-amber-500' : 'text-gray-400'
                                    }`}>
                                    {financial.score || 0}/100
                                </div>
                                <span className={`inline-flex mt-2 px-3 py-1 rounded-full text-sm font-medium ${financial.band === 'Very Strong' ? 'bg-green-100 text-green-700' :
                                    financial.band === 'Strong' ? 'bg-emerald-100 text-emerald-700' :
                                        financial.band === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                                    }`}>
                                    {financial.band || 'Not Analysed'}
                                </span>
                            </div>
                            {financial.signals && (
                                <div className="space-y-2 border-t border-gray-100 pt-4">
                                    <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Signals</h4>
                                    {Object.entries(financial.signals).slice(0, 6).map(([key, value]) => (
                                        <div key={key} className="flex items-center justify-between text-sm">
                                            <span className="text-gray-600">{formatLabel(key)}</span>
                                            <span className="font-medium text-gray-800">{String(value)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>

                        <Card title="Website Staleness" icon={<Activity size={16} className="text-orange-500" />}>
                            <div className="text-center py-4 mb-4">
                                <div className={`text-4xl font-bold ${(staleness.score || 0) < 30 ? 'text-green-600' :
                                    (staleness.score || 0) < 60 ? 'text-amber-500' : 'text-red-500'
                                    }`}>
                                    {staleness.score || 0}
                                </div>
                                <span className="text-sm text-gray-500 mt-1">Staleness Score (lower = fresher)</span>
                            </div>
                            {staleness.reasons && Array.isArray(staleness.reasons) && (
                                <div className="space-y-2 border-t border-gray-100 pt-4">
                                    <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Reasons</h4>
                                    {staleness.reasons.map((reason: string, i: number) => (
                                        <div key={i} className="flex items-start gap-2 text-sm">
                                            <AlertCircle size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
                                            <span className="text-gray-600">{reason}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>
                    </div>
                )}

                {activeTab === 'contacts' && (
                    <Card title="Contacts" icon={<Users size={16} className="text-indigo-500" />}>
                        {contacts.length === 0 && discoveredEmails.length === 0 ? (
                            <div className="text-center py-8 text-gray-400">
                                <Users size={32} className="mx-auto mb-2 opacity-50" />
                                <p>No contacts found</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {contacts.map(contact => (
                                    <div key={contact.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100">
                                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-medium">
                                            {contact.name.charAt(0)}
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-medium text-gray-800">{contact.name}</p>
                                            <p className="text-sm text-gray-500">{contact.email}</p>
                                        </div>
                                        {contact.role && (
                                            <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                                                {contact.role}
                                            </span>
                                        )}
                                        <Link href={`/outreach?leadId=${contact.id}`} className="btn btn-secondary text-xs">
                                            <Mail size={14} />
                                            Email
                                        </Link>
                                    </div>
                                ))}
                                {discoveredEmails.length > 0 && (
                                    <div className="pt-4 border-t border-gray-100">
                                        <h4 className="text-xs font-medium text-gray-500 uppercase mb-3">Discovered Emails</h4>
                                        {discoveredEmails.map((email, i) => (
                                            <div key={i} className="flex items-center gap-2 text-sm py-1">
                                                <Mail size={14} className="text-gray-400" />
                                                <span className="text-gray-700">{email.email}</span>
                                                <span className={`text-xs px-1.5 py-0.5 rounded ${email.confidence === 'HIGH' ? 'bg-green-100 text-green-700' :
                                                    email.confidence === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                                                    }`}>
                                                    {email.confidence}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </Card>
                )}
            </main>
        </div>
    );
}

// Helper Components
function Card({ title, icon, children, className = '' }: { title: string; icon: React.ReactNode; children: React.ReactNode; className?: string }) {
    return (
        <div className={`bg-white rounded-2xl border border-gray-200 ${className}`}>
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                {icon}
                <h3 className="font-semibold text-gray-900">{title}</h3>
            </div>
            <div className="p-5">{children}</div>
        </div>
    );
}

function ScoreRow({ label, score, band, invert = false }: { label: string; score: number | null; band: string | null; invert?: boolean }) {
    const isGood = invert ? (score || 0) < 50 : (score || 0) >= 50;
    return (
        <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">{label}</span>
            <div className="flex items-center gap-2">
                <span className="font-medium">{score || 0}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${isGood ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {band || 'N/A'}
                </span>
            </div>
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
    if (!value) return null;
    return (
        <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500 w-24 flex-shrink-0">{label}</span>
            <span className="text-gray-800">{value}</span>
        </div>
    );
}

function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatLabel(key: string): string {
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
}

function getIntentStyle(intent: string): string {
    const styles: Record<string, string> = {
        POSITIVE: 'bg-green-100 text-green-700',
        NEUTRAL_QUESTION: 'bg-blue-100 text-blue-700',
        OBJECTION: 'bg-amber-100 text-amber-700',
        NOT_INTERESTED: 'bg-red-100 text-red-700'
    };
    return styles[intent] || 'bg-gray-100 text-gray-600';
}
