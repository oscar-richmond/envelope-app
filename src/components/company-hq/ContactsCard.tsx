'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Users, RefreshCw, Check, Shield, AlertCircle, X,
    Globe, Zap, Building2, ChevronDown, ChevronUp, Copy, Mail, Loader2, Plus, UserPlus, Sparkles, Lightbulb, MoreVertical, Pencil, Trash2
} from 'lucide-react';
import AddContactModal from '@/components/modals/AddContactModal';

interface Contact {
    id?: string;
    email: string;
    name?: string | null;
    fullName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    role?: string | null;
    roleTitle?: string | null;
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
    const [showAllContacts, setShowAllContacts] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Email pattern state
    const [emailPattern, setEmailPattern] = useState<any>(null);
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [generatingSuggestions, setGeneratingSuggestions] = useState(false);

    // Edit/Delete state
    const [editingContact, setEditingContact] = useState<Contact | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [deletingContactId, setDeletingContactId] = useState<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
        // If contacts prop provided, use it immediately
        if (contactsProp && contactsProp.length > 0) {
            console.log('[ContactsCard] Using prop contacts:', contactsProp.length);
            setContacts(contactsProp);
            setLoadState('success');
            return; // Don't fetch if we have prop data
        }

        // If emailsProp provided, use it
        if (emailsProp && emailsProp.length > 0) {
            console.log('[ContactsCard] Using prop emails:', emailsProp.length);
            setContacts(emailsProp);
            setLoadState('success');
            return;
        }

