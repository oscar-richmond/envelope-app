'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, Info, Mail, ArrowRight } from 'lucide-react';
import type { ThreadMessage } from './MessageThreadComposerModal';

interface ThreadMessagesProps {
    messages: ThreadMessage[];
    partial?: boolean;
    partialReason?: string;
    retryable?: boolean;
    onRetry: () => void;
    onComposeClick: () => void;
}

export function ThreadMessages({
    messages: messagesProp,
    partial,
    partialReason,
    retryable,
    onRetry,
    onComposeClick
}: ThreadMessagesProps) {
    // SAFE: ensure messages is always an array
    const messages = Array.isArray(messagesProp) ? messagesProp : [];
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (messages.length > 0) {
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        }
    }, [messages.length]);

    // Empty state
    if (messages.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full py-16 px-6">
                <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                    style={{ background: 'var(--bg-card-muted)' }}
                >
                    <Mail size={28} style={{ color: 'var(--text-muted)' }} />
                </div>
                <h3
                    className="text-lg font-semibold mb-2"
                    style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
                >
                    No thread yet
                </h3>
                <p
                    className="text-sm text-center max-w-sm mb-6"
                    style={{ color: 'var(--text-secondary)' }}
                >
                    Start the conversation by drafting your first email
                </p>
                <button
                    onClick={onComposeClick}
                    className="btn btn-primary"
                >
                    Draft First Email
                    <ArrowRight size={16} />
                </button>
            </div>
        );
    }

    return (
        <div
            className="h-full overflow-y-auto px-6 py-6 space-y-6"
            style={{ background: 'var(--bg-page)' }}
        >
            {/* Partial thread warning */}
            {partial && partialReason && (
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
                        {partialReason}
                    </p>
                    {retryable && (
                        <button
                            onClick={onRetry}
                            className="text-xs font-medium underline ml-2"
                            style={{ color: 'rgb(180, 120, 20)' }}
                        >
                            Retry
                        </button>
                    )}
                </div>
            )}

            {/* Messages */}
            {messages.map((msg, idx) => (
                <MessageCard
                    key={msg.id}
                    message={msg}
                    isLast={idx === messages.length - 1}
                />
            ))}

            <div ref={messagesEndRef} className="h-4" />
        </div>
    );
}

/**
 * Gmail-style Message Card with collapsible quoted text
 */
function MessageCard({ message, isLast }: { message: ThreadMessage; isLast: boolean }) {
    const [showQuoted, setShowQuoted] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const { mainBody, quotedText } = parseMessageBody(message.body);
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
                {(message.fromName || message.from || 'Unknown')?.[0]?.toUpperCase() || '?'}
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

function parseMessageBody(body: string): { mainBody: string; quotedText: string } {
    if (!body) return { mainBody: '', quotedText: '' };

    // Remove common headers
    let cleaned = body;
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
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
