'use client';

import { useState, useEffect, useRef } from 'react';
import { Check, User, Search, Briefcase, Mail, Shield, Building2, Plus, X, Pencil, Loader2 } from 'lucide-react';

interface Recipient {
    email: string;
    name: string | null;
    role: string | null; // or type
    source: 'CONTACT' | 'WEBSITE' | 'MANUAL';
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    sendabilityStatus?: 'GOOD' | 'CAUTION' | 'HIGH_RISK';
    id: string; // unique key e.g. "web-123"
}

interface RecipientPickerProps {
    leadId?: number;
    companyId?: number; // Preferred - fetches from /api/companies/{id}/contacts
    selectedEmails: string[];
    onSelectionChange: (emails: string[]) => void;
    onRiskChange?: (hasHighRisk: boolean) => void;
}

export function RecipientPicker({ leadId, companyId, selectedEmails, onSelectionChange, onRiskChange }: RecipientPickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [recipients, setRecipients] = useState<Recipient[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [manualEmail, setManualEmail] = useState('');

    // Edit State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editRole, setEditRole] = useState('');
    const [isSavingRole, setIsSavingRole] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);

    // Local cache for verification status
    const [verificationMap, setVerificationMap] = useState<Record<string, string>>({});
    const [verifying, setVerifying] = useState<Record<string, boolean>>({});

    // Fetch Recipients on Mount or ID Change (prefer companyId)
    useEffect(() => {
        if (companyId) {
            fetchFromCompany(companyId);
        } else if (leadId) {
            fetchFromLead(leadId);
        }
    }, [companyId, leadId]);

    // Fetch from company contacts API (preferred)
    const fetchFromCompany = (id: number) => {
        setLoading(true);
        console.log(`[RecipientPicker] Fetching from /api/companies/${id}/contacts`);
        fetch(`/api/companies/${id}/contacts`)
            .then(res => res.json())
            .then(data => {
                if (data.contacts) {
                    console.log(`[RecipientPicker] Got ${data.contacts.length} contacts from company API`);
                    // Map to Recipient format
                    const mapped: Recipient[] = data.contacts.map((c: any) => ({
                        email: c.email,
                        name: c.fullName || c.firstName || null,
                        role: c.role || c.roleTitle || 'Unknown role',
                        source: c.isManual ? 'MANUAL' : (c.source === 'website' ? 'WEBSITE' : 'CONTACT'),
                        confidence: c.confidence > 0.7 ? 'HIGH' : c.confidence > 0.4 ? 'MEDIUM' : 'LOW',
                        sendabilityStatus: c.verified ? 'GOOD' : undefined,
                        id: c.id || `company-${id}-${c.email}`
                    }));
                    setRecipients(mapped);

                    // Pre-populate verification map
                    const map: Record<string, string> = {};
                    mapped.forEach((r: Recipient) => {
                        if (r.sendabilityStatus) map[r.email] = r.sendabilityStatus;
                    });
                    setVerificationMap(prev => ({ ...prev, ...map }));
                }
            })
            .catch(e => {
                console.error('[RecipientPicker] Error fetching from company:', e);
            })
            .finally(() => setLoading(false));
    };

    // Fallback: fetch from leads API (legacy)
    const fetchFromLead = (id: number) => {
        setLoading(true);
        console.log(`[RecipientPicker] Fetching from /api/leads/${id}/recipients (legacy)`);
        fetch(`/api/leads/${id}/recipients`)
            .then(res => res.json())
            .then(data => {
                if (data.recipients) {
                    console.log(`[RecipientPicker] Got ${data.recipients.length} recipients from lead API`);
                    setRecipients(data.recipients);
                    const map: Record<string, string> = {};
                    data.recipients.forEach((r: Recipient) => {
                        if (r.sendabilityStatus) map[r.email] = r.sendabilityStatus;
                    });
                    setVerificationMap(prev => ({ ...prev, ...map }));
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    // ... (Outside Click & Verification Effect same as before)
    // Outside Click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Verification Effect
    useEffect(() => {
        // Find selected emails that are missing verification
        selectedEmails.forEach(email => {
            if (!verificationMap[email] && !verifying[email]) {
                verifyEmail(email);
            }
        });

        // Notify parent of risk
        if (onRiskChange) {
            const hasRisk = selectedEmails.some(e => verificationMap[e] === 'HIGH_RISK');
            onRiskChange(hasRisk);
        }

    }, [selectedEmails, verificationMap]);

    const verifyEmail = async (email: string) => {
        setVerifying(prev => ({ ...prev, [email]: true }));
        try {
            const res = await fetch('/api/email/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await res.json();
            if (data.sendabilityStatus) {
                setVerificationMap(prev => ({ ...prev, [email]: data.sendabilityStatus }));
            }
        } catch (e) { console.error(e); }
        finally {
            setVerifying(prev => ({ ...prev, [email]: false }));
        }
    };

    const toggleRecipient = (email: string) => {
        if (selectedEmails.includes(email)) {
            onSelectionChange(selectedEmails.filter(e => e !== email));
        } else {
            onSelectionChange([...selectedEmails, email]);
        }
    };

    const handleManualAdd = () => {
        if (manualEmail && manualEmail.includes('@')) {
            if (!selectedEmails.includes(manualEmail)) {
                onSelectionChange([...selectedEmails, manualEmail]);
            }
            setManualEmail('');
        }
    };

    const startEditing = (e: React.MouseEvent, r: Recipient) => {
        e.stopPropagation(); // Don't toggle selection
        setEditingId(r.id);
        setEditName(r.name || '');
        setEditRole(r.role || '');
    };

    const saveRole = async (e: React.MouseEvent, r: Recipient) => {
        e.stopPropagation();
        if (!editName && !editRole) {
            setEditingId(null);
            return;
        }

        setIsSavingRole(true);
        try {
            // Check if it's a web/discovered email which we can update
            if (r.id.startsWith('web-')) {
                const dbId = r.id.replace('web-', '');
                const res = await fetch(`/api/email/${dbId}/update`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: editName, roleTitle: editRole })
                });

                if (res.ok) {
                    // Optimistic update locally
                    setRecipients(prev => prev.map(item =>
                        item.id === r.id ? { ...item, name: editName, role: editRole, source: 'MANUAL', confidence: 'HIGH' } : item
                    ));
                }
            } else {
                alert("Can currently only edit discovered emails, not synced contacts.");
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsSavingRole(false);
            setEditingId(null);
        }
    };

    const filtered = recipients.filter(r => {
        if (!r) return false;
        const s = search.toLowerCase();
        return (r.email && r.email.toLowerCase().includes(s)) ||
            (r.name && r.name.toLowerCase().includes(s)) ||
            (r.role && r.role.toLowerCase().includes(s));
    });

    // Helper to render badge
    const renderBadge = (email: string) => {
        const status = verificationMap[email];
        const isVerifying = verifying[email];

        if (isVerifying) return <span className="text-[10px] text-gray-400 animate-pulse">Verifying...</span>;
        if (!status) return null;

        if (status === 'GOOD') {
            return <div className="w-2 h-2 rounded-full bg-green-500" title="Verified: Good to send" />;
        }
        if (status === 'CAUTION') {
            return <span className="text-[10px] px-1 py-0.5 bg-amber-100 text-amber-700 rounded font-bold" title="Caution: Generic role or check failed">Caution</span>;
        }
        if (status === 'HIGH_RISK') {
            return <span className="text-[10px] px-1 py-0.5 bg-red-100 text-red-700 rounded font-bold" title="High Risk: Invalid or Role-based">High Risk</span>;
        }
        return null;
    };


    return (
        <div className="relative" ref={containerRef}>
            {/* Input / Chips Area */}
            <div
                className="min-h-[42px] p-1.5 border border-gray-200 rounded-md bg-white flex flex-wrap items-center gap-2 cursor-text focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-400 transition-all"
                onClick={() => setIsOpen(true)}
            >
                <div className="flex items-center gap-1 select-none">
                    <span className="text-gray-500 text-sm pl-1">To:</span>
                    {selectedEmails.map(email => {
                        // Find data for this email (Safe navigation)
                        const rec = recipients.find(r => r?.email === email);
                        const status = verificationMap[email];
                        const isRisk = status === 'HIGH_RISK';

                        // Show Name if available, otherwise Email. Append Role if Name exists.
                        const label = rec?.name
                            ? `${rec.name}${rec.role ? ` • ${rec.role}` : ''}`
                            : email;

                        return (
                            <span key={email} className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs border max-w-[200px]
                                ${isRisk ? 'bg-red-50 border-red-200 text-red-800' : 'bg-gray-100 border-gray-200 text-gray-800'}`}>
                                {renderBadge(email)}
                                <span className={`truncate ${isRisk ? 'line-through opacity-70' : ''}`} title={email}>{label}</span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); toggleRecipient(email); }}
                                    className="hover:bg-black/10 rounded-full p-0.5 ml-0.5 shrink-0"
                                >
                                    <X size={12} />
                                </button>
                            </span>
                        );
                    })}
                </div>

                <input
                    type="text"
                    className="flex-1 min-w-[120px] outline-none text-sm bg-transparent placeholder-gray-400 ml-1"
                    placeholder={selectedEmails.length === 0 ? "Select recipients..." : ""}
                    value={manualEmail}
                    onChange={e => {
                        setManualEmail(e.target.value);
                        setSearch(e.target.value);
                        setIsOpen(true);
                    }}
                    onKeyDown={e => {
                        if (e.key === 'Enter' && manualEmail) {
                            e.preventDefault();
                            handleManualAdd();
                        }
                        if (e.key === 'Backspace' && !manualEmail && selectedEmails.length > 0) {
                            onSelectionChange(selectedEmails.slice(0, -1));
                        }
                    }}
                    onFocus={() => setIsOpen(true)}
                />
            </div>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-[300px] overflow-y-auto flex flex-col">
                    {loading && (
                        <div className="p-4 text-center text-gray-400 text-xs">Loading recipients...</div>
                    )}

                    {!loading && filtered.length === 0 && search.includes('@') && (
                        <button
                            className="p-3 text-left hover:bg-blue-50 text-blue-600 text-sm font-medium border-b border-gray-50"
                            onClick={handleManualAdd}
                        >
                            Use "{manualEmail}"
                        </button>
                    )}

                    {!loading && filtered.length > 0 && (
                        <div className="flex flex-col">
                            {filtered.map(r => {
                                const isSelected = selectedEmails.includes(r.email);
                                const status = verificationMap[r.email] || r.sendabilityStatus;
                                const isEditing = editingId === r.id;

                                return (
                                    <div
                                        key={r.id}
                                        className={`flex items-start gap-3 p-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors group relative
                                            ${isSelected ? 'bg-blue-50/50' : ''}
                                        `}
                                        onClick={() => !isEditing && toggleRecipient(r.email)}
                                    >
                                        <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer
                                            ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'}
                                        `}>
                                            {isSelected && <Check size={10} className="text-white" />}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            {isEditing ? (
                                                <div className="flex flex-col gap-2 mb-1" onClick={e => e.stopPropagation()}>
                                                    <input
                                                        className="text-sm border rounded px-2 py-1 w-full"
                                                        placeholder="Name (e.g. John Doe)"
                                                        value={editName}
                                                        onChange={e => setEditName(e.target.value)}
                                                        autoFocus
                                                    />
                                                    <div className="flex gap-2">
                                                        <input
                                                            className="text-xs border rounded px-2 py-1 w-2/3"
                                                            placeholder="Role (e.g. CEO)"
                                                            value={editRole}
                                                            onChange={e => setEditRole(e.target.value)}
                                                        />
                                                        <button
                                                            className="bg-blue-600 text-white text-xs px-3 py-1 rounded"
                                                            disabled={isSavingRole}
                                                            onClick={(e) => saveRole(e, r)}
                                                        >
                                                            {isSavingRole ? <Loader2 size={12} className="animate-spin" /> : 'Save'}
                                                        </button>
                                                        <button
                                                            className="text-gray-500 text-xs px-2"
                                                            onClick={(e) => { e.stopPropagation(); setEditingId(null); }}
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        {r.name ? (
                                                            <span className="font-semibold text-sm text-gray-900">{r.name}</span>
                                                        ) : (
                                                            <span className="text-sm text-gray-400 italic">Name unknown</span>
                                                        )}

                                                        {r.role ? (
                                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide
                                                                ${['SALES', 'MARKETING'].includes(r.role?.toUpperCase() || '') ? 'bg-green-100 text-green-700' :
                                                                    ['SUPPORT', 'BILLING'].includes(r.role?.toUpperCase() || '') ? 'bg-orange-100 text-orange-700' :
                                                                        r.role === 'BUSINESS' ? 'bg-blue-100 text-blue-700' :
                                                                            r.source === 'CONTACT' ? 'bg-purple-100 text-purple-700' :
                                                                                'bg-gray-100 text-gray-600'}
                                                            `}>
                                                                {r.role}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] text-gray-300 uppercase font-medium">No Role</span>
                                                        )}

                                                        {/* Edit Button (Only visible on hover, only for website leads) */}
                                                        {r.source === 'WEBSITE' && (
                                                            <button
                                                                onClick={(e) => startEditing(e, r)}
                                                                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600 transition-opacity p-0.5"
                                                                title="Edit Name/Role"
                                                            >
                                                                <Pencil size={12} />
                                                            </button>
                                                        )}

                                                        {/* In Dropdown Status */}
                                                        {(status === 'HIGH_RISK') && <span className="text-[10px] bg-red-100 text-red-600 px-1 rounded font-bold ml-auto">Risk</span>}
                                                        {(status === 'GOOD') && <span className="w-1.5 h-1.5 bg-green-500 rounded-full ml-auto"></span>}
                                                    </div>

                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-mono text-gray-600">{r.email}</span>
                                                        <span className={`text-[10px] font-medium
                                                            ${r.confidence === 'HIGH' ? 'text-green-600' :
                                                                r.confidence === 'MEDIUM' ? 'text-amber-600' : 'text-gray-400'}
                                                        `}>
                                                            {r.confidence} Conf.
                                                        </span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {!loading && filtered.length === 0 && !search.includes('@') && (
                        <div className="p-4 text-center">
                            <p className="text-gray-400 text-xs mb-2">No recipients found.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
