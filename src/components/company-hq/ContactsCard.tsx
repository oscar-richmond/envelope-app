'use client';

import { useState } from 'react';
import { hqStyles } from './SharedStyles';
import { Users, Search, RefreshCw, Check, Shield, AlertCircle, Globe, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Email {
    id: number;
    email: string;
    name: string | null;
    roleTitle: string | null;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    roleSource: string | null;
    type: string;
}

interface ContactsCardProps {
    prospectId?: number;
    leadId?: number;
    emails?: Email[];
    contacts?: any[];  // Alias for emails (for backwards compat)
    onSelectEmail?: (email: string) => void;
}

export default function ContactsCard({ prospectId, leadId, emails: emailsProp, contacts, onSelectEmail }: ContactsCardProps) {
    const router = useRouter();
    const [finding, setFinding] = useState(false);
    const [selectedEmail, setSelectedEmail] = useState<string | null>(null);

    // Normalize: accept either emails or contacts prop, default to empty array
    const emails: Email[] = Array.isArray(emailsProp) ? emailsProp
        : Array.isArray(contacts) ? contacts
            : [];

    const handleFindContacts = async () => {
        setFinding(true);
        try {
            await fetch('/api/contacts/discovery', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prospectId })
            });
            router.refresh();
        } catch (e) {
            console.error(e);
        } finally {
            setFinding(false);
        }
    };

    const handleUseEmail = (email: string) => {
        setSelectedEmail(email);
        onSelectEmail?.(email);
    };

    const getSourceIcon = (source: string | null) => {
        switch (source) {
            case 'hunter':
                return <Zap size={12} className="text-amber-500" />;
            case 'website':
                return <Globe size={12} className="text-blue-500" />;
            default:
                return null;
        }
    };

    const getSourceLabel = (source: string | null) => {
        switch (source) {
            case 'hunter':
                return 'Hunter';
            case 'website':
                return 'Website';
            default:
                return 'Unknown';
        }
    };

    const getConfidenceBadge = (confidence: 'HIGH' | 'MEDIUM' | 'LOW') => {
        switch (confidence) {
            case 'HIGH':
                return (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded-full bg-green-50 text-green-700 border border-green-200">
                        <Shield size={10} />
                        Verified
                    </span>
                );
            case 'MEDIUM':
                return (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                        <Check size={10} />
                        Likely
                    </span>
                );
            case 'LOW':
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded-full bg-gray-50 text-gray-500 border border-gray-200">
                        <AlertCircle size={10} />
                        Unknown
                    </span>
                );
        }
    };

    return (
        <div className={hqStyles.card}>
            <div className={hqStyles.cardHeader}>
                <div className="flex items-center gap-2">
                    <Users size={18} className="text-gray-400" />
                    <h3 className={hqStyles.cardTitle}>Contacts</h3>
                    {emails.length > 0 && (
                        <span className="text-xs text-gray-400">({emails.length})</span>
                    )}
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
                {emails.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                        <Users size={32} className="mx-auto mb-2 text-gray-300" />
                        <p className="text-sm">No contacts found yet.</p>
                        <p className="text-xs mt-1">Click "Find Contacts" to search.</p>
                    </div>
                ) : (
                    emails.map((e) => (
                        <div
                            key={e.id}
                            className={`p-4 hover:bg-gray-50 flex items-center justify-between group transition-colors ${selectedEmail === e.email ? 'bg-indigo-50 border-l-2 border-indigo-500' : ''
                                }`}
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-50 to-purple-50 text-indigo-600 flex items-center justify-center text-xs font-bold flex-shrink-0 border border-indigo-100">
                                    {e.name?.[0]?.toUpperCase() || e.email[0].toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-medium text-gray-900 truncate">
                                            {e.name || e.email.split('@')[0]}
                                        </span>
                                        {e.roleTitle && (
                                            <span className="text-xs text-gray-500 truncate">
                                                {e.roleTitle}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-xs text-gray-500 truncate">{e.email}</span>
                                        <div className="flex items-center gap-1.5">
                                            {/* Source badge */}
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                                                {getSourceIcon(e.roleSource)}
                                                {getSourceLabel(e.roleSource)}
                                            </span>
                                            {/* Confidence badge */}
                                            {getConfidenceBadge(e.confidence)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => handleUseEmail(e.email)}
                                className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-all ${selectedEmail === e.email
                                    ? 'bg-indigo-600 text-white'
                                    : 'opacity-0 group-hover:opacity-100 bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                                    }`}
                                title="Use this email"
                            >
                                {selectedEmail === e.email ? 'Selected' : 'Use'}
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
