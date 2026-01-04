'use client';

import { useState } from 'react';
import { UserPlus, User, Mail, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';

type Contact = {
    id: number;
    firstName: string | null;
    lastName: string | null;
    title: string | null;
    email: string | null;
    confidence: number;
    roleCategory: string | null;
};

export default function ContactList({ leadId, initialContacts }: { leadId: number, initialContacts: Contact[] }) {
    const router = useRouter();
    const [contacts, setContacts] = useState<Contact[]>(initialContacts);
    const [loading, setLoading] = useState(false);

    const handleDiscovery = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/contacts/discovery', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ leadId })
            });
            if (res.ok) {
                const newContacts = await res.json();
                setContacts([...contacts, ...newContacts]);
                router.refresh();
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <User size={18} className="text-gray-400" />
                    Key Contacts
                </h3>
                <button
                    onClick={handleDiscovery}
                    disabled={loading}
                    className="text-sm bg-blue-50 text-blue-600 px-3 py-1.5 rounded-md font-medium hover:bg-blue-100 flex items-center gap-1 transition-colors"
                >
                    <UserPlus size={14} />
                    {loading ? 'Searching...' : 'Find Contacts'}
                </button>
            </div>

            {contacts.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                    No contacts found yet. Click "Find Contacts" to search.
                </div>
            ) : (
                <div className="space-y-3">
                    {contacts.map((c) => (
                        <div key={c.id} className="flex justify-between items-center p-3 rounded-lg border border-gray-100 hover:border-blue-100 hover:bg-blue-50/30 transition-colors bg-gray-50/50">
                            <div>
                                <div className="font-medium text-gray-900">
                                    {c.firstName || 'Unknown'} {c.lastName || ''}
                                </div>
                                <div className="text-xs text-gray-500 uppercase tracking-wide mt-0.5">
                                    {c.title || 'No Title'}
                                </div>
                            </div>
                            <div className="text-right">
                                {c.email && (
                                    <div className="flex items-center justify-end gap-1.5 text-sm text-gray-700">
                                        <Mail size={12} className="text-gray-400" />
                                        {c.email}
                                    </div>
                                )}
                                <div className="flex items-center justify-end gap-1 mt-1 mb-2">
                                    <div className="flex items-center gap-1 text-xs text-green-600 font-medium bg-green-50 px-1.5 py-0.5 rounded border border-green-100">
                                        <ShieldCheck size={10} />
                                        {c.confidence}% Confidence
                                    </div>
                                    <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200">
                                        {c.roleCategory || 'OTHER'}
                                    </span>
                                </div>
                                <button
                                    onClick={async () => {
                                        try {
                                            await fetch('/api/outreach', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ leadId, contactId: c.id })
                                            });
                                            alert("Draft created in Outreach Queue!");
                                        } catch (e) { alert("Failed to create draft"); }
                                    }}
                                    className="text-xs bg-gray-900 text-white px-2 py-1 rounded hover:bg-gray-700 flex items-center gap-1 ml-auto"
                                >
                                    <Mail size={10} /> Draft Email
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
