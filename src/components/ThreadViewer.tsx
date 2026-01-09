'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Loader2, ChevronDown, ChevronUp, Paperclip, XCircle } from 'lucide-react';
import RichComposer from './RichComposer';

interface ThreadMessage {
    id: string;
    from: string;
    fromName: string;
    to: string;
    subject: string;
    body: string;
    timestamp: string;
    isOutbound: boolean;
}

interface ThreadViewerProps {
    emailId: number;
    onClose: () => void;
    onReplySent?: () => void;
}

export default function ThreadViewer({ emailId, onClose, onReplySent }: ThreadViewerProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [thread, setThread] = useState<{
        email: any;
        company: { name: string; domain?: string };
        contact: { name: string; email: string };
        messages: ThreadMessage[];
        threadId: string | null;
        partial?: boolean;
        partialReason?: string;
    } | null>(null);

    const [draftContent, setDraftContent] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchThread();

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [emailId]);

    // Auto-scroll to bottom when messages load
    useEffect(() => {
        if (thread?.messages && messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [thread?.messages]);

    async function fetchThread() {
        try {
            setLoading(true);
            setError(null);

            const res = await fetch(`/api/outreach/sent/${emailId}/thread`);
            const data = await res.json();

            if (data.success === false || res.status === 404) {
                setError(data.error || 'Email not found');
                return;
            }

            setThread(data);
        } catch (e) {
            setError('We\'re having trouble loading this thread.');
        } finally {
            setLoading(false);
        }
    }

    async function handleSend(html: string, plainText: string) {
        if (!thread) return;

        const res = await fetch(`/api/outreach/sent/${emailId}/reply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                body: plainText,
                htmlBody: html,
                threadId: thread.threadId
            })
        });

        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Failed to send');
        }

        // Refresh thread to show new message
        await fetchThread();
        setDraftContent('');

        if (onReplySent) {
            onReplySent();
        }
    }

    function handleSaveDraft(html: string) {
        setDraftContent(html);
        // Store in localStorage for persistence
        localStorage.setItem(`draft-${emailId}`, html);
    }

    // Load saved draft on mount
    useEffect(() => {
        const saved = localStorage.getItem(`draft-${emailId}`);
        if (saved) {
            setDraftContent(saved);
        }
    }, [emailId]);

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/20" onClick={onClose} />

            {/* Panel */}
            <div className="relative w-full max-w-2xl bg-white shadow-2xl flex flex-col animate-slide-in">
                {/* Header */}
                <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
                    <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                            <h2 className="font-semibold text-gray-900 truncate">
                                {thread?.company.name || 'Loading...'}
                            </h2>
                            <p className="text-sm text-gray-500 truncate mt-0.5">
                                {thread?.contact.name} • {thread?.contact.email}
                            </p>
                            {thread?.email?.subject && (
                                <p className="text-xs text-gray-400 truncate mt-1">
                                    {thread.email.subject}
                                </p>
                            )}
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                            {thread?.email?.status && (
                                <StatusBadge status={thread.email.status} />
                            )}
                            <button
                                onClick={onClose}
                                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                    {loading ? (
                        <div className="flex items-center justify-center h-40">
                            <Loader2 className="animate-spin text-gray-400" size={24} />
                        </div>
                    ) : error ? (
                        <div className="text-center py-12">
                            <p className="text-gray-500">{error}</p>
                            <button
                                onClick={fetchThread}
                                className="mt-4 text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                            >
                                Try again
                            </button>
                        </div>
                    ) : (
                        <>
                            {thread?.partial && thread?.partialReason && (
                                <div className="text-center py-2 px-3 bg-amber-50 border border-amber-100 rounded-lg">
                                    <p className="text-xs text-amber-600">{thread.partialReason}</p>
                                </div>
                            )}

                            {thread?.messages.map((msg) => (
                                <MessageCard key={msg.id} message={msg} />
                            ))}

                            <div ref={messagesEndRef} />
                        </>
                    )}
                </div>

                {/* Composer (sticky at bottom) */}
                {thread && !error && (
                    <RichComposer
                        to={thread.contact.email}
                        subject={thread.email?.subject || ''}
                        initialValue={draftContent}
                        onSend={handleSend}
                        onSaveDraft={handleSaveDraft}
                        disabled={loading}
                    />
                )}
            </div>

            <style jsx>{`
                @keyframes slide-in {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                .animate-slide-in {
                    animation: slide-in 0.2s ease-out;
                }
            `}</style>
        </div>
    );
}

/**
 * Individual message card with clean rendering
 */
function MessageCard({ message }: { message: ThreadMessage }) {
    const [showQuoted, setShowQuoted] = useState(false);

    // Clean up the message body
    const { mainBody, quotedText } = parseMessageBody(message.body);
    const hasQuoted = quotedText.length > 0;

    return (
        <div className={`${message.isOutbound ? 'ml-6' : 'mr-6'}`}>
            <div className={`rounded-xl p-4 ${message.isOutbound
                    ? 'bg-indigo-50 border border-indigo-100'
                    : 'bg-white border border-gray-200 shadow-sm'
                }`}>
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${message.isOutbound
                                ? 'bg-indigo-200 text-indigo-700'
                                : 'bg-gray-200 text-gray-600'
                            }`}>
                            {message.fromName[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                            <span className={`text-sm font-medium ${message.isOutbound ? 'text-indigo-700' : 'text-gray-900'
                                }`}>
                                {message.isOutbound ? 'You' : message.fromName}
                            </span>
                        </div>
                    </div>
                    <span
                        className="text-xs text-gray-400"
                        title={formatFullDate(message.timestamp)}
                    >
                        {formatRelativeTime(message.timestamp)}
                    </span>
                </div>

                {/* Body */}
                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {mainBody || '(No content)'}
                </div>

                {/* Quoted text toggle */}
                {hasQuoted && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                        <button
                            onClick={() => setShowQuoted(!showQuoted)}
                            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
                        >
                            {showQuoted ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            {showQuoted ? 'Hide' : 'Show'} quoted text
                        </button>
                        {showQuoted && (
                            <div className="mt-2 pl-3 border-l-2 border-gray-200 text-xs text-gray-500 whitespace-pre-wrap">
                                {quotedText}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * Parse message body to separate main content from quoted text
 */
function parseMessageBody(body: string): { mainBody: string; quotedText: string } {
    if (!body) return { mainBody: '', quotedText: '' };

    // Remove raw header blocks from body
    let cleaned = body
        .replace(/^From:.*$/gm, '')
        .replace(/^Sent:.*$/gm, '')
        .replace(/^To:.*$/gm, '')
        .replace(/^Subject:.*$/gm, '')
        .replace(/^Cc:.*$/gm, '')
        .replace(/^Date:.*$/gm, '')
        .trim();

    // Detect quoted text patterns
    const quotePatterns = [
        /On .+wrote:[\s\S]*/i,
        /^>.*$/gm,
        /_{10,}/,
        /-{10,}/
    ];

    let mainBody = cleaned;
    let quotedText = '';

    for (const pattern of quotePatterns) {
        const match = mainBody.match(pattern);
        if (match && match.index) {
            quotedText = mainBody.substring(match.index);
            mainBody = mainBody.substring(0, match.index).trim();
            break;
        }
    }

    // Clean up extra newlines
    mainBody = mainBody.replace(/\n{3,}/g, '\n\n').trim();

    return { mainBody, quotedText };
}

function StatusBadge({ status }: { status: string }) {
    const config: Record<string, { label: string; className: string }> = {
        SENT: { label: 'Waiting', className: 'bg-gray-100 text-gray-600' },
        FOLLOW_UP_DUE: { label: 'Action Needed', className: 'bg-amber-100 text-amber-700' },
        REPLIED: { label: 'Replied', className: 'bg-green-100 text-green-700' },
        CLOSED: { label: 'Closed', className: 'bg-gray-100 text-gray-500' },
    };

    const { label, className } = config[status] || { label: status, className: 'bg-gray-100 text-gray-600' };

    return (
        <span className={`text-[10px] font-medium px-2 py-1 rounded ${className}`}>
            {label}
        </span>
    );
}

function formatRelativeTime(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

function formatFullDate(timestamp: string): string {
    return new Date(timestamp).toLocaleString();
}
