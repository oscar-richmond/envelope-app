'use client';

import { useState } from 'react';
import { MessageSquare, PenLine, X } from 'lucide-react';
import { MessageThreadComposerModal } from '@/components/messaging/MessageThreadComposerModal';

interface EmbeddedComposerProps {
    leadId: number;
    companyName: string;
    contacts: Array<{
        id?: number;
        firstName?: string | null;
        lastName?: string | null;
        email: string;
        title?: string | null;
    }>;
    existingEmailId?: number | null;
}

export default function EmbeddedComposer({
    leadId,
    companyName,
    contacts,
    existingEmailId
}: EmbeddedComposerProps) {
    const [isComposerOpen, setIsComposerOpen] = useState(false);

    // Get primary contact (first one with an email)
    const primaryContact = contacts.find(c => c.email);
    const contactName = primaryContact
        ? `${primaryContact.firstName || ''} ${primaryContact.lastName || ''}`.trim() || primaryContact.email.split('@')[0]
        : 'Contact';
    const contactEmail = primaryContact?.email || '';

    const hasThread = !!existingEmailId;

    return (
        <div
            className="rounded-xl border bg-white shadow-sm"
            style={{ borderColor: 'var(--border-soft)' }}
        >
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-indigo-50">
                        <MessageSquare size={16} className="text-indigo-600" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900">Outreach</h3>
                        <p className="text-xs text-gray-500">
                            {hasThread ? 'Active conversation' : 'Ready to compose'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-5">
                {contacts.length === 0 ? (
                    /* No contacts state */
                    <div className="text-center py-8">
                        <div className="w-12 h-12 mx-auto rounded-full bg-gray-100 flex items-center justify-center mb-3">
                            <MessageSquare size={20} className="text-gray-400" />
                        </div>
                        <p className="text-sm text-gray-600 font-medium">No contacts found</p>
                        <p className="text-xs text-gray-400 mt-1">Add contacts to compose outreach</p>
                    </div>
                ) : (
                    /* Has contacts - show compose button */
                    <div className="space-y-4">
                        {/* Contact Preview */}
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                            <div
                                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold"
                                style={{
                                    background: 'linear-gradient(135deg, rgb(139, 92, 246), rgb(59, 130, 246))',
                                    color: 'white'
                                }}
                            >
                                {contactName[0]?.toUpperCase() || '?'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{contactName}</p>
                                <p className="text-xs text-gray-500 truncate">{contactEmail}</p>
                            </div>
                            {contacts.length > 1 && (
                                <span className="text-xs text-gray-400">+{contacts.length - 1} more</span>
                            )}
                        </div>

                        {/* Compose Button */}
                        <button
                            onClick={() => setIsComposerOpen(true)}
                            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-medium transition-all"
                            style={{
                                background: 'var(--accent-primary)',
                                color: 'white'
                            }}
                        >
                            <PenLine size={16} />
                            {hasThread ? 'View Thread & Compose' : 'Compose Outreach'}
                        </button>
                    </div>
                )}
            </div>

            {/* Composer Modal */}
            {isComposerOpen && (
                <MessageThreadComposerModal
                    leadId={leadId}
                    emailId={existingEmailId || undefined}
                    initialData={{
                        companyName,
                        contactName,
                        contactEmail,
                    }}
                    defaultTab={hasThread ? 'thread' : 'compose'}
                    onClose={() => setIsComposerOpen(false)}
                    onSuccess={() => {
                        setIsComposerOpen(false);
                        // Optionally refresh the page
                    }}
                />
            )}
        </div>
    );
}
