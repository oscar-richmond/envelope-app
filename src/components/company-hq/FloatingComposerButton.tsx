'use client';

import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { MessageThreadComposerModal } from '@/components/messaging/MessageThreadComposerModal';

interface FloatingComposerButtonProps {
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

export default function FloatingComposerButton({
    leadId,
    companyName,
    contacts,
    existingEmailId
}: FloatingComposerButtonProps) {
    const [isOpen, setIsOpen] = useState(false);

    const primaryContact = contacts.find(c => c.email);
    const contactName = primaryContact
        ? `${primaryContact.firstName || ''} ${primaryContact.lastName || ''}`.trim() || primaryContact.email.split('@')[0]
        : '';
    const contactEmail = primaryContact?.email || '';

    return (
        <>
            {/* Floating Button */}
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-5 py-3 rounded-full shadow-lg transition-all hover:scale-105 hover:shadow-xl"
                style={{
                    background: 'linear-gradient(135deg, rgb(99, 102, 241), rgb(79, 70, 229))',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '14px'
                }}
                title="Open outreach composer"
            >
                <MessageSquare size={18} />
                Contact {companyName.length > 20 ? companyName.slice(0, 20) + '...' : companyName}
            </button>

            {/* Composer Modal */}
            {isOpen && (
                <MessageThreadComposerModal
                    leadId={leadId}
                    emailId={existingEmailId || undefined}
                    initialData={{
                        companyName,
                        contactName,
                        contactEmail,
                    }}
                    defaultTab={existingEmailId ? 'thread' : 'compose'}
                    onClose={() => setIsOpen(false)}
                    onSuccess={() => setIsOpen(false)}
                />
            )}
        </>
    );
}
