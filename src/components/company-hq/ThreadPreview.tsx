'use client';

import { hqStyles } from './SharedStyles';
import { Mail, MessageCircle, Clock } from 'lucide-react';
import Link from 'next/link';

interface ThreadPreviewProps {
    sentEmails: any[];
}

export default function ThreadPreview({ sentEmails }: ThreadPreviewProps) {
    // SAFE: ensure sentEmails is always an array
    const emails = Array.isArray(sentEmails) ? sentEmails : [];
    const latestEmail = emails.length > 0 ? emails[0] : null;

    return (
        <div className={hqStyles.card}>
            <div className={hqStyles.cardHeader}>
                <div className="flex items-center gap-2">
                    <MessageCircle size={18} className="text-gray-400" />
                    <h3 className={hqStyles.cardTitle}>Thread Preview</h3>
                </div>
                {latestEmail && (
                    <Link href={`/outreach/sent?thread=${latestEmail.id}`} className="text-xs text-indigo-600 font-medium hover:underline">
                        View Thread
                    </Link>
                )}
            </div>

            <div className={hqStyles.cardBody}>
                {latestEmail ? (
                    <div className="space-y-3">
                        <div className="flex justify-between items-start">
                            <h4 className="text-sm font-semibold text-gray-900 line-clamp-1">{latestEmail.subject || 'No subject'}</h4>
                            <span className="text-xs text-gray-400 whitespace-nowrap">
                                {latestEmail.sentAt ? new Date(latestEmail.sentAt).toLocaleDateString() : '—'}
                            </span>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-sm text-gray-600 line-clamp-3 italic">
                            "{(latestEmail.bodyText || latestEmail.body || '').substring(0, 150)}..."
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            <StatusBadge status={latestEmail.status || 'SENT'} />
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-6 text-gray-400">
                        <Mail size={24} className="mx-auto mb-2 text-gray-300" />
                        <p className="text-sm">No outreach sent yet.</p>
                        <p className="text-xs">Draft a message below to start.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const colors: Record<string, string> = {
        SENT: 'bg-blue-100 text-blue-700',
        REPLIED: 'bg-green-100 text-green-700',
        FOLLOW_UP_DUE: 'bg-amber-100 text-amber-700',
        CLOSED: 'bg-gray-100 text-gray-700'
    };
    return (
        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${colors[status] || 'bg-gray-100 text-gray-600'}`}>
            {status}
        </span>
    );
}
