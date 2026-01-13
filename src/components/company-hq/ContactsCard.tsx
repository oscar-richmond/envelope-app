'use client';

import { useState, useEffect } from 'react';
import {
    Users, Search, RefreshCw, Check, Shield, AlertCircle,
    Globe, Zap, Building2, ChevronDown, ChevronUp, Copy, Mail
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface EnrichedContact {
    email: string;
    name?: string | null;
    role?: string | null;
    type?: 'person' | 'department' | 'generic';
    sources?: string[];
    confidence?: number;
    deliverability?: 'high' | 'medium' | 'low' | 'catch-all' | 'unknown';
    score?: number;
    isBestContact?: boolean;
}

interface ContactsCardProps {
    prospectId?: number;
    leadId?: number;
    companyId?: number;
    emails?: any[];
    contacts?: any[];
    onSelectEmail?: (email: string) => void;
}

export default function ContactsCard({
    prospectId,
    leadId,
    companyId,
    emails: emailsProp,
    contacts: contactsProp,
    onSelectEmail
}: ContactsCardProps) {
    const router = useRouter();
    const [rescanning, setRescanning] = useState(false);
    const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
    const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
    const [showGeneric, setShowGeneric] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);

    // Enriched contacts state
    const [bestContacts, setBestContacts] = useState<EnrichedContact[]>([]);
    const [moreContacts, setMoreContacts] = useState<EnrichedContact[]>([]);
    const [genericContacts, setGenericContacts] = useState<EnrichedContact[]>([]);

    // Initial load from props
    useEffect(() => {
        const allContacts: EnrichedContact[] = Array.isArray(emailsProp) ? emailsProp
            : Array.isArray(contactsProp) ? contactsProp
                : [];

        // Group contacts
        const best: EnrichedContact[] = [];
        const more: EnrichedContact[] = [];
        const generic: EnrichedContact[] = [];

        for (const c of allContacts) {
            const isGeneric = isGenericEmail(c.email);
            if (c.isBestContact && !isGeneric) {
                best.push(c);
            } else if (isGeneric || c.type === 'generic') {
                generic.push(c);
            } else {
                more.push(c);
            }
        }

        // Limit best to 3
        if (best.length > 3) {
            more.unshift(...best.splice(3));
        }

        setBestContacts(best);
        setMoreContacts(more);
        setGenericContacts(generic);
    }, [emailsProp, contactsProp]);

    const handleRescan = async () => {
        const id = companyId || prospectId;
        if (!id) return;

        setRescanning(true);
        try {
            const res = await fetch(`/api/companies/${id}/enrichment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (res.ok) {
                const data = await res.json();
                setBestContacts(data.bestContacts || []);
                setMoreContacts(data.moreContacts || []);
                setGenericContacts(data.genericContacts || []);
                setLastUpdated(new Date().toLocaleString());
            }
        } catch (e) {
            console.error('Rescan failed:', e);
        } finally {
            setRescanning(false);
        }
    };

    const handleUseEmail = (email: string) => {
        setSelectedEmail(email);
        onSelectEmail?.(email);
    };

    const handleCopyEmail = async (email: string) => {
        try {
            await navigator.clipboard.writeText(email);
            setCopiedEmail(email);
            setTimeout(() => setCopiedEmail(null), 2000);
        } catch (e) {
            console.error('Copy failed:', e);
        }
    };

    const totalCount = bestContacts.length + moreContacts.length + genericContacts.length;

    return (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100"
                style={{ background: 'var(--accent-lilac-bg)' }}>
                <div className="flex items-center gap-2">
                    <Users size={18} style={{ color: 'var(--accent-lilac-text)' }} />
                    <h3 className="font-semibold" style={{ color: 'var(--accent-lilac-text)' }}>
                        Contacts
                    </h3>
                    {totalCount > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(139, 92, 246, 0.15)', color: 'var(--accent-lilac-text)' }}>
                            {totalCount}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {lastUpdated && (
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            Updated {lastUpdated}
                        </span>
                    )}
                    <button
                        onClick={handleRescan}
                        disabled={rescanning}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
                        style={{
                            background: 'rgba(139, 92, 246, 0.15)',
                            color: 'var(--accent-lilac-text)',
                            cursor: rescanning ? 'wait' : 'pointer'
                        }}
                    >
                        <RefreshCw size={12} className={rescanning ? 'animate-spin' : ''} />
                        {rescanning ? 'Scanning...' : 'Rescan'}
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="divide-y divide-gray-100">
                {totalCount === 0 ? (
                    <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
                        <Users size={32} className="mx-auto mb-2 opacity-40" />
                        <p className="text-sm">No contacts found yet.</p>
                        <button
                            onClick={handleRescan}
                            disabled={rescanning}
                            className="mt-3 text-xs font-medium px-4 py-2 rounded-lg transition-all"
                            style={{
                                background: 'var(--brand-soft)',
                                color: 'var(--brand)'
                            }}
                        >
                            {rescanning ? 'Scanning...' : 'Find Contacts'}
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Best Contacts Section */}
                        {bestContacts.length > 0 && (
                            <div>
                                <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider"
                                    style={{ background: 'var(--bg-card-muted)', color: 'var(--text-muted)' }}>
                                    Best Contacts
                                </div>
                                {bestContacts.map((c, i) => (
                                    <ContactRow
                                        key={c.email || i}
                                        contact={c}
                                        isSelected={selectedEmail === c.email}
                                        isCopied={copiedEmail === c.email}
                                        onUse={() => handleUseEmail(c.email)}
                                        onCopy={() => handleCopyEmail(c.email)}
                                        isBest
                                    />
                                ))}
                            </div>
                        )}

                        {/* More Contacts Section */}
                        {moreContacts.length > 0 && (
                            <div>
                                <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider"
                                    style={{ background: 'var(--bg-card-muted)', color: 'var(--text-muted)' }}>
                                    More Contacts
                                </div>
                                {moreContacts.map((c, i) => (
                                    <ContactRow
                                        key={c.email || i}
                                        contact={c}
                                        isSelected={selectedEmail === c.email}
                                        isCopied={copiedEmail === c.email}
                                        onUse={() => handleUseEmail(c.email)}
                                        onCopy={() => handleCopyEmail(c.email)}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Generic Section (Collapsed) */}
                        {genericContacts.length > 0 && (
                            <div>
                                <button
                                    onClick={() => setShowGeneric(!showGeneric)}
                                    className="w-full px-4 py-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider transition-colors hover:bg-gray-50"
                                    style={{ background: 'var(--bg-card-muted)', color: 'var(--text-muted)' }}
                                >
                                    <span>Generic Inboxes ({genericContacts.length})</span>
                                    {showGeneric ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>
                                {showGeneric && genericContacts.map((c, i) => (
                                    <ContactRow
                                        key={c.email || i}
                                        contact={c}
                                        isSelected={selectedEmail === c.email}
                                        isCopied={copiedEmail === c.email}
                                        onUse={() => handleUseEmail(c.email)}
                                        onCopy={() => handleCopyEmail(c.email)}
                                        isGeneric
                                    />
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

// Helper function
function isGenericEmail(email: string): boolean {
    if (!email) return false;
    const genericPrefixes = ['info', 'contact', 'hello', 'hi', 'enquiries', 'enquiry',
        'general', 'admin', 'office', 'team', 'mail', 'email', 'inbox',
        'support', 'sales', 'marketing', 'hr'];
    const local = email.split('@')[0].toLowerCase();
    return genericPrefixes.includes(local);
}

// Contact Row Component
function ContactRow({
    contact,
    isSelected,
    isCopied,
    onUse,
    onCopy,
    isBest = false,
    isGeneric = false
}: {
    contact: EnrichedContact;
    isSelected: boolean;
    isCopied: boolean;
    onUse: () => void;
    onCopy: () => void;
    isBest?: boolean;
    isGeneric?: boolean;
}) {
    const initial = contact.name?.[0]?.toUpperCase() || contact.email?.[0]?.toUpperCase() || '?';

    return (
        <div className={`p-4 flex items-center justify-between group transition-colors hover:bg-gray-50 ${isSelected ? 'bg-indigo-50 border-l-2 border-indigo-500' : ''
            }`}>
            <div className="flex items-center gap-3 min-w-0">
                {/* Avatar */}
                <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{
                        background: isBest ? 'linear-gradient(135deg, var(--accent-lilac-bg), var(--brand-soft))' :
                            isGeneric ? 'var(--bg-card-muted)' :
                                'linear-gradient(135deg, #f0f9ff, #f3e8ff)',
                        color: isBest ? 'var(--accent-lilac-text)' :
                            isGeneric ? 'var(--text-muted)' :
                                '#7c3aed',
                        border: isBest ? '1px solid rgba(139, 92, 246, 0.2)' : '1px solid var(--border-soft)'
                    }}
                >
                    {isGeneric ? <Mail size={14} /> : initial}
                </div>

                {/* Details */}
                <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                            {contact.name || contact.email?.split('@')[0]}
                        </span>
                        {contact.role && (
                            <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                                {contact.role}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                            {contact.email}
                        </span>

                        {/* Badges */}
                        <div className="flex items-center gap-1.5">
                            {/* Verification Badge */}
                            <VerificationBadge deliverability={contact.deliverability} />

                            {/* Source Badges */}
                            {contact.sources?.map((source, i) => (
                                <SourceBadge key={i} source={source} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
                <button
                    onClick={onCopy}
                    className="p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    style={{ color: isCopied ? 'var(--accent-mint-text)' : 'var(--text-muted)' }}
                    title="Copy email"
                >
                    {isCopied ? <Check size={14} /> : <Copy size={14} />}
                </button>
                <button
                    onClick={onUse}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'opacity-0 group-hover:opacity-100 bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                        }`}
                    title="Use this email"
                >
                    {isSelected ? 'Selected' : 'Use'}
                </button>
            </div>
        </div>
    );
}

// Verification Badge Component
function VerificationBadge({ deliverability }: { deliverability?: string }) {
    switch (deliverability) {
        case 'high':
            return (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-green-50 text-green-700 border border-green-200">
                    <Shield size={9} />
                    Verified
                </span>
            );
        case 'medium':
        case 'catch-all':
            return (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    <AlertCircle size={9} />
                    Risky
                </span>
            );
        case 'low':
            return (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-red-50 text-red-600 border border-red-200">
                    <AlertCircle size={9} />
                    Invalid
                </span>
            );
        default:
            return null;
    }
}

// Source Badge Component
function SourceBadge({ source }: { source: string }) {
    const configs: Record<string, { icon: any; label: string; bg: string; color: string }> = {
        hunter: { icon: Zap, label: 'Hunter', bg: 'rgba(245, 158, 11, 0.1)', color: 'rgb(180, 83, 9)' },
        website: { icon: Globe, label: 'Website', bg: 'rgba(59, 130, 246, 0.1)', color: 'rgb(37, 99, 235)' },
        companies_house: { icon: Building2, label: 'CH', bg: 'rgba(107, 114, 128, 0.1)', color: 'rgb(75, 85, 99)' },
        pattern: { icon: Mail, label: 'Pattern', bg: 'rgba(139, 92, 246, 0.1)', color: 'rgb(109, 40, 217)' }
    };

    const config = configs[source?.toLowerCase()] || configs.website;
    const Icon = config.icon;

    return (
        <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full"
            style={{ background: config.bg, color: config.color }}
        >
            <Icon size={9} />
            {config.label}
        </span>
    );
}
