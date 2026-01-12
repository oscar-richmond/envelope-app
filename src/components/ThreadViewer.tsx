'use client';

import { useState, useEffect, useRef } from 'react';
import {
    X, Loader2, Clock, Reply, ChevronDown, ChevronUp,
    Sparkles, MessageSquareText, Wand2, RefreshCw,
    Info, AlertCircle
} from 'lucide-react';
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
        retryable?: boolean;
    } | null>(null);

    const [draftContent, setDraftContent] = useState('');

    // AI Assist State
    const [aiSummary, setAiSummary] = useState<string | null>(null);
    const [summarizing, setSummarizing] = useState(false);
    const [suggesting, setSuggesting] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);

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

    // Get thread content as text for AI
    function getThreadContent(): string {
        if (!thread?.messages) return '';
        return thread.messages.map(m =>
            `[${m.isOutbound ? 'SENT' : 'RECEIVED'}] ${m.fromName} (${formatRelativeTime(m.timestamp)}):\n${m.body}`
        ).join('\n\n---\n\n');
    }

    async function handleSummarize() {
        if (!thread) return;
        setSummarizing(true);
        setAiError(null);

        try {
            const res = await fetch(`/api/outreach/sent/${emailId}/ai`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'summarize',
                    threadContent: getThreadContent(),
                    companyName: thread.company.name,
                    contactName: thread.contact.name
                })
            });

            const data = await res.json();
            if (data.success) {
                setAiSummary(data.result);
            } else {
                setAiError(data.error || 'Failed to summarize');
            }
        } catch (e) {
            setAiError('AI service unavailable');
        } finally {
            setSummarizing(false);
        }
    }

    async function handleSuggestReply() {
        if (!thread) return;
        setSuggesting(true);
        setAiError(null);

        try {
            const res = await fetch(`/api/outreach/sent/${emailId}/ai`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'suggest_reply',
                    threadContent: getThreadContent(),
                    companyName: thread.company.name,
                    contactName: thread.contact.name
                })
            });

            const data = await res.json();
            if (data.success) {
                setDraftContent(data.result);
            } else {
                setAiError(data.error || 'Failed to suggest reply');
            }
        } catch (e) {
            setAiError('AI service unavailable');
        } finally {
            setSuggesting(false);
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
        localStorage.removeItem(`draft-${emailId}`);
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
            style={{ background: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(6px)' }}>
            <div className="absolute inset-0" onClick={onClose} />

            {/* Modal Panel */}
            <div
                className="relative z-10 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                style={{
                    background: 'var(--bg-card)',
                    borderRadius: '20px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
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
                                    borderRadius: '10px',
                                    border: '1px solid var(--border-soft)',
                                    color: 'var(--text-primary)'
                                }}
                            >
                                {thread.email.subject}
                            </div>
                        )}
                    </div>

                    {/* Header Actions */}
                    <div className="flex items-center gap-2">
                        {/* AI Assist Buttons */}
                        {thread && !loading && !error && (
                            <>
                                <button
                                    onClick={handleSummarize}
                                    disabled={summarizing}
                                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-all"
                                    style={{
                                        background: 'var(--bg-card-muted)',
                                        border: '1px solid var(--border-default)',
                                        color: 'var(--text-secondary)'
                                    }}
                                    title="Summarize thread"
                                >
                                    {summarizing ? (
                                        <Loader2 size={14} className="animate-spin" />
                                    ) : (
                                        <MessageSquareText size={14} />
                                    )}
                                    Summarize
                                </button>
                                <button
                                    onClick={handleSuggestReply}
                                    disabled={suggesting}
                                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-all"
                                    style={{
                                        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(59, 130, 246, 0.1))',
                                        border: '1px solid rgba(139, 92, 246, 0.3)',
                                        color: 'rgb(139, 92, 246)'
                                    }}
                                    title="AI suggest reply"
                                >
                                    {suggesting ? (
                                        <Loader2 size={14} className="animate-spin" />
                                    ) : (
                                        <Wand2 size={14} />
                                    )}
                                    Suggest Reply
                                </button>
                            </>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2.5 transition-all hover:bg-gray-100 rounded-lg"
                            style={{ color: 'var(--text-muted)' }}
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* AI Summary Banner */}
                {aiSummary && (
                    <div
                        className="px-6 py-4 flex items-start gap-3"
                        style={{
                            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(59, 130, 246, 0.08))',
                            borderBottom: '1px solid rgba(139, 92, 246, 0.2)'
                        }}
                    >
                        <Sparkles size={16} style={{ color: 'rgb(139, 92, 246)', marginTop: 2 }} />
                        <div className="flex-1">
                            <p className="text-xs font-semibold mb-1" style={{ color: 'rgb(139, 92, 246)' }}>
                                Thread Summary
                            </p>
                            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                                {aiSummary}
                            </p>
                        </div>
                        <button
                            onClick={() => setAiSummary(null)}
                            className="p-1 hover:bg-white/50 rounded"
                            style={{ color: 'var(--text-muted)' }}
                        >
                            <X size={14} />
                        </button>
                    </div>
                )}

                {/* Suggested Action Banner */}
                {thread?.email?.suggestedAction && thread.email.suggestedAction !== 'REVIEW' && (
                    <SuggestedActionBanner
                        action={thread.email.suggestedAction}
                        intent={thread.email.replyIntent}
                        objectionType={thread.email.objectionType}
                        onAction={() => {
                            // Handle action button click
                            switch (thread.email.suggestedAction) {
                                case 'SEND_BOOKING_LINK':
                                case 'DRAFT_REPLY':
                                case 'HANDLE_OBJECTION':
                                case 'REQUEST_REFERRAL':
                                    handleSuggestReply();
                                    break;
                                case 'MARK_CLOSED':
                                    // TODO: Implement close thread
                                    break;
                            }
                        }}
                    />
                )}

                {/* AI Error */}
                {aiError && (
                    <div
                        className="px-6 py-3 flex items-center gap-2"
                        style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            borderBottom: '1px solid rgba(239, 68, 68, 0.2)'
                        }}
                    >
                        <AlertCircle size={14} style={{ color: 'rgb(239, 68, 68)' }} />
                        <p className="text-sm" style={{ color: 'rgb(239, 68, 68)' }}>{aiError}</p>
                        <button
                            onClick={() => setAiError(null)}
                            className="ml-auto p-1"
                            style={{ color: 'rgb(239, 68, 68)' }}
                        >
                            <X size={14} />
                        </button>
                    </div>
                )}

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
                            <div className="w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center"
                                style={{ background: 'rgba(239, 68, 68, 0.1)' }}>
                                <AlertCircle size={24} style={{ color: 'rgb(239, 68, 68)' }} />
                            </div>
                            <p className="mb-4 font-medium" style={{ color: 'var(--text-primary)' }}>
                                {error}
                            </p>
                            <button
                                onClick={fetchThread}
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-all"
                                style={{
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border-default)',
                                    borderRadius: '10px',
                                    color: 'var(--text-primary)'
                                }}
                            >
                                <RefreshCw size={14} />
                                Try again
                            </button>
                        </div>
                    ) : (
                        <>
                            {thread?.partial && thread?.partialReason && (
                                <div
                                    className="text-center py-2.5 px-4 mx-auto max-w-md flex items-center justify-center gap-2"
                                    style={{
                                        background: 'rgba(245, 158, 11, 0.1)',
                                        borderRadius: '10px',
                                        border: '1px solid rgba(245, 158, 11, 0.3)'
                                    }}
                                >
                                    <Info size={14} style={{ color: 'rgb(245, 158, 11)' }} />
                                    <p className="text-xs font-medium" style={{ color: 'rgb(180, 120, 20)' }}>
                                        {thread.partialReason}
                                    </p>
                                    {thread.retryable && (
                                        <button
                                            onClick={fetchThread}
                                            className="text-xs font-medium underline ml-2"
                                            style={{ color: 'rgb(180, 120, 20)' }}
                                        >
                                            Retry
                                        </button>
                                    )}
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

                {/* Composer */}
                {thread && !error && (
                    <div
                        className="p-5 shrink-0"
                        style={{
                            borderTop: '1px solid var(--border-soft)',
                            background: 'var(--bg-card)',
                            boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.04)'
                        }}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Reply size={14} style={{ color: 'var(--text-muted)' }} />
                                <span
                                    className="text-xs font-semibold uppercase tracking-wider"
                                    style={{ color: 'var(--text-muted)' }}
                                >
                                    Reply to {thread.contact.name}
                                </span>
                            </div>
                            {/* Regenerate button in composer area */}
                            <button
                                onClick={handleSuggestReply}
                                disabled={suggesting}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-all hover:opacity-80"
                                style={{
                                    background: 'transparent',
                                    color: 'rgb(139, 92, 246)'
                                }}
                            >
                                {suggesting ? (
                                    <Loader2 size={12} className="animate-spin" />
                                ) : (
                                    <Wand2 size={12} />
                                )}
                                {draftContent ? 'Regenerate' : 'AI Draft'}
                            </button>
                        </div>
                        <div
                            className="overflow-hidden transition-all"
                            style={{
                                borderRadius: '14px',
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
 * Gmail-style Message Card with collapsible quoted text
 */
function MessageCard({ message, isLast }: { message: ThreadMessage; isLast: boolean }) {
    const [showQuoted, setShowQuoted] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const { mainBody, quotedText, headers } = parseMessageBody(message.body, message);
    const hasQuoted = quotedText.length > 0;

    const isOutbound = message.isOutbound;

    const bubbleStyle = isOutbound ? {
        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(59, 130, 246, 0.08))',
        border: '1px solid rgba(139, 92, 246, 0.2)',
        borderRadius: '16px 16px 4px 16px'
    } : {
        background: 'var(--bg-card)',
        border: '1px solid var(--border-soft)',
        borderRadius: '16px 16px 16px 4px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
    };

    const avatarStyle = isOutbound ? {
        background: 'linear-gradient(135deg, rgb(139, 92, 246), rgb(59, 130, 246))',
        color: 'white'
    } : {
        background: 'linear-gradient(135deg, rgb(16, 185, 129), rgb(6, 182, 212))',
        color: 'white'
    };

    return (
        <div className={`flex gap-4 ${isOutbound ? 'flex-row-reverse' : 'flex-row'}`}>
            {/* Avatar */}
            <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold shadow-sm"
                style={avatarStyle}
            >
                {message.fromName[0]?.toUpperCase() || '?'}
            </div>

            {/* Bubble */}
            <div className={`flex flex-col max-w-[80%] ${isOutbound ? 'items-end' : 'items-start'}`}>
                <div className="flex items-baseline gap-2 mb-2 px-1">
                    <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                        {isOutbound ? 'You' : message.fromName}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {formatRelativeTime(message.timestamp)}
                    </span>
                    {/* Details toggle */}
                    <button
                        onClick={() => setShowDetails(!showDetails)}
                        className="text-xs flex items-center gap-1 hover:underline"
                        style={{ color: 'var(--text-muted)' }}
                    >
                        <Info size={10} />
                        {showDetails ? 'Hide' : 'Details'}
                    </button>
                </div>

                {/* Technical Details Dropdown */}
                {showDetails && (
                    <div
                        className="mb-2 px-3 py-2 text-xs w-full"
                        style={{
                            background: 'var(--bg-card-muted)',
                            borderRadius: '8px',
                            color: 'var(--text-muted)',
                            fontFamily: 'monospace'
                        }}
                    >
                        <div><strong>From:</strong> {message.from}</div>
                        <div><strong>To:</strong> {message.to}</div>
                        <div><strong>Date:</strong> {new Date(message.timestamp).toLocaleString()}</div>
                        {message.subject && <div><strong>Subject:</strong> {message.subject}</div>}
                    </div>
                )}

                <div className="px-5 py-4 text-sm leading-relaxed" style={bubbleStyle}>
                    {mainBody ? (
                        <div
                            className="whitespace-pre-wrap"
                            style={{ color: 'var(--text-primary)' }}
                        >
                            {mainBody}
                        </div>
                    ) : (
                        <span className="italic" style={{ color: 'var(--text-muted)' }}>
                            (No content)
                        </span>
                    )}

                    {/* Collapsible Quoted Text */}
                    {hasQuoted && (
                        <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--border-soft)' }}>
                            {!showQuoted ? (
                                <button
                                    onClick={() => setShowQuoted(true)}
                                    className="flex items-center gap-2 text-xs font-medium px-2.5 py-1.5 transition-colors hover:opacity-80"
                                    style={{
                                        color: 'var(--text-muted)',
                                        background: 'var(--bg-card-muted)',
                                        borderRadius: '6px'
                                    }}
                                >
                                    <ChevronDown size={12} />
                                    Show quoted text
                                </button>
                            ) : (
                                <div>
                                    <div
                                        className="text-xs pl-3 py-2 mb-2 whitespace-pre-wrap"
                                        style={{
                                            color: 'var(--text-muted)',
                                            borderLeft: '2px solid var(--border-default)'
                                        }}
                                    >
                                        {quotedText}
                                    </div>
                                    <button
                                        onClick={() => setShowQuoted(false)}
                                        className="flex items-center gap-1 text-xs hover:underline"
                                        style={{ color: 'var(--text-muted)' }}
                                    >
                                        <ChevronUp size={12} />
                                        Hide quoted text
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

function parseMessageBody(body: string, message: ThreadMessage): {
    mainBody: string;
    quotedText: string;
    headers: Record<string, string>;
} {
    if (!body) return { mainBody: '', quotedText: '', headers: {} };

    // Extract and remove RFC headers from displayed body
    const headers: Record<string, string> = {};
    let cleaned = body;

    // Remove common headers
    const headerPatterns = [
        /^From:.*$/gm,
        /^Sent:.*$/gm,
        /^To:.*$/gm,
        /^Subject:.*$/gm,
        /^Date:.*$/gm,
        /^Cc:.*$/gm,
        /^Reply-To:.*$/gm
    ];

    for (const pattern of headerPatterns) {
        cleaned = cleaned.replace(pattern, '');
    }
    cleaned = cleaned.trim();

    // Split quoted content
    const quotePatterns = [
        /On .+wrote:[\s\S]*/i,
        /^>.*$/gm,
        /_{10,}/,
        /-{10,}/,
        /^From:.*?[\r\n]+Sent:.*?[\r\n]+To:/m
    ];

    let mainBody = cleaned;
    let quotedText = '';

    for (const pattern of quotePatterns) {
        const match = mainBody.match(pattern);
        if (match && match.index && match.index > 0) {
            quotedText = mainBody.substring(match.index);
            mainBody = mainBody.substring(0, match.index).trim();
            break;
        }
    }

    return { mainBody, quotedText, headers };
}

function formatRelativeTime(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 60000) return 'Just now';
    if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
    if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h ago`;
    if (diffMs < 172800000) return 'Yesterday';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Suggested Action Banner with CTA
 */
const ACTION_CONFIG: Record<string, {
    label: string;
    description: string;
    cta: string;
    bg: string;
    border: string;
    color: string;
    icon: string;
}> = {
    SEND_BOOKING_LINK: {
        label: 'Ready to book',
        description: 'They expressed interest in a call or meeting.',
        cta: 'Draft Reply with Booking Link',
        bg: 'rgba(16, 185, 129, 0.08)',
        border: 'rgba(16, 185, 129, 0.3)',
        color: 'rgb(5, 150, 105)',
        icon: '📅'
    },
    DRAFT_REPLY: {
        label: 'Reply needed',
        description: 'They asked a question that needs a response.',
        cta: 'Generate Reply',
        bg: 'rgba(59, 130, 246, 0.08)',
        border: 'rgba(59, 130, 246, 0.3)',
        color: 'rgb(37, 99, 235)',
        icon: '💬'
    },
    HANDLE_OBJECTION: {
        label: 'Handle objection',
        description: 'They raised a concern that could be addressed.',
        cta: 'Draft Response',
        bg: 'rgba(245, 158, 11, 0.08)',
        border: 'rgba(245, 158, 11, 0.3)',
        color: 'rgb(180, 120, 20)',
        icon: '🤔'
    },
    REQUEST_REFERRAL: {
        label: 'Wrong person',
        description: 'They indicated they\'re not the right contact.',
        cta: 'Ask for Referral',
        bg: 'rgba(139, 92, 246, 0.08)',
        border: 'rgba(139, 92, 246, 0.3)',
        color: 'rgb(124, 58, 237)',
        icon: '👋'
    },
    MARK_CLOSED: {
        label: 'Not interested',
        description: 'They declined - close gracefully.',
        cta: 'Draft Polite Close',
        bg: 'rgba(239, 68, 68, 0.08)',
        border: 'rgba(239, 68, 68, 0.3)',
        color: 'rgb(220, 38, 38)',
        icon: '🚪'
    },
    WAIT_RETURN: {
        label: 'Out of office',
        description: 'They\'re away - wait for their return.',
        cta: 'Set Reminder',
        bg: 'rgba(107, 114, 128, 0.08)',
        border: 'rgba(107, 114, 128, 0.3)',
        color: 'rgb(75, 85, 99)',
        icon: '⏰'
    }
};

function SuggestedActionBanner({
    action,
    intent,
    objectionType,
    onAction
}: {
    action: string;
    intent?: string | null;
    objectionType?: string | null;
    onAction: () => void;
}) {
    const config = ACTION_CONFIG[action];
    if (!config) return null;

    let description = config.description;
    if (action === 'HANDLE_OBJECTION' && objectionType) {
        description = `They raised a concern about ${objectionType.replace('_', ' ')}.`;
    }

    return (
        <div
            className="px-6 py-4 flex items-center gap-4"
            style={{
                background: config.bg,
                borderBottom: `1px solid ${config.border}`
            }}
        >
            <span className="text-2xl">{config.icon}</span>
            <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: config.color }}>
                    {config.label}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {description}
                </p>
            </div>
            <button
                onClick={onAction}
                className="px-4 py-2 text-sm font-semibold rounded-lg transition-all hover:opacity-90"
                style={{
                    background: config.color,
                    color: 'white'
                }}
            >
                {config.cta}
            </button>
        </div>
    );
}
