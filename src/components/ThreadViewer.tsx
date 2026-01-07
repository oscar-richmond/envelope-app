'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Send, Loader2, User, ArrowUpRight, RefreshCw } from 'lucide-react';

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
        threadId: string;
    } | null>(null);

    // Composer state
    const [replyBody, setReplyBody] = useState('');
    const [sending, setSending] = useState(false);
    const [draftLoading, setDraftLoading] = useState(false);

    const composerRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        fetchThread();

        // Handle escape key
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [emailId]);

    async function fetchThread() {
        try {
            setLoading(true);
            setError(null);

            const res = await fetch(`/api/outreach/sent/${emailId}/thread`);
            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Could not load thread');
                return;
            }

            setThread(data);

            // Try to load AI draft if reply is expected
            if (data.email.replyIntent && ['INTERESTED', 'NOT_NOW', 'REFERRAL'].includes(data.email.replyIntent)) {
                loadDraft();
            }
        } catch (e) {
            setError('This conversation couldn\'t be loaded right now.');
        } finally {
            setLoading(false);
        }
    }

    async function loadDraft() {
        try {
            setDraftLoading(true);
            const res = await fetch(`/api/outreach/sent/${emailId}/reply-draft`);
            const data = await res.json();

            if (data.draft?.body && !replyBody) {
                setReplyBody(data.draft.body);
            }
        } catch (e) {
            // Silently fail - draft is optional
        } finally {
            setDraftLoading(false);
        }
    }

    async function regenerateDraft() {
        try {
            setDraftLoading(true);
            const res = await fetch(`/api/outreach/sent/${emailId}/reply-draft?regenerate=true`);
            const data = await res.json();

            if (data.draft?.body) {
                setReplyBody(data.draft.body);
            }
        } catch (e) {
            // Silently fail
        } finally {
            setDraftLoading(false);
        }
    }

    async function handleSend() {
        if (!replyBody.trim() || !thread) return;

        try {
            setSending(true);

            const res = await fetch(`/api/outreach/sent/${emailId}/reply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    body: replyBody,
                    threadId: thread.threadId
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to send');
            }

            // Refresh thread to show new message
            await fetchThread();
            setReplyBody('');

            if (onReplySent) {
                onReplySent();
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSending(false);
        }
    }

    function formatTimestamp(timestamp: string): string {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (diffDays === 1) {
            return 'Yesterday';
        } else if (diffDays < 7) {
            return `${diffDays} days ago`;
        } else {
            return date.toLocaleDateString();
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/30"
                onClick={onClose}
            />

            {/* Slide-over panel */}
            <div className="relative w-full max-w-2xl bg-white shadow-xl flex flex-col animate-slide-in-right">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <div>
                        {thread && (
                            <>
                                <h2 className="font-semibold text-gray-900">{thread.company.name}</h2>
                                <p className="text-sm text-gray-500">
                                    {thread.contact.name} • {thread.contact.email}
                                </p>
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        {thread?.email.conversationOutcome && (
                            <span className={`text-xs px-2 py-1 rounded ${thread.email.conversationOutcome === 'INTERESTED' ? 'bg-green-100 text-green-700' :
                                    thread.email.conversationOutcome === 'NOT_NOW' ? 'bg-amber-100 text-amber-700' :
                                        'bg-gray-100 text-gray-600'
                                }`}>
                                {thread.email.conversationOutcome.replace('_', ' ')}
                            </span>
                        )}
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 p-1"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Thread content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {loading ? (
                        <div className="flex items-center justify-center h-40">
                            <Loader2 className="animate-spin text-gray-400" size={24} />
                        </div>
                    ) : error ? (
                        <div className="text-center py-12">
                            <p className="text-gray-500">{error}</p>
                            <button
                                onClick={fetchThread}
                                className="mt-4 text-indigo-600 hover:text-indigo-700 text-sm"
                            >
                                Try again
                            </button>
                        </div>
                    ) : thread?.messages.map((msg, idx) => (
                        <div
                            key={msg.id}
                            className={`${msg.isOutbound ? 'pl-8' : 'pr-8'}`}
                        >
                            <div className={`rounded-lg p-4 ${msg.isOutbound
                                    ? 'bg-indigo-50 border border-indigo-100'
                                    : 'bg-gray-50 border border-gray-200'
                                }`}>
                                {/* Message header */}
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${msg.isOutbound
                                                ? 'bg-indigo-200 text-indigo-700'
                                                : 'bg-gray-200 text-gray-600'
                                            }`}>
                                            {msg.fromName[0]?.toUpperCase() || '?'}
                                        </div>
                                        <span className={`text-sm font-medium ${msg.isOutbound ? 'text-indigo-700' : 'text-gray-700'
                                            }`}>
                                            {msg.isOutbound ? 'You' : msg.fromName}
                                        </span>
                                    </div>
                                    <span
                                        className="text-xs text-gray-400"
                                        title={new Date(msg.timestamp).toLocaleString()}
                                    >
                                        {formatTimestamp(msg.timestamp)}
                                    </span>
                                </div>

                                {/* Message body */}
                                <div className="text-sm text-gray-700 whitespace-pre-wrap">
                                    {msg.body}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Divider */}
                <div className="border-t border-gray-200" />

                {/* Composer */}
                <div className="p-4 bg-gray-50">
                    <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                            Reply to {thread?.contact.email}
                        </span>
                        {replyBody && (
                            <button
                                onClick={regenerateDraft}
                                disabled={draftLoading}
                                className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
                            >
                                <RefreshCw size={10} className={draftLoading ? 'animate-spin' : ''} />
                                Regenerate
                            </button>
                        )}
                    </div>
                    <textarea
                        ref={composerRef}
                        value={replyBody}
                        onChange={(e) => setReplyBody(e.target.value)}
                        placeholder="Write your reply..."
                        className="w-full h-32 p-3 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                        disabled={sending}
                    />
                    <div className="flex justify-end mt-3">
                        <button
                            onClick={handleSend}
                            disabled={!replyBody.trim() || sending}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {sending ? (
                                <>
                                    <Loader2 size={14} className="animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <Send size={14} />
                                    Send Reply
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            <style jsx>{`
                @keyframes slide-in-right {
                    from { transform: translateX(100%); }
                    to { transform: translateX(0); }
                }
                .animate-slide-in-right {
                    animation: slide-in-right 0.2s ease-out;
                }
            `}</style>
        </div>
    );
}
