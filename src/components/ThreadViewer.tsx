'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Loader2, Clock, Reply, ChevronDown, ChevronUp } from 'lucide-react';
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

    useEffect(() => {
        fetchThread();
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [emailId]);

    useEffect(() => {
        if (thread?.messages && messagesEndRef.current && !loading) {
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
        onReplySent?.();
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(4px)' }}>
            <div className="absolute inset-0" onClick={onClose} />

            {/* Centered Modal Panel */}
            <div
                className="relative z-10 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                style={{
                    background: 'var(--bg-card)',
                    borderRadius: 'var(--radius-2xl)',
                    boxShadow: 'var(--shadow-float)',
                    border: '1px solid var(--border-soft)'
                }}
                ref={containerRef}
            >
                {/* Header */}
                <div
                    className="px-6 py-5 flex items-start justify-between shrink-0"
                    style={{ borderBottom: '1px solid var(--border-soft)' }}
                >
                    <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-3 mb-2">
                            <h2
                                className="text-xl font-bold truncate"
                                style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
                            >
                                {thread?.company.name || 'Conversation'}
                            </h2>
                            {thread?.email?.status && (
                                <StatusBadge status={thread.email.status} />
                            )}
                        </div>
                        <div
                            className="flex items-center gap-2 text-sm"
                            style={{ color: 'var(--text-secondary)' }}
                        >
                            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                                {thread?.contact.name}
                            </span>
                            <span style={{ color: 'var(--text-muted)' }}>
                                &lt;{thread?.contact.email}&gt;
                            </span>
                        </div>
                        {thread?.email?.subject && (
                            <div
                                className="mt-3 px-4 py-2.5 text-sm font-medium truncate"
                                style={{
                                    background: 'var(--bg-card-muted)',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--border-soft)',
                                    color: 'var(--text-primary)'
                                }}
                            >
                                {thread.email.subject}
                            </div>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2.5 transition-all"
                        style={{
                            color: 'var(--text-muted)',
                            borderRadius: 'var(--radius-md)'
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Messages List */}
                <div
                    className="flex-1 overflow-y-auto px-6 py-6 space-y-6"
                    style={{ background: 'var(--bg-page)' }}
                >
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full py-16">
                            <Loader2 className="animate-spin mb-3" size={32} style={{ color: 'var(--text-muted)' }} />
                            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading thread...</p>
                        </div>
                    ) : error ? (
                        <div className="text-center py-16">
                            <p className="mb-3" style={{ color: 'var(--error)' }}>{error}</p>
                            <button
                                onClick={fetchThread}
                                className="px-4 py-2 text-sm font-semibold transition-all"
                                style={{
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border-default)',
                                    borderRadius: 'var(--radius-button)',
                                    color: 'var(--text-primary)'
                                }}
                            >
                                Try again
                            </button>
                        </div>
                    ) : (
                        <>
                            {thread?.partial && thread?.partialReason && (
                                <div
                                    className="text-center py-2.5 px-4 mx-auto max-w-md"
                                    style={{
                                        background: 'var(--warning-light)',
                                        borderRadius: 'var(--radius-button)',
                                        border: '1px solid rgba(245, 158, 11, 0.3)'
                                    }}
                                >
                                    <p
                                        className="text-xs font-semibold flex items-center justify-center gap-2"
                                        style={{ color: 'var(--warning-text)' }}
                                    >
                                        <Clock size={12} />
                                        {thread.partialReason}
                                    </p>
                                </div>
                            )}

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

                {/* Composer (Bottom) */}
                {thread && !error && (
                    <div
                        className="p-5 shrink-0"
                        style={{
                            borderTop: '1px solid var(--border-soft)',
                            background: 'var(--bg-card)',
                            boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.04)'
                        }}
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <Reply size={14} style={{ color: 'var(--text-muted)' }} />
                            <span
                                className="text-xs font-semibold uppercase tracking-wider"
                                style={{ color: 'var(--text-muted)' }}
                            >
                                Reply to {thread.contact.name}
                            </span>
                        </div>
                        <div
                            className="overflow-hidden transition-all"
                            style={{
                                borderRadius: 'var(--radius-xl)',
                                border: '1px solid var(--border-default)',
                                boxShadow: 'var(--shadow-card)'
                            }}
                        >
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
 * Gmail-style Message Card with collapsible history
 */
function MessageCard({ message, isLast }: { message: ThreadMessage; isLast: boolean }) {
    const [showQuoted, setShowQuoted] = useState(false);
    const { mainBody, quotedText } = parseMessageBody(message.body);
    const hasQuoted = quotedText.length > 0;

    const isOutbound = message.isOutbound;

    // Accent colors based on direction
    const bubbleStyle = isOutbound ? {
        background: 'var(--accent-lilac-bg)',
        border: '1px solid rgba(184, 166, 255, 0.3)',
        borderRadius: 'var(--radius-xl) var(--radius-xl) var(--radius-sm) var(--radius-xl)'
    } : {
        background: 'var(--bg-card)',
        border: '1px solid var(--border-soft)',
        borderRadius: 'var(--radius-xl) var(--radius-xl) var(--radius-xl) var(--radius-sm)',
        boxShadow: 'var(--shadow-card)'
    };

    const avatarStyle = isOutbound ? {
        background: 'var(--accent-lilac)',
        color: 'white'
    } : {
        background: 'var(--accent-mint-bg)',
        color: 'var(--accent-mint-text)'
    };

    return (
        <div className={`flex gap-4 ${isOutbound ? 'flex-row-reverse' : 'flex-row'}`}>
            {/* Avatar */}
            <div
                className="w-10 h-10 rounded-[var(--radius-md)] flex items-center justify-center shrink-0 text-sm font-bold"
                style={avatarStyle}
            >
                {message.fromName[0]?.toUpperCase()}
            </div>

            {/* Bubble */}
            <div className={`flex flex-col max-w-[80%] ${isOutbound ? 'items-end' : 'items-start'}`}>
                <div className="flex items-baseline gap-2 mb-2 px-1">
                    <span
                        className="text-sm font-bold"
                        style={{ color: 'var(--text-primary)' }}
                    >
                        {isOutbound ? 'You' : message.fromName}
                    </span>
                    <span
                        className="text-xs"
                        style={{ color: 'var(--text-muted)' }}
                    >
                        {formatRelativeTime(message.timestamp)}
                    </span>
                </div>

                <div
                    className="px-5 py-4 text-sm leading-relaxed whitespace-pre-wrap"
                    style={bubbleStyle}
                >
                    {mainBody ? (
                        <span style={{ color: 'var(--text-primary)' }}>{mainBody}</span>
                    ) : (
                        <span className="italic" style={{ color: 'var(--text-muted)' }}>(No content)</span>
                    )}

                    {/* Collapsible Quoted Text */}
                    {hasQuoted && (
                        <div
                            className="mt-4 pt-3"
                            style={{ borderTop: '1px solid var(--border-soft)' }}
                        >
                            {!showQuoted ? (
                                <button
                                    onClick={() => setShowQuoted(true)}
                                    className="flex items-center gap-2 text-xs font-medium px-2 py-1 transition-colors"
                                    style={{
                                        color: 'var(--text-muted)',
                                        background: 'var(--bg-card-muted)',
                                        borderRadius: 'var(--radius-sm)'
                                    }}
                                >
                                    <ChevronDown size={12} />
                                    Show quoted text
                                </button>
                            ) : (
                                <div>
                                    <div
                                        className="text-xs pl-3 py-2 mb-2"
                                        style={{
                                            color: 'var(--text-muted)',
                                            borderLeft: '2px solid var(--border-default)'
                                        }}
                                    >
                                        {quotedText}
                                    </div>
                                    <button
                                        onClick={() => setShowQuoted(false)}
                                        className="flex items-center gap-1 text-xs"
                                        style={{ color: 'var(--text-muted)' }}
                                    >
                                        <ChevronUp size={12} />
                                        Hide
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

function parseMessageBody(body: string): { mainBody: string; quotedText: string } {
    if (!body) return { mainBody: '', quotedText: '' };
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
