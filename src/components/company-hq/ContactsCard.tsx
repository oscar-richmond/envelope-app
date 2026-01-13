'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Users, RefreshCw, Check, Shield, AlertCircle,
    Globe, Zap, Building2, ChevronDown, ChevronUp, Copy, Mail, Loader2, Plus, UserPlus, Sparkles, Lightbulb
} from 'lucide-react';
import AddContactModal from '@/components/modals/AddContactModal';

interface Contact {
    id?: string;
    email: string;
    name?: string | null;
    fullName?: string | null;
    role?: string | null;
    type?: 'person' | 'personal' | 'department' | 'generic';
    source?: string;
    sources?: string[];
    confidence?: number;
    deliverability?: 'high' | 'medium' | 'low' | 'catch-all' | 'unknown';
    verified?: boolean;
    isBestContact?: boolean;
    isManual?: boolean;
}

interface ContactsCardProps {
    prospectId?: number;
    leadId?: number;
    companyId?: number;
    companyName?: string;
    emails?: any[];
    contacts?: any[];
    onSelectEmail?: (email: string) => void;
}

type LoadState = 'idle' | 'loading' | 'error' | 'success';
type ScanState = 'idle' | 'scanning' | 'polling' | 'done' | 'error';

export default function ContactsCard({
    prospectId,
    leadId,
    companyId,
    companyName,
    emails: emailsProp,
    contacts: contactsProp,
    onSelectEmail
}: ContactsCardProps) {
    // Canonical ID
    const id = companyId || prospectId;

    // Loading states
    const [loadState, setLoadState] = useState<LoadState>('idle');
    const [scanState, setScanState] = useState<ScanState>('idle');
    const [error, setError] = useState<string | null>(null);

    // Contacts data
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [lastScannedAt, setLastScannedAt] = useState<string | null>(null);

    // UI state
    const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
    const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
    const [showGeneric, setShowGeneric] = useState(false);
    const [showMore, setShowMore] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Email pattern state
    const [emailPattern, setEmailPattern] = useState<any>(null);
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [generatingSuggestions, setGeneratingSuggestions] = useState(false);

    // Fetch contacts on mount
    const fetchContacts = useCallback(async () => {
        if (!id) {
            console.log('[ContactsCard] No companyId/prospectId provided');
            setError('Company record missing identifier');
            setLoadState('error');
            return;
        }

        console.log(`[ContactsCard] Fetching contacts for company ${id}`);
        setLoadState('loading');
        setError(null);

        try {
            const res = await fetch(`/api/companies/${id}/contacts`);
            console.log(`[ContactsCard] Response status: ${res.status}`);

            if (res.status === 401) {
                setError('Please sign in again');
                setLoadState('error');
                return;
            }

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setError(data.error || `Couldn't load contacts. (${res.status})`);
                setLoadState('error');
                return;
            }

            const data = await res.json();
            console.log(`[ContactsCard] Loaded ${data.contacts?.length || 0} contacts`);

            setContacts(data.contacts || []);
            setLastScannedAt(data.lastScannedAt);
            setLoadState('success');

        } catch (e: any) {
            console.error('[ContactsCard] Fetch error:', e);
            setError('Network error - try again');
            setLoadState('error');
        }
    }, [id]);

    // Fetch on mount
    useEffect(() => {
        // If props provided, use them initially
        if (emailsProp?.length || contactsProp?.length) {
            const propContacts = emailsProp || contactsProp || [];
            setContacts(propContacts);
            setLoadState('success');
        }

        // Then fetch fresh data
        if (id) {
            fetchContacts();
            // Also fetch pattern
            fetchEmailPattern();
        }
    }, [id, fetchContacts]);

    // Fetch email pattern
    const fetchEmailPattern = useCallback(async () => {
        if (!id) return;
        try {
            const res = await fetch(`/api/companies/${id}/email-pattern/infer`, { method: 'GET' });
            if (res.ok) {
                const data = await res.json();
                if (data.hasPattern) {
                    setEmailPattern(data.pattern);
                }
            }
        } catch (e) {
            console.error('[ContactsCard] Failed to fetch pattern:', e);
        }
    }, [id]);

    // Generate email suggestions
    const handleGenerateSuggestions = useCallback(async () => {
        if (!id || generatingSuggestions) return;
        setGeneratingSuggestions(true);

        try {
            // First infer pattern if needed
            await fetch(`/api/companies/${id}/email-pattern/infer`, { method: 'POST' });

            // Then generate suggestions
            const res = await fetch(`/api/companies/${id}/email-suggestions/generate`, {
                method: 'POST'
            });

            if (res.ok) {
                const data = await res.json();
                setSuggestions(data.suggestions || []);
                setEmailPattern({ patternKey: data.patternKey, confidence: data.patternConfidence });
                setShowSuggestions(true);
            }
        } catch (e) {
            console.error('[ContactsCard] Failed to generate suggestions:', e);
        } finally {
            setGeneratingSuggestions(false);
        }
    }, [id, generatingSuggestions]);

    // Use a suggested email
    const handleUseSuggestion = useCallback(async (suggestion: any) => {
        if (!id) return;

        try {
            // Create manual contact from suggestion
            const res = await fetch(`/api/companies/${id}/contacts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    firstName: suggestion.firstName,
                    lastName: suggestion.lastName,
                    roleTitle: suggestion.role || '',
                    email: suggestion.suggestedEmail
                })
            });

            if (res.ok) {
                const data = await res.json();
                // Add to contacts list
                setContacts(prev => [data.contact, ...prev]);
                // Remove from suggestions
                setSuggestions(prev => prev.filter(s => s.contactId !== suggestion.contactId));
            }
        } catch (e) {
            console.error('[ContactsCard] Failed to use suggestion:', e);
        }
    }, [id]);

    // Scan contacts handler
    const handleScan = useCallback(async (force = false) => {
        if (!id) {
            console.log('[ContactsCard] No companyId for scan');
            setError('Company record missing identifier');
            return;
        }

        console.log(`[ContactsCard] Starting contact scan for company ${id}, force=${force}`);
        setScanState('scanning');
        setError(null);

        try {
            // Start scan job
            const res = await fetch(`/api/companies/${id}/contacts/scan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ force })
            });

            console.log(`[ContactsCard] Scan response status: ${res.status}`);

            if (res.status === 401) {
                setError('Please sign in again');
                setScanState('error');
                return;
            }

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Scan failed');
                setScanState('error');
                return;
            }

            const { jobId } = data;
            console.log(`[ContactsCard] Scan job started: ${jobId}`);

            // Poll for completion
            setScanState('polling');
            let attempts = 0;
            const maxAttempts = 30; // 45 seconds max

            const pollInterval = setInterval(async () => {
                attempts++;

                try {
                    const statusRes = await fetch(`/api/companies/${id}/contacts/scan?jobId=${jobId}`);
                    const status = await statusRes.json();

                    console.log(`[ContactsCard] Job status:`, status);

                    if (status.status === 'done') {
                        clearInterval(pollInterval);
                        setScanState('done');

                        // Refetch contacts
                        await fetchContacts();

                        setTimeout(() => setScanState('idle'), 2000);
                    } else if (status.status === 'failed') {
                        clearInterval(pollInterval);
                        setError(status.error || 'Scan failed');
                        setScanState('error');
                    } else if (attempts >= maxAttempts) {
                        clearInterval(pollInterval);
                        setError('Scan timed out - try again');
                        setScanState('error');
                    }
                } catch (e) {
                    console.error('[ContactsCard] Poll error:', e);
                }
            }, 1500);

        } catch (e: any) {
            console.error('[ContactsCard] Scan error:', e);
            setError(e.message || 'Scan failed');
            setScanState('error');
        }
    }, [id, fetchContacts]);

    // Copy email handler
    const handleCopyEmail = async (email: string) => {
        try {
            await navigator.clipboard.writeText(email);
            setCopiedEmail(email);
            setTimeout(() => setCopiedEmail(null), 2000);
        } catch (e) {
            console.error('Copy failed:', e);
        }
    };

    // Select email handler
    const handleSelectEmail = (email: string) => {
        setSelectedEmail(email);
        onSelectEmail?.(email);
    };

    // Categorize contacts
    const bestContacts = contacts.filter(c =>
        c.isBestContact ||
        (c.type !== 'generic' && (c.confidence ?? 0) > 0.7)
    ).slice(0, 5);

    const moreContacts = contacts.filter(c =>
        !c.isBestContact &&
        c.type !== 'generic' &&
        (c.confidence ?? 0) <= 0.7
    );

    const genericContacts = contacts.filter(c =>
        c.type === 'generic' ||
        isGenericEmail(c.email)
    );

    const totalCount = contacts.length;
    const isScanning = scanState === 'scanning' || scanState === 'polling';
    const canInteract = loadState !== 'loading' && !isScanning;

    return (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Header */}
            <div
                className="px-5 py-4 flex items-center justify-between border-b border-gray-100"
                style={{ background: 'var(--accent-lilac-bg)' }}
            >
                <div className="flex items-center gap-2">
                    <Users size={18} style={{ color: 'var(--accent-lilac-text)' }} />
                    <h3 className="font-semibold" style={{ color: 'var(--accent-lilac-text)' }}>
                        Contacts
                    </h3>
                    {totalCount > 0 && (
                        <span
                            className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(139, 92, 246, 0.15)', color: 'var(--accent-lilac-text)' }}
                        >
                            {totalCount}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {lastScannedAt && (
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            {new Date(lastScannedAt).toLocaleDateString()}
                        </span>
                    )}
                    <button
                        onClick={() => handleScan(true)}
                        disabled={!canInteract || !id}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
                        style={{
                            background: 'rgba(139, 92, 246, 0.15)',
                            color: 'var(--accent-lilac-text)',
                            cursor: canInteract && id ? 'pointer' : 'not-allowed',
                            opacity: canInteract && id ? 1 : 0.5
                        }}
                    >
                        {isScanning ? (
                            <Loader2 size={12} className="animate-spin" />
                        ) : (
                            <RefreshCw size={12} />
                        )}
                        {isScanning ? 'Scanning...' : 'Rescan'}
                    </button>
                    {/* Add Contact Button */}
                    <button
                        onClick={() => setShowAddModal(true)}
                        disabled={!canInteract || !id}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
                        style={{
                            background: 'var(--brand)',
                            color: 'white',
                            cursor: canInteract && id ? 'pointer' : 'not-allowed',
                            opacity: canInteract && id ? 1 : 0.5
                        }}
                    >
                        <Plus size={12} />
                        Add
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="divide-y divide-gray-100">
                {/* Loading State */}
                {loadState === 'loading' && (
                    <div className="p-6 space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="animate-pulse flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gray-200" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                                    <div className="h-2 bg-gray-200 rounded w-1/3" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Error State */}
                {loadState === 'error' && error && (
                    <div className="p-6 text-center">
                        <AlertCircle size={32} className="mx-auto mb-2 text-red-400" />
                        <p className="text-sm text-red-600 mb-3">{error}</p>
                        <button
                            onClick={fetchContacts}
                            className="text-xs font-medium px-4 py-2 rounded-lg transition-all"
                            style={{ background: 'var(--bg-card-muted)', color: 'var(--text-secondary)' }}
                        >
                            Try again
                        </button>
                    </div>
                )}

                {/* Scanning State */}
                {isScanning && loadState !== 'loading' && (
                    <div className="p-6 text-center" style={{ color: 'var(--text-muted)' }}>
                        <Loader2 size={32} className="mx-auto mb-2 animate-spin text-purple-500" />
                        <p className="text-sm font-medium">Finding contacts...</p>
                        <p className="text-xs mt-1">This may take a moment</p>
                    </div>
                )}

                {/* Empty State */}
                {loadState === 'success' && !isScanning && totalCount === 0 && (
                    <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
                        <Users size={32} className="mx-auto mb-2 opacity-40" />
                        <p className="text-sm">No contacts found yet.</p>
                        <button
                            onClick={() => handleScan(false)}
                            disabled={!id}
                            className="mt-3 text-xs font-medium px-4 py-2 rounded-lg transition-all"
                            style={{
                                background: id ? 'var(--brand-soft)' : 'var(--bg-card-muted)',
                                color: id ? 'var(--brand)' : 'var(--text-muted)',
                                cursor: id ? 'pointer' : 'not-allowed'
                            }}
                        >
                            Find Contacts
                        </button>
                        {!id && (
                            <p className="text-xs mt-2 text-red-500">Company record missing identifier</p>
                        )}
                    </div>
                )}

                {/* Contacts List */}
                {loadState === 'success' && !isScanning && totalCount > 0 && (
                    <>
                        {/* Best Contacts */}
                        {bestContacts.length > 0 && (
                            <div className="p-4">
                                <h4 className="text-[10px] font-semibold uppercase tracking-wider mb-3"
                                    style={{ color: 'var(--text-muted)' }}>
                                    Best Contacts
                                </h4>
                                <div className="space-y-2">
                                    {bestContacts.map((contact, idx) => (
                                        <ContactRow
                                            key={contact.id || idx}
                                            contact={contact}
                                            isSelected={selectedEmail === contact.email}
                                            isCopied={copiedEmail === contact.email}
                                            onSelect={() => handleSelectEmail(contact.email)}
                                            onCopy={() => handleCopyEmail(contact.email)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* More Contacts */}
                        {moreContacts.length > 0 && (
                            <div className="p-4">
                                <button
                                    onClick={() => setShowMore(!showMore)}
                                    className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider mb-3"
                                    style={{ color: 'var(--text-muted)' }}
                                >
                                    More Contacts ({moreContacts.length})
                                    {showMore ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                </button>
                                {showMore && (
                                    <div className="space-y-2">
                                        {moreContacts.map((contact, idx) => (
                                            <ContactRow
                                                key={contact.id || idx}
                                                contact={contact}
                                                isSelected={selectedEmail === contact.email}
                                                isCopied={copiedEmail === contact.email}
                                                onSelect={() => handleSelectEmail(contact.email)}
                                                onCopy={() => handleCopyEmail(contact.email)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Generic Contacts */}
                        {genericContacts.length > 0 && (
                            <div className="p-4">
                                <button
                                    onClick={() => setShowGeneric(!showGeneric)}
                                    className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider mb-3"
                                    style={{ color: 'var(--text-muted)' }}
                                >
                                    Generic Inboxes ({genericContacts.length})
                                    {showGeneric ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                </button>
                                {showGeneric && (
                                    <div className="space-y-2">
                                        {genericContacts.map((contact, idx) => (
                                            <ContactRow
                                                key={contact.id || idx}
                                                contact={contact}
                                                isSelected={selectedEmail === contact.email}
                                                isCopied={copiedEmail === contact.email}
                                                onSelect={() => handleSelectEmail(contact.email)}
                                                onCopy={() => handleCopyEmail(contact.email)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Email Suggestions Section */}
                        {(suggestions.length > 0 || emailPattern) && (
                            <div className="p-4 border-t" style={{ background: 'rgba(139, 92, 246, 0.03)' }}>
                                {/* Pattern Indicator */}
                                {emailPattern && (
                                    <div className="flex items-center gap-2 mb-3">
                                        <Sparkles size={12} style={{ color: 'var(--accent-lilac-text)' }} />
                                        <span
                                            className="text-[10px] font-medium px-2 py-0.5 rounded"
                                            style={{ background: 'rgba(139, 92, 246, 0.15)', color: 'var(--accent-lilac-text)' }}
                                        >
                                            Pattern: {emailPattern.patternKey}@domain
                                        </span>
                                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                            ({Math.round((emailPattern.confidence || 0) * 100)}% confident)
                                        </span>
                                    </div>
                                )}

                                {/* Suggestions list */}
                                {suggestions.length > 0 && (
                                    <>
                                        <button
                                            onClick={() => setShowSuggestions(!showSuggestions)}
                                            className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider mb-3"
                                            style={{ color: 'var(--accent-lilac-text)' }}
                                        >
                                            <Lightbulb size={12} />
                                            Suggested Emails ({suggestions.length})
                                            {showSuggestions ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                        </button>
                                        {showSuggestions && (
                                            <div className="space-y-2">
                                                {suggestions.map((s, idx) => (
                                                    <div
                                                        key={s.contactId || idx}
                                                        className="flex items-center gap-3 p-2 rounded-lg"
                                                        style={{ background: 'rgba(139, 92, 246, 0.08)', border: '1px dashed rgba(139, 92, 246, 0.3)' }}
                                                    >
                                                        {/* Avatar */}
                                                        <div
                                                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold opacity-60"
                                                            style={{
                                                                background: 'linear-gradient(135deg, rgb(139, 92, 246), rgb(59, 130, 246))',
                                                                color: 'white'
                                                            }}
                                                        >
                                                            {(s.firstName || '?')[0]?.toUpperCase()}
                                                        </div>

                                                        {/* Info */}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                                                    {s.fullName || `${s.firstName} ${s.lastName}`}
                                                                </span>
                                                                <span
                                                                    className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                                                                    style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'rgb(180, 83, 9)' }}
                                                                >
                                                                    Suggested
                                                                </span>
                                                            </div>
                                                            <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                                                                {s.suggestedEmail}
                                                            </span>
                                                            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                                                {Math.round((s.confidence || 0) * 100)}% confidence
                                                            </div>
                                                        </div>

                                                        {/* Use Button */}
                                                        <button
                                                            onClick={() => handleUseSuggestion(s)}
                                                            className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all hover:scale-[1.02]"
                                                            style={{
                                                                background: 'var(--brand)',
                                                                color: 'white'
                                                            }}
                                                        >
                                                            Use
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* Generate Button (if pattern exists but no suggestions yet) */}
                                {emailPattern && suggestions.length === 0 && (
                                    <button
                                        onClick={handleGenerateSuggestions}
                                        disabled={generatingSuggestions}
                                        className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
                                        style={{
                                            background: 'rgba(139, 92, 246, 0.15)',
                                            color: 'var(--accent-lilac-text)',
                                            cursor: generatingSuggestions ? 'wait' : 'pointer'
                                        }}
                                    >
                                        {generatingSuggestions ? (
                                            <Loader2 size={12} className="animate-spin" />
                                        ) : (
                                            <Sparkles size={12} />
                                        )}
                                        {generatingSuggestions ? 'Generating...' : 'Generate Email Suggestions'}
                                    </button>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Add Contact Modal */}
            <AddContactModal
                isOpen={showAddModal}
                companyId={id || 0}
                companyName={companyName}
                onClose={() => setShowAddModal(false)}
                onSuccess={(contact) => {
                    // Optimistically add to list
                    setContacts(prev => [contact, ...prev]);
                    setShowAddModal(false);
                }}
            />
        </div>
    );
}

// Contact Row Component
function ContactRow({
    contact,
    isSelected,
    isCopied,
    onSelect,
    onCopy
}: {
    contact: Contact;
    isSelected: boolean;
    isCopied: boolean;
    onSelect: () => void;
    onCopy: () => void;
}) {
    const displayName = contact.name || contact.fullName || contact.email.split('@')[0];
    const source = contact.source || (contact.sources?.[0]) || 'unknown';

    return (
        <div
            className={`flex items-center gap-3 p-2 rounded-lg transition-all cursor-pointer ${isSelected ? 'ring-2 ring-purple-400' : ''
                }`}
            style={{ background: isSelected ? 'rgba(139, 92, 246, 0.08)' : 'var(--bg-card-muted)' }}
            onClick={onSelect}
        >
            {/* Avatar */}
            <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                style={{
                    background: 'linear-gradient(135deg, rgb(139, 92, 246), rgb(59, 130, 246))',
                    color: 'white'
                }}
            >
                {displayName[0]?.toUpperCase() || '?'}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                        {displayName}
                    </span>
                    {contact.verified && <Shield size={12} className="text-green-500" />}
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                        {contact.email}
                    </span>
                    <SourceBadge source={source} />
                </div>
                {contact.role && (
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        {contact.role}
                    </span>
                )}
            </div>

            {/* Copy Button */}
            <button
                onClick={(e) => { e.stopPropagation(); onCopy(); }}
                className="p-1.5 rounded-md transition-all hover:bg-gray-200"
                style={{ color: 'var(--text-muted)' }}
            >
                {isCopied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
            </button>
        </div>
    );
}

// Source Badge Component
function SourceBadge({ source }: { source: string }) {
    const configs: Record<string, { icon: any; label: string; bg: string; color: string }> = {
        manual: { icon: UserPlus, label: 'Manual', bg: 'rgba(16, 185, 129, 0.1)', color: 'rgb(5, 150, 105)' },
        hunter: { icon: Zap, label: 'Hunter', bg: 'rgba(245, 158, 11, 0.1)', color: 'rgb(180, 83, 9)' },
        website: { icon: Globe, label: 'Website', bg: 'rgba(59, 130, 246, 0.1)', color: 'rgb(37, 99, 235)' },
        companies_house: { icon: Building2, label: 'CH', bg: 'rgba(107, 114, 128, 0.1)', color: 'rgb(75, 85, 99)' },
        pattern: { icon: Mail, label: 'Pattern', bg: 'rgba(139, 92, 246, 0.1)', color: 'rgb(109, 40, 217)' }
    };

    const config = configs[source] || configs.website;
    const Icon = config.icon;

    return (
        <span
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium"
            style={{ background: config.bg, color: config.color }}
        >
            <Icon size={9} />
            {config.label}
        </span>
    );
}

// Helper function
function isGenericEmail(email: string): boolean {
    if (!email) return false;
    const genericPrefixes = [
        'info', 'contact', 'hello', 'support', 'admin', 'sales', 'marketing',
        'team', 'office', 'enquiries', 'inquiries', 'help', 'careers', 'jobs',
        'press', 'media', 'hr', 'recruitment', 'billing', 'accounts'
    ];
    const prefix = email.split('@')[0].toLowerCase();
    return genericPrefixes.includes(prefix);
}
