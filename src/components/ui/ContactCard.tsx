'use client';

/**
 * Phase 5: Contact Card Component
 * Shows contact with verification status, role, and actions
 */

import React from 'react';
import { VerificationBadge, BestContactBadge } from './VerificationBadge';

interface Contact {
    id: string;
    email: string;
    name?: string | null;
    role?: string | null;
    verificationStatus?: 'valid' | 'invalid' | 'risky' | 'unknown' | 'pending';
    isCatchAll?: boolean;
    isRoleAccount?: boolean;
    isBestContact?: boolean;
    score?: number;
}

interface ContactCardProps {
    contact: Contact;
    onVerify?: (email: string) => void;
    onCompose?: (email: string) => void;
    onSelect?: (id: string, selected: boolean) => void;
    selected?: boolean;
    showActions?: boolean;
    compact?: boolean;
}

export function ContactCard({
    contact,
    onVerify,
    onCompose,
    onSelect,
    selected = false,
    showActions = true,
    compact = false,
}: ContactCardProps) {
    const isInvalid = contact.verificationStatus === 'invalid';

    if (compact) {
        return (
            <div className={`flex items-center gap-3 p-2 rounded-lg ${isInvalid ? 'opacity-50' : ''}`}>
                {onSelect && (
                    <input
                        type="checkbox"
                        checked={selected}
                        disabled={isInvalid}
                        onChange={(e) => onSelect(contact.id, e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300"
                    />
                )}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900 truncate">
                            {contact.name || contact.email}
                        </span>
                        {contact.isBestContact && <BestContactBadge />}
                    </div>
                    {contact.role && (
                        <span className="text-xs text-slate-500">{contact.role}</span>
                    )}
                </div>
                <VerificationBadge
                    status={contact.verificationStatus || 'pending'}
                    isCatchAll={contact.isCatchAll}
                    showLabel={false}
                />
            </div>
        );
    }

    return (
        <div className={`border rounded-xl p-4 ${isInvalid ? 'opacity-50 bg-red-50 border-red-200' : 'bg-white border-slate-200'} ${contact.isBestContact ? 'ring-2 ring-amber-400 ring-offset-2' : ''}`}>
            <div className="flex items-start gap-3">
                {onSelect && (
                    <input
                        type="checkbox"
                        checked={selected}
                        disabled={isInvalid}
                        onChange={(e) => onSelect(contact.id, e.target.checked)}
                        className="w-5 h-5 mt-1 rounded border-slate-300"
                    />
                )}

                <div className="flex-1 min-w-0">
                    {/* Name + Best Badge */}
                    <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-slate-900">
                            {contact.name || 'Unknown'}
                        </span>
                        {contact.isBestContact && <BestContactBadge />}
                    </div>

                    {/* Role */}
                    {contact.role && (
                        <div className="text-sm text-slate-600 mb-2">{contact.role}</div>
                    )}

                    {/* Email + Verification */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-slate-700 font-mono">{contact.email}</span>
                        <VerificationBadge
                            status={contact.verificationStatus || 'pending'}
                            isCatchAll={contact.isCatchAll}
                            isRoleAccount={contact.isRoleAccount}
                        />
                    </div>

                    {/* Warning for invalid */}
                    {isInvalid && (
                        <div className="text-xs text-red-600 mt-2">
                            ⚠️ This email may not be deliverable
                        </div>
                    )}
                </div>

                {/* Actions */}
                {showActions && (
                    <div className="flex gap-2">
                        {contact.verificationStatus === 'pending' && onVerify && (
                            <button
                                onClick={() => onVerify(contact.email)}
                                className="px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                            >
                                Verify
                            </button>
                        )}
                        {contact.verificationStatus === 'valid' && onCompose && (
                            <button
                                onClick={() => onCompose(contact.email)}
                                className="px-3 py-1.5 text-xs font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                            >
                                Compose
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// Contact list with sorting by score
export function ContactList({
    contacts,
    onVerify,
    onCompose,
    onSelect,
    selectedIds = [],
}: {
    contacts: Contact[];
    onVerify?: (email: string) => void;
    onCompose?: (email: string) => void;
    onSelect?: (id: string, selected: boolean) => void;
    selectedIds?: string[];
}) {
    // Sort by score desc, best contact first
    const sorted = [...contacts].sort((a, b) => {
        if (a.isBestContact) return -1;
        if (b.isBestContact) return 1;
        return (b.score || 0) - (a.score || 0);
    });

    return (
        <div className="space-y-3">
            {sorted.map((contact) => (
                <ContactCard
                    key={contact.id}
                    contact={contact}
                    onVerify={onVerify}
                    onCompose={onCompose}
                    onSelect={onSelect}
                    selected={selectedIds.includes(contact.id)}
                />
            ))}
        </div>
    );
}
