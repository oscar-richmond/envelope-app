
import React, { useState, useEffect, useRef } from 'react';
import { Check, User, Search, Briefcase, Mail, Shield, Building2, Plus, X } from 'lucide-react';

interface Recipient {
    email: string;
    name: string | null;
    role: string | null; // or type
    source: 'CONTACT' | 'WEBSITE' | 'MANUAL';
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    id: string; // unique key
}

interface RecipientPickerProps {
    leadId: number | undefined;
    selectedEmails: string[];
    onSelectionChange: (emails: string[]) => void;
}

export function RecipientPicker({ leadId, selectedEmails, onSelectionChange }: RecipientPickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [recipients, setRecipients] = useState<Recipient[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [manualEmail, setManualEmail] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    // Fetch Recipients on Open
    useEffect(() => {
        if (isOpen && leadId && recipients.length === 0) {
            setLoading(true);
            fetch(`/api/leads/${leadId}/recipients`)
                .then(res => res.json())
                .then(data => {
                    if (data.recipients) setRecipients(data.recipients);
                })
                .catch(console.error)
                .finally(() => setLoading(false));
        }
    }, [isOpen, leadId]);

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

    const toggleRecipient = (email: string) => {
        if (selectedEmails.includes(email)) {
            onSelectionChange(selectedEmails.filter(e => e !== email));
        } else {
            onSelectionChange([...selectedEmails, email]);
        }
    };

    const handleManualAdd = () => {
        if (manualEmail && manualEmail.includes('@')) {
            // Check if already in recipients to assume that object? No, treat as manual.
            if (!selectedEmails.includes(manualEmail)) {
                onSelectionChange([...selectedEmails, manualEmail]);
            }
            setManualEmail('');
        }
    };

    const filtered = recipients.filter(r =>
        r.email.toLowerCase().includes(search.toLowerCase()) ||
        (r.name && r.name.toLowerCase().includes(search.toLowerCase())) ||
        (r.role && r.role.toLowerCase().includes(search.toLowerCase()))
    );

    return (
        <div className="relative" ref={containerRef}>
            {/* Input / Chips Area */}
            <div
                className="min-h-[42px] p-1.5 border border-gray-200 rounded-md bg-white flex flex-wrap items-center gap-2 cursor-text focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-400 transition-all"
                onClick={() => setIsOpen(true)}
            >
                <span className="text-gray-500 text-sm pl-1 select-none">To:</span>

                {selectedEmails.map(email => {
                    const r = recipients.find(x => x.email === email);
                    return (
                        <span key={email} className="inline-flex items-center gap-1 bg-gray-100 border border-gray-200 text-gray-800 px-2 py-0.5 rounded-full text-xs">
                            {r?.name ? <span className="font-medium">{r.name}</span> : null}
                            <span className="text-gray-500">{email}</span>
                            <button
                                onClick={(e) => { e.stopPropagation(); toggleRecipient(email); }}
                                className="hover:bg-gray-200 rounded-full p-0.5 ml-0.5"
                            >
                                <X size={12} />
                            </button>
                        </span>
                    );
                })}

                <input
                    type="text"
                    className="flex-1 min-w-[120px] outline-none text-sm bg-transparent placeholder-gray-400"
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
                                return (
                                    <button
                                        key={r.id}
                                        onClick={() => toggleRecipient(r.email)}
                                        className={`flex items-start gap-3 p-3 text-left border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors
                                            ${isSelected ? 'bg-blue-50/50' : ''}
                                        `}
                                    >
                                        <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0
                                            ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'}
                                        `}>
                                            {isSelected && <Check size={10} className="text-white" />}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                {r.name ? (
                                                    <span className="font-semibold text-sm text-gray-900">{r.name}</span>
                                                ) : (
                                                    <span className="text-sm text-gray-500 italic">General Contact</span>
                                                )}

                                                {r.role && (
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide
                                                        ${['SALES', 'MARKETING'].includes(r.role.toUpperCase()) ? 'bg-green-100 text-green-700' :
                                                            ['SUPPORT', 'BILLING'].includes(r.role.toUpperCase()) ? 'bg-orange-100 text-orange-700' :
                                                                r.source === 'CONTACT' ? 'bg-purple-100 text-purple-700' :
                                                                    'bg-gray-100 text-gray-600'}
                                                    `}>
                                                        {r.role}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-mono text-gray-600">{r.email}</span>
                                                <span className={`text-[10px] font-medium 
                                                    ${r.confidence === 'HIGH' ? 'text-green-600' :
                                                        r.confidence === 'MEDIUM' ? 'text-amber-600' : 'text-gray-400'}
                                                `}>
                                                    {r.confidence}
                                                </span>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {!loading && filtered.length === 0 && !search.includes('@') && (
                        <div className="p-4 text-center">
                            <p className="text-gray-400 text-xs mb-2">No recipients found.</p>
                            {/* In future: Trigger Discovery from here */}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

