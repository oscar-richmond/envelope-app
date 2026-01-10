'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Loader2, AlertTriangle, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface AddLeadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (lead: any) => void;
}

export default function AddLeadModal({ isOpen, onClose, onSuccess }: AddLeadModalProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [duplicateError, setDuplicateError] = useState<any>(null);

    // Form State
    const [company, setCompany] = useState({
        name: '',
        websiteUrl: '',
        industry: '',
        location: '',
        notes: '' // UI only for now, as DB doesn't support it yet
    });

    const [contacts, setContacts] = useState<any[]>([
        { firstName: '', lastName: '', title: '', email: '' }
    ]);

    // Reset when opening
    useEffect(() => {
        if (isOpen) {
            setCompany({ name: '', websiteUrl: '', industry: '', location: '', notes: '' });
            setContacts([{ firstName: '', lastName: '', title: '', email: '' }]);
            setDuplicateError(null);
            setIsLoading(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleAddContact = () => {
        if (contacts.length >= 3) return;
        setContacts([...contacts, { firstName: '', lastName: '', title: '', email: '' }]);
    };

    const handleRemoveContact = (index: number) => {
        setContacts(contacts.filter((_, i) => i !== index));
    };

    const handleContactChange = (index: number, field: string, value: string) => {
        const newContacts = [...contacts];
        newContacts[index] = { ...newContacts[index], [field]: value };
        setContacts(newContacts);
    };

    const handleSubmit = async (force = false) => {
        if (!company.name) {
            alert('Company Name is required');
            return;
        }

        setIsLoading(true);
        setDuplicateError(null);

        try {
            // Filter empty contacts
            const validContacts = contacts.filter(c => c.firstName || c.email);

            const res = await fetch('/api/leads/manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    company,
                    contacts: validContacts,
                    force
                })
            });

            const data = await res.json();

            if (res.status === 409) {
                // Duplicate
                setDuplicateError(data);
                setIsLoading(false);
                return;
            }

            if (!res.ok) {
                throw new Error(data.error || 'Failed to create lead');
            }

            // Success
            onSuccess(data);
            onClose();

        } catch (e: any) {
            console.error(e);
            alert(e.message);
        } finally {
            if (!duplicateError) setIsLoading(false);
        }
    };

    const handleOpenExisting = () => {
        if (duplicateError?.existingLead?.id) {
            router.push(`/leads/${duplicateError.existingLead.id}`);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
                    <h2 className="text-lg font-bold text-gray-900">Add Lead Manually</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full text-gray-400 hover:text-gray-600 transition">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* Duplicate Warning */}
                    {duplicateError && (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex gap-4">
                            <div className="p-2 bg-amber-100 rounded-full h-fit text-amber-600 shrink-0">
                                <AlertTriangle size={20} />
                            </div>
                            <div className="flex-1">
                                <h4 className="text-amber-800 font-bold text-sm">Duplicate Detected</h4>
                                <p className="text-amber-700 text-sm mt-1">
                                    A lead with this {duplicateError.matchType?.toLowerCase()} already exists:
                                    <span className="font-semibold ml-1">{duplicateError.existingLead.companyName}</span>
                                </p>
                                <div className="mt-3 flex gap-3">
                                    <button
                                        onClick={handleOpenExisting}
                                        className="btn bg-white border border-amber-300 text-amber-800 hover:bg-amber-50 text-xs px-3 py-1.5 h-auto flex items-center gap-1"
                                    >
                                        <ExternalLink size={14} /> Open Existing
                                    </button>
                                    <button
                                        onClick={() => handleSubmit(true)}
                                        className="btn bg-amber-600 border-transparent text-white hover:bg-amber-700 text-xs px-3 py-1.5 h-auto"
                                    >
                                        Create Duplicate Anyway
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Company Section */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Company Details</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="col-span-2 md:col-span-1">
                                <label className="label">Company Name <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    className="input w-full"
                                    placeholder="e.g. Acme Corp"
                                    value={company.name}
                                    onChange={e => setCompany({ ...company, name: e.target.value })}
                                    autoFocus
                                />
                            </div>
                            <div className="col-span-2 md:col-span-1">
                                <label className="label">Website URL</label>
                                <input
                                    type="url"
                                    className="input w-full"
                                    placeholder="https://example.com"
                                    value={company.websiteUrl}
                                    onChange={e => setCompany({ ...company, websiteUrl: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="label">Industry</label>
                                <input
                                    type="text"
                                    className="input w-full"
                                    placeholder="e.g. SaaS"
                                    value={company.industry}
                                    onChange={e => setCompany({ ...company, industry: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="label">Location</label>
                                <input
                                    type="text"
                                    className="input w-full"
                                    placeholder="e.g. London"
                                    value={company.location}
                                    onChange={e => setCompany({ ...company, location: e.target.value })}
                                />
                            </div>
                            <div className="col-span-2">
                                <label className="label">Notes (Internal)</label>
                                <textarea
                                    className="input w-full min-h-[60px]"
                                    placeholder="Any context about this lead..."
                                    value={company.notes}
                                    onChange={e => setCompany({ ...company, notes: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Divider */}
                    <hr className="border-gray-100" />

                    {/* Contacts Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Initial Contacts</h3>
                            <button
                                onClick={handleAddContact}
                                disabled={contacts.length >= 3}
                                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Plus size={14} /> Add Another
                            </button>
                        </div>

                        <div className="space-y-3">
                            {contacts.map((contact, idx) => (
                                <div key={idx} className="flex gap-3 items-start animate-in slide-in-from-top-2 duration-200">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1">
                                        <input
                                            placeholder="First Name"
                                            className="input text-sm py-2 px-3"
                                            value={contact.firstName}
                                            onChange={e => handleContactChange(idx, 'firstName', e.target.value)}
                                        />
                                        <input
                                            placeholder="Last Name"
                                            className="input text-sm py-2 px-3"
                                            value={contact.lastName}
                                            onChange={e => handleContactChange(idx, 'lastName', e.target.value)}
                                        />
                                        <input
                                            placeholder="Title"
                                            className="input text-sm py-2 px-3"
                                            value={contact.title}
                                            onChange={e => handleContactChange(idx, 'title', e.target.value)}
                                        />
                                        <input
                                            placeholder="Email"
                                            className="input text-sm py-2 px-3"
                                            value={contact.email}
                                            onChange={e => handleContactChange(idx, 'email', e.target.value)}
                                        />
                                    </div>
                                    {contacts.length > 1 && (
                                        <button
                                            onClick={() => handleRemoveContact(idx)}
                                            className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded"
                                            title="Remove contact"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="btn btn-ghost"
                        disabled={isLoading}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => handleSubmit(false)}
                        disabled={isLoading}
                        className="btn btn-primary min-w-[120px]"
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={18} /> : 'Create Lead'}
                    </button>
                </div>
            </div>
        </div>
    );
}