        // Otherwise fetch from API if we have an ID
        if (id) {
            console.log('[ContactsCard] Fetching from API for id:', id);
            fetchContacts();
        } else {
            console.log('[ContactsCard] No ID and no props - showing empty state');
            setLoadState('success');
        }
    }, [id, contactsProp, emailsProp, fetchContacts]);

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

            // Scan now runs synchronously - just check result and refetch
            console.log(`[ContactsCard] Scan complete:`, data);

            if (data.success) {
                setScanState('done');
                console.log(`[ContactsCard] Scan successful, found ${data.contactsFound} contacts. Refetching...`);

                // Refetch contacts from database
                await fetchContacts();

                setTimeout(() => setScanState('idle'), 2000);
            } else {
                setError(data.error || 'Scan failed');
                setScanState('error');
            }

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

    // Edit contact handler
    const handleEditContact = (contact: Contact) => {
        setEditingContact(contact);
        setShowEditModal(true);
    };

    // Save edited contact
    const handleSaveEdit = async (updates: Partial<Contact>) => {
        if (!editingContact?.id) return;

        try {
            const res = await fetch(`/api/contacts/${editingContact.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });

            if (res.ok) {
                const data = await res.json();
                // Update contacts list
                setContacts(prev => prev.map(c =>
                    c.id === editingContact.id ? { ...c, ...data.contact } : c
                ));
                setShowEditModal(false);
                setEditingContact(null);
            } else {
                const err = await res.json();
                setError(err.error || 'Failed to update contact');
            }
        } catch (e) {
            console.error('[ContactsCard] Edit failed:', e);
            setError('Failed to update contact');
        }
    };

    // Delete contact handler
    const handleDeleteContact = async (contactId: string) => {
        try {
            const res = await fetch(`/api/contacts/${contactId}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                // Remove from contacts list
                setContacts(prev => prev.filter(c => c.id !== contactId));
                setShowDeleteConfirm(false);
                setDeletingContactId(null);
            } else {
                const err = await res.json();
                setError(err.error || 'Failed to delete contact');
            }
        } catch (e) {
            console.error('[ContactsCard] Delete failed:', e);
            setError('Failed to delete contact');
        }
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
    const isLoading = loadState === 'loading';
    // Rescan: disabled during loading or scanning
    const canRescan = !isLoading && !isScanning && !!id;
    // Add: always enabled if we have an ID (even during error state)
    const canAdd = !!id && !showAddModal;

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
                    <button
                        onClick={() => handleScan(true)}
                        disabled={!canRescan}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
                        style={{
                            background: 'rgba(139, 92, 246, 0.15)',
                            color: 'var(--accent-lilac-text)',
                            cursor: canRescan ? 'pointer' : 'not-allowed',
                            opacity: canRescan ? 1 : 0.5
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
                        disabled={!canAdd}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
                        style={{
                            background: 'var(--brand)',
                            color: 'white',
                            cursor: canAdd ? 'pointer' : 'not-allowed',
                            opacity: canAdd ? 1 : 0.5
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
                        {/* Contacts List */}
                        {bestContacts.length > 0 && (
                            <div className="p-4">
                                <div className="space-y-2">
                                    {bestContacts.map((contact, idx) => (
                                        <ContactRow
                                            key={contact.id || idx}
                                            contact={contact}
                                            isSelected={selectedEmail === contact.email}
                                            isCopied={copiedEmail === contact.email}
                                            onSelect={() => handleSelectEmail(contact.email)}
                                            onCopy={() => handleCopyEmail(contact.email)}
                                            onEdit={() => handleEditContact(contact)}
                                            onDelete={() => { setDeletingContactId(contact.id || null); setShowDeleteConfirm(true); }}
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
                                                onEdit={() => handleEditContact(contact)}
                                                onDelete={() => { setDeletingContactId(contact.id || null); setShowDeleteConfirm(true); }}
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
                                                onEdit={() => handleEditContact(contact)}
                                                onDelete={() => { setDeletingContactId(contact.id || null); setShowDeleteConfirm(true); }}
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

                        {/* Floating View All Button */}
                        {totalCount > 5 && (
                            <div className="sticky bottom-0 p-3 pt-6" style={{ background: 'linear-gradient(to top, white 70%, transparent)' }}>
                                <button
                                    onClick={() => setShowAllContacts(true)}
                                    className="w-full text-sm font-medium py-2.5 rounded-lg transition-all hover:scale-[1.01]"
                                    style={{
                                        background: 'var(--accent-lilac-bg)',
                                        color: 'var(--accent-lilac-text)',
                                        border: '1px solid rgba(139, 92, 246, 0.2)'
                                    }}
                                >
                                    View all contacts ({totalCount})
                                </button>
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

            {/* Edit Contact Modal */}
            {showEditModal && editingContact && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{ background: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(6px)' }}
                >
                    <div className="absolute inset-0" onClick={() => { setShowEditModal(false); setEditingContact(null); }} />
                    <div
                        className="relative z-10 w-full max-w-md bg-white rounded-xl shadow-xl overflow-hidden"
                        style={{ border: '1px solid var(--border-soft)' }}
                    >
                        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-gray-900">Edit Contact</h3>
                            <button
                                onClick={() => { setShowEditModal(false); setEditingContact(null); }}
                                className="p-1.5 rounded-lg hover:bg-gray-100 transition"
                            >
                                <X size={18} className="text-gray-500" />
                            </button>
                        </div>
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                const form = e.target as HTMLFormElement;
                                const formData = new FormData(form);
                                handleSaveEdit({
                                    firstName: formData.get('firstName') as string,
                                    lastName: formData.get('lastName') as string,
                                    email: formData.get('email') as string,
                                    role: formData.get('role') as string
                                });
                            }}
                            className="p-5 space-y-4"
                        >
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1.5">First Name</label>
                                    <input
                                        type="text"
                                        name="firstName"
                                        defaultValue={editingContact.firstName || ''}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none transition"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Last Name</label>
                                    <input
                                        type="text"
                                        name="lastName"
                                        defaultValue={editingContact.lastName || ''}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none transition"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1.5">Email</label>
                                <input
                                    type="email"
                                    name="email"
                                    required
                                    defaultValue={editingContact.email}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none transition"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1.5">Role / Title</label>
                                <input
                                    type="text"
                                    name="role"
                                    defaultValue={editingContact.role || editingContact.roleTitle || ''}
                                    placeholder="e.g. Marketing Director"
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none transition"
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => { setShowEditModal(false); setEditingContact(null); }}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 text-sm font-medium text-white rounded-lg transition"
                                    style={{ background: 'var(--brand)' }}
                                >
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && deletingContactId && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{ background: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(6px)' }}
                >
                    <div className="absolute inset-0" onClick={() => { setShowDeleteConfirm(false); setDeletingContactId(null); }} />
                    <div
                        className="relative z-10 w-full max-w-sm bg-white rounded-xl shadow-xl overflow-hidden"
                        style={{ border: '1px solid var(--border-soft)' }}
                    >
                        <div className="p-5 text-center">
                            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                                <Trash2 size={24} className="text-red-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Contact?</h3>
                            <p className="text-sm text-gray-500 mb-6">
                                This action cannot be undone. The contact will be permanently removed.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => { setShowDeleteConfirm(false); setDeletingContactId(null); }}
                                    className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleDeleteContact(deletingContactId)}
                                    className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* View All Contacts Modal */}
            {showAllContacts && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{ background: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(6px)' }}
                >
                    <div className="absolute inset-0" onClick={() => setShowAllContacts(false)} />
                    <div
                        className="relative z-10 w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                        style={{
                            background: 'var(--bg-card)',
                            borderRadius: '16px',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                            border: '1px solid var(--border-soft)'
                        }}
                    >
                        {/* Modal Header */}
                        <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border-soft)' }}>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                                    All Contacts ({totalCount})
                                </h3>
                                <button
                                    onClick={() => setShowAllContacts(false)}
                                    className="p-1.5 rounded-lg transition-all hover:bg-gray-100"
                                    style={{ color: 'var(--text-muted)' }}
                                >
                                    <X size={18} />
                                </button>
                            </div>
                            {/* Search */}
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by name, email, or role..."
                                className="w-full text-sm px-3 py-2 rounded-lg border outline-none"
                                style={{
                                    borderColor: 'var(--border-soft)',
                                    background: 'var(--bg-card-muted)',
                                    color: 'var(--text-primary)'
                                }}
                            />
                        </div>

                        {/* Contact List */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                            {contacts
                                .filter(c => {
                                    if (!searchQuery) return true;
                                    const q = searchQuery.toLowerCase();
                                    const name = (c.fullName || c.name || `${c.firstName || ''} ${c.lastName || ''}`).toLowerCase();
                                    const role = (c.role || c.roleTitle || '').toLowerCase();
                                    return name.includes(q) || c.email.toLowerCase().includes(q) || role.includes(q);
                                })
                                .map((contact) => {
                                    const displayName = contact.fullName || contact.name || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email.split('@')[0];
                                    const roleDisplay = contact.role || contact.roleTitle || 'Unknown role';
                                    const sourceLabel = contact.source === 'manual' ? 'Manual' : contact.source === 'hunter' ? 'Hunter' : contact.source === 'website' ? 'Website' : '';

                                    return (
                                        <div
                                            key={contact.id || contact.email}
                                            className="flex items-center gap-3 p-3 rounded-lg transition-all hover:bg-gray-50 cursor-pointer"
                                            style={{ background: 'var(--bg-card-muted)' }}
                                            onClick={() => {
                                                handleSelectEmail(contact.email);
                                                setShowAllContacts(false);
                                            }}
                                        >
                                            {/* Avatar */}
                                            <div
                                                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
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
                                                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>• {roleDisplay}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                                                        {contact.email}
                                                    </span>
                                                    {sourceLabel && (
                                                        <span
                                                            className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                                                            style={{
                                                                background: contact.source === 'manual' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                                                                color: contact.source === 'manual' ? 'rgb(5, 150, 105)' : 'rgb(37, 99, 235)'
                                                            }}
                                                        >
                                                            {sourceLabel}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Copy */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleCopyEmail(contact.email);
                                                }}
                                                className="p-1.5 rounded-md transition-all hover:bg-gray-200"
                                                style={{ color: 'var(--text-muted)' }}
                                            >
                                                {copiedEmail === contact.email ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                                            </button>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Contact Row Component - With Edit/Delete Menu
function ContactRow({
    contact,
    isSelected,
    isCopied,
    onSelect,
    onCopy,
    onEdit,
    onDelete
}: {
    contact: Contact;
    isSelected: boolean;
    isCopied: boolean;
    onSelect: () => void;
    onCopy: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
}) {
    const [showMenu, setShowMenu] = useState(false);

    // Build display name: prefer firstName + lastName, fallback to fullName, then name, then email
    const buildDisplayName = () => {
        if (contact.firstName || contact.lastName) {
            return `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
        }
        if (contact.fullName) return contact.fullName;
        if (contact.name) return contact.name;
        // Fallback to email local part with capitalization
        const localPart = contact.email.split('@')[0];
        return localPart.charAt(0).toUpperCase() + localPart.slice(1).replace(/[._-]/g, ' ');
    };
    const displayName = buildDisplayName();
    const roleDisplay = contact.role || contact.roleTitle || '';
    const source = contact.source || (contact.sources?.[0]) || 'unknown';

    return (
        <div
            className={`flex items-center gap-3 p-3 rounded-lg transition-all cursor-pointer ${isSelected ? 'ring-2 ring-purple-400' : ''}`}
            style={{ background: isSelected ? 'rgba(139, 92, 246, 0.08)' : 'var(--bg-card-muted)' }}
            onClick={onSelect}
        >
            {/* Avatar */}
            <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                style={{
                    background: 'linear-gradient(135deg, rgb(139, 92, 246), rgb(59, 130, 246))',
                    color: 'white'
                }}
            >
                {displayName[0]?.toUpperCase() || '?'}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                {/* Line 1: Name + verified badge */}
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {displayName}
                    </span>
                    {contact.verified && <Shield size={12} className="text-green-500 shrink-0" />}
                </div>

                {/* Line 2: Email + Source badge inline */}
                <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                        {contact.email}
                    </span>
                    <SourceBadge source={source} />
                </div>

                {/* Line 3: Role (always shown) */}
                <div className="mt-0.5">
                    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {roleDisplay || 'Unknown role'}
                    </span>
                </div>
            </div>

            {/* Copy Button */}
            <button
                onClick={(e) => { e.stopPropagation(); onCopy(); }}
                className="p-1.5 rounded-md transition-all hover:bg-gray-200 shrink-0"
                style={{ color: 'var(--text-muted)' }}
            >
                {isCopied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
            </button>

            {/* Kebab Menu */}
            {(onEdit || onDelete) && (
                <div className="relative">
                    <button
                        onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                        className="p-1.5 rounded-md transition-all hover:bg-gray-200 shrink-0"
                        style={{ color: 'var(--text-muted)' }}
                    >
                        <MoreVertical size={14} />
                    </button>

                    {showMenu && (
                        <>
                            {/* Backdrop */}
                            <div
                                className="fixed inset-0 z-40"
                                onClick={(e) => { e.stopPropagation(); setShowMenu(false); }}
                            />
                            {/* Dropdown */}
                            <div
                                className="absolute right-0 top-8 z-50 bg-white rounded-lg shadow-lg border py-1 min-w-[120px]"
                                style={{ borderColor: 'var(--border-soft)' }}
                            >
                                {onEdit && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setShowMenu(false); onEdit(); }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 transition"
                                        style={{ color: 'var(--text-primary)' }}
                                    >
                                        <Pencil size={14} /> Edit
                                    </button>
                                )}
                                {onDelete && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setShowMenu(false); onDelete(); }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-red-50 transition text-red-600"
                                    >
                                        <Trash2 size={14} /> Delete
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}
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
