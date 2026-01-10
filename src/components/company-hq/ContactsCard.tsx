'use client';

import { useState } from 'react';
import { hqStyles } from './SharedStyles';
import { Users, Search, RefreshCw, UserCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Contact {
    id: number;
    firstName: string | null;
    lastName: string | null;
    title: string | null;
    email: string | null;
    confidence: number;
}

interface ContactsCardProps {
    leadId: number;
    contacts: Contact[];
}

export default function ContactsCard({ leadId, contacts }: ContactsCardProps) {
    const router = useRouter();
    const [finding, setFinding] = useState(false);

    const handleFindContacts = async () => {
        setFinding(true);
        try {
            await fetch(`/api/company/${leadId}/contacts`, { method: 'POST' });
            router.refresh(); // Refresh server components to show new contacts
        } catch (e) {
            console.error(e);
        } finally {
            setFinding(false);
        }
    };

    return (
        <div className={hqStyles.card}>
            <div className={hqStyles.cardHeader}>
                <div className="flex items-center gap-2">
                    <Users size={18} className="text-gray-400" />
                    <h3 className={hqStyles.cardTitle}>Contacts</h3>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleFindContacts}
                        disabled={finding}
                        className="btn btn-secondary text-xs h-7 px-2"
                    >
                        {finding ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} className="mr-1" />}
                        {finding ? 'Finding...' : 'Find Contacts'}
                    </button>
                </div>
            </div>
            <div className="divide-y divide-gray-100">
                {contacts.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                        <Users size={32} className="mx-auto mb-2 text-gray-300" />
                        <p className="text-sm">No contacts found yet.</p>
                        <p className="text-xs mt-1">Click "Find Contacts" to search.</p>
                    </div>
                ) : (
                    contacts.map((c) => (
                        <div key={c.id} className="p-4 hover:bg-gray-50 flex items-center justify-between group">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold">
                                    {c.firstName?.[0]}{c.lastName?.[0]}
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                                        {c.firstName} {c.lastName}
                                        {c.title && <span className="text-xs font-normal text-gray-500">| {c.title}</span>}
                                    </div>
                                    <div className="text-xs text-gray-500">{c.email}</div>
                                </div>
                            </div>
                            <button className="opacity-0 group-hover:opacity-100 text-indigo-600 hover:text-indigo-800" title="Copy Email">
                                <UserCheck size={16} />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
