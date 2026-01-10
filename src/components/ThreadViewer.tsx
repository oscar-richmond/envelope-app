'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Loader2, Clock, Reply, CheckCircle2 } from 'lucide-react';
import RichComposer from './RichComposer';
import StatusBadge from './StatusBadge';

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
    const containerRef = useRef<HTMLDivElement>(null);

    // Initial Load
    useEffect(() => {
        fetchThread();

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [emailId]);

    // Scroll to bottom only on initial load or new message sent
    useEffect(() => {
        if (thread?.messages && messagesEndRef.current && !loading) {
            // Use slightly delayed scroll to ensure rendering is complete
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        }
    }, [thread?.messages.length, loading]);

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

        await fetchThread();
        setDraftContent('');

        if (onReplySent) {
            onReplySent();
        }
    }

    function handleSaveDraft(html: string) {
        setDraftContent(html);
        localStorage.setItem(`draft-${emailId}`, html);
    }

    useEffect(() => {
        const saved = localStorage.getItem(`draft-${emailId}`);
        if (saved) setDraftContent(saved);
    }, [emailId]);

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />

            {/* Panel */}
            <div
                className="relative w-full max-w-3xl bg-white shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300"
                ref={containerRef}
            >
                {/* 1. Header (Sticky Top) */}
                <div className="px-6 py-4 border-b border-gray-200 bg-white/95 backdrop-blur z-20 shrink-0 flex items-start justify-between">
                    <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-2 mb-1">
                            <h2 className="text-lg font-bold text-gray-900 truncate">
                                {thread?.company.name || 'Conversation'}
                            </h2>
                            {thread?.email?.status && (
                                <StatusBadge status={thread.email.status} />
                            )}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center gap-2">
                            <span className="font-medium text-gray-700">{thread?.contact.name}</span>
                            <span className="text-gray-400">&lt;{thread?.contact.email}&gt;</span>
                        </div>
                        {thread?.email?.subject && (
                            <p className="text-sm font-medium text-gray-800 mt-3 truncate bg-gray-50 p-2 rounded border border-gray-100">
                                {thread.email.subject}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="btn btn-ghost p-2 rounded-full text-gray-400 hover:text-gray-600"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* 2. Messages List (Scrollable) */}
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8 bg-gray-50/50">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <Loader2 className="animate-spin mb-2" size={32} />
                            <p className="text-sm">Loading thread...</p>
                        </div>
                    ) : error ? (
                        <div className="text-center py-12">
                            <p className="text-red-500 mb-2">{error}</p>
                            <button onClick={fetchThread} className="btn btn-secondary">Try again</button>
                        </div>
                    ) : (
                        <>
                            {thread?.partial && thread?.partialReason && (
                                <div className="text-center py-2 px-3 bg-amber-50 border border-amber-100 rounded-lg mx-auto max-w-md">
                                    <p className="text-xs text-amber-600 font-medium flex items-center justify-center gap-2">
                                        <Clock size={12} />
                                        {thread.partialReason}
                                    </p>
                                </div>
                            )}

                            {/* Messages */}
                            {thread?.messages.map((msg, idx) => (
                                <MessageCard
                                    key={msg.id}
                                    message={msg}
                                    isLast={idx === thread.messages.length - 1}
                                />
                            ))}

                            <div ref={messagesEndRef} className="h-4" />
                        </>
                    )}
                </div>

                {/* 3. Composer (Sticky Bottom) */}
                {thread && !error && (
                    <div className="bg-white border-t border-gray-200 p-6 z-20 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                        <div className="mb-2 flex items-center justify-between">
                            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                <Reply size={12} />
                                Reply to {thread.contact.name}
                            </span>
                        </div>
                        <div className="rounded-xl overflow-hidden border border-gray-300 focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-400 transition-all shadow-sm">
                            <RichComposer
                                to={thread.contact.email}
                                subject={thread.email?.subject || ''}
                                initialValue={draftContent}
                                onSend={handleSend}
                                onSaveDraft={handleSaveDraft}
                                disabled={loading}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * Modern Message Card component
 */
function MessageCard({ message, isLast }: { message: ThreadMessage; isLast: boolean }) {
    const [showQuoted, setShowQuoted] = useState(false);
    const { mainBody, quotedText } = parseMessageBody(message.body);
    const hasQuoted = quotedText.length > 0;

    const isOutbound = message.isOutbound;

    return (
        <div className={`flex gap-4 ${isOutbound ? 'flex-row-reverse' : 'flex-row'}`}>
            {/* Avatar */}
            <div className={`
                w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 border-white shadow-sm text-sm font-semibold
                ${isOutbound ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600'}
            `}>
                {message.fromName[0]?.toUpperCase()}
            </div>

            {/* Bubble */}
            <div className={`flex flex-col max-w-[85%] ${isOutbound ? 'items-end' : 'items-start'}`}>
                <div className="flex items-baseline gap-2 mb-1 px-1">
                    <span className="text-sm font-bold text-gray-900">
                        {isOutbound ? 'You' : message.fromName}
                    </span>
                    <span className="text-xs text-gray-400">
                        {formatRelativeTime(message.timestamp)}
                    </span>
                </div>

                <div className={`
                    rounded-2xl px-5 py-4 shadow-sm border text-sm leading-relaxed whitespace-pre-wrap
                    ${isOutbound
                        ? 'bg-indigo-50 border-indigo-100 text-gray-800 rounded-tr-sm'
                        : 'bg-white border-gray-200 text-gray-800 rounded-tl-sm'
                    }
                `}>
                    {/* Show main body, handle empty content */}
                    {mainBody ? mainBody : <span className="text-gray-400 italic">(No content)</span>}

                    {/* Collapsed History */}
                    {hasQuoted && (
                        <div className="mt-4 pt-3 border-t border-black/5">
                            {!showQuoted ? (
                                <button
                                    onClick={() => setShowQuoted(true)}
                                    className="text-xs text-gray-500 font-medium flex items-center gap-1 hover:text-gray-800 bg-white/50 px-2 py-1 rounded transition-colors"
                                >
                                    <div className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center text-[10px]">...</div>
                                    Show quoted text
                                </button>
                            ) : (
                                <div>
                                    <div className="text-xs text-gray-500 pl-2 border-l-2 border-gray-300 py-1 mb-2">
                                        {quotedText}
                                    </div>
                                    <button
                                        onClick={() => setShowQuoted(false)}
                                        className="text-xs text-gray-400 hover:text-gray-600"
                                    >
                                        Hide history
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ... helpers ...
function parseMessageBody(body: string): { mainBody: string; quotedText: string } {
    if (!body) return { mainBody: '', quotedText: '' };
    // Basic cleanup
    let cleaned = body
        .replace(/^From:.*$/gm, '')
        .replace(/^Sent:.*$/gm, '')
        .replace(/^To:.*$/gm, '')
        .replace(/^Subject:.*$/gm, '')
        .trim();

    const quotePatterns = [/On .+wrote:[\s\S]*/i, /^>.*$/gm, /_{10,}/, /-{10,}/];
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
    return { mainBody, quotedText };
}


function formatRelativeTime(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 60000) return 'Just now';
    if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
    if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h ago`;
    if (diffMs < 172800000) return 'Yesterday';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
