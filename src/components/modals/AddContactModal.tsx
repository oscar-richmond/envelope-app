'use client';

import { useState } from 'react';
import { X, Loader2, AlertCircle, UserPlus } from 'lucide-react';

interface AddContactModalProps {
    isOpen: boolean;
    companyId: number;
    companyName?: string;
    onClose: () => void;
    onSuccess: (contact: any) => void;
}

export default function AddContactModal({
    isOpen,
    companyId,
    companyName,
    onClose,
    onSuccess
}: AddContactModalProps) {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [roleTitle, setRoleTitle] = useState('');
    const [email, setEmail] = useState('');

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    if (!isOpen) return null;

    // Validate form
    const validate = (): boolean => {
        const errors: Record<string, string> = {};

        if (!firstName.trim()) errors.firstName = 'First name is required';
        if (!lastName.trim()) errors.lastName = 'Last name is required';
        if (!email.trim()) {
            errors.email = 'Email is required';
        } else {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email.trim())) {
                errors.email = 'Invalid email format';
            }
        }

        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // Handle submit
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) return;

        setSaving(true);
        setError(null);

        console.log(`[AddContactModal] Creating contact for company ${companyId}:`, { firstName, lastName, email });

        try {
            const res = await fetch(`/api/companies/${companyId}/contacts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    firstName: firstName.trim(),
                    lastName: lastName.trim(),
                    roleTitle: roleTitle.trim(),
                    email: email.trim()
                })
            });

            const data = await res.json();
            console.log(`[AddContactModal] Response:`, res.status, data);

            if (res.status === 409 && data.duplicate) {
                setError(data.error || 'This email already exists for this company');
                setSaving(false);
                return;
            }

            if (!res.ok) {
                setError(data.error || 'Failed to add contact');
                setSaving(false);
                return;
            }

            // Success!
            console.log(`[AddContactModal] Contact created successfully`);
            onSuccess(data.contact);

            // Reset form
            setFirstName('');
            setLastName('');
            setRoleTitle('');
            setEmail('');
            setFieldErrors({});
            setError(null);

            onClose();

        } catch (e: any) {
            console.error('[AddContactModal] Error:', e);
            setError(e.message || 'Failed to add contact');
            setSaving(false);
        }
    };

    // Handle close
    const handleClose = () => {
        if (!saving) {
            setFirstName('');
            setLastName('');
            setRoleTitle('');
            setEmail('');
            setFieldErrors({});
            setError(null);
            onClose();
        }
    };

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center"
            onClick={handleClose}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

            {/* Modal */}
            <div
                className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    className="px-6 py-4 flex items-center justify-between border-b"
                    style={{ background: 'var(--accent-lilac-bg)', borderColor: 'var(--border-soft)' }}
                >
                    <div className="flex items-center gap-2">
                        <UserPlus size={20} style={{ color: 'var(--accent-lilac-text)' }} />
                        <h2 className="text-lg font-semibold" style={{ color: 'var(--accent-lilac-text)' }}>
                            Add Contact
                        </h2>
                    </div>
                    <button
                        onClick={handleClose}
                        disabled={saving}
                        className="p-1.5 rounded-lg hover:bg-black/5 transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {companyName && (
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                            Adding contact to <strong>{companyName}</strong>
                        </p>
                    )}

                    {/* Error Banner */}
                    {error && (
                        <div
                            className="flex items-center gap-2 p-3 rounded-lg text-sm"
                            style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'rgb(185, 28, 28)' }}
                        >
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    {/* First Name */}
                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                            First Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={firstName}
                            onChange={e => setFirstName(e.target.value)}
                            disabled={saving}
                            placeholder="Jane"
                            className="w-full px-3 py-2 rounded-lg border text-sm transition-all focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                            style={{
                                borderColor: fieldErrors.firstName ? 'rgb(239, 68, 68)' : 'var(--border-soft)',
                                background: 'var(--bg-input)'
                            }}
                        />
                        {fieldErrors.firstName && (
                            <p className="text-xs text-red-500 mt-1">{fieldErrors.firstName}</p>
                        )}
                    </div>

                    {/* Last Name */}
                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                            Last Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={lastName}
                            onChange={e => setLastName(e.target.value)}
                            disabled={saving}
                            placeholder="Doe"
                            className="w-full px-3 py-2 rounded-lg border text-sm transition-all focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                            style={{
                                borderColor: fieldErrors.lastName ? 'rgb(239, 68, 68)' : 'var(--border-soft)',
                                background: 'var(--bg-input)'
                            }}
                        />
                        {fieldErrors.lastName && (
                            <p className="text-xs text-red-500 mt-1">{fieldErrors.lastName}</p>
                        )}
                    </div>

                    {/* Role */}
                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                            Role / Title
                        </label>
                        <input
                            type="text"
                            value={roleTitle}
                            onChange={e => setRoleTitle(e.target.value)}
                            disabled={saving}
                            placeholder="Marketing Director"
                            className="w-full px-3 py-2 rounded-lg border text-sm transition-all focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                            style={{ borderColor: 'var(--border-soft)', background: 'var(--bg-input)' }}
                        />
                    </div>

                    {/* Email */}
                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                            Email <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            disabled={saving}
                            placeholder="jane@company.com"
                            className="w-full px-3 py-2 rounded-lg border text-sm transition-all focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                            style={{
                                borderColor: fieldErrors.email ? 'rgb(239, 68, 68)' : 'var(--border-soft)',
                                background: 'var(--bg-input)'
                            }}
                        />
                        {fieldErrors.email && (
                            <p className="text-xs text-red-500 mt-1">{fieldErrors.email}</p>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={saving}
                            className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-all"
                            style={{
                                background: 'var(--bg-card-muted)',
                                color: 'var(--text-secondary)'
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2"
                            style={{
                                background: saving ? 'var(--brand-soft)' : 'var(--brand)',
                                color: 'white',
                                cursor: saving ? 'wait' : 'pointer'
                            }}
                        >
                            {saving ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                'Add Contact'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
