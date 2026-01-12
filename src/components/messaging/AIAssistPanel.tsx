'use client';

import { useState } from 'react';
import { Loader2, Sparkles, MessageSquareText, Wand2, RefreshCw, X, ArrowRight } from 'lucide-react';
import type { ThreadData, ThreadMessage } from './MessageThreadComposerModal';

interface AIAssistPanelProps {
    emailId?: number;
    thread: ThreadData | null;
    summary: string | null;
    onSummaryChange: (summary: string | null) => void;
    suggestedReplies: string[];
    onSuggestedRepliesChange: (replies: string[]) => void;
    onInsert: (text: string) => void;
}

export function AIAssistPanel({
    emailId,
    thread,
    summary,
    onSummaryChange,
    suggestedReplies,
    onSuggestedRepliesChange,
    onInsert
}: AIAssistPanelProps) {
    const [summarizing, setSummarizing] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const hasMessages = (thread?.messages?.length ?? 0) > 0;

    function getThreadContent(): string {
        if (!thread?.messages) return '';
        return thread.messages.map(m =>
            `[${m.isOutbound ? 'SENT' : 'RECEIVED'}] ${m.fromName} (${formatRelativeTime(m.timestamp)}):\n${m.body}`
        ).join('\n\n---\n\n');
    }

    async function handleSummarize() {
        if (!emailId || !thread) return;
        setSummarizing(true);
        setError(null);

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
                onSummaryChange(data.result);
            } else {
                setError(data.error || 'Failed to summarize');
            }
        } catch (e) {
            setError('AI service unavailable');
        } finally {
            setSummarizing(false);
        }
    }

    async function handleGenerateReplies() {
        if (!emailId || !thread) return;
        setGenerating(true);
        setError(null);

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
                // For now, single reply - could expand to multiple variants
                onSuggestedRepliesChange([data.result]);
            } else {
                setError(data.error || 'Failed to generate reply');
            }
        } catch (e) {
            setError('AI service unavailable');
        } finally {
            setGenerating(false);
        }
    }

    return (
        <div className="h-full overflow-y-auto p-6 space-y-6" style={{ background: 'var(--bg-page)' }}>
            {/* Summary Section */}
            <div
                className="p-5 rounded-xl"
                style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-soft)'
                }}
            >
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <MessageSquareText size={18} style={{ color: 'rgb(139, 92, 246)' }} />
                        <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                            Thread Summary
                        </h3>
                    </div>
                    {hasMessages && (
                        <button
                            onClick={handleSummarize}
                            disabled={summarizing}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5"
                            style={{
                                background: 'var(--bg-card-muted)',
                                color: 'var(--text-secondary)'
                            }}
                        >
                            {summarizing ? (
                                <Loader2 size={12} className="animate-spin" />
                            ) : (
                                <RefreshCw size={12} />
                            )}
                            {summary ? 'Regenerate' : 'Generate'}
                        </button>
                    )}
                </div>

                {!hasMessages ? (
                    <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>
                        No thread yet — summary unavailable
                    </p>
                ) : summary ? (
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                        {summary}
                    </p>
                ) : (
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        Click "Generate" to create an AI summary of this conversation
                    </p>
                )}
            </div>

            {/* Suggested Replies */}
            <div
                className="p-5 rounded-xl"
                style={{
                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.04), rgba(59, 130, 246, 0.04))',
                    border: '1px solid rgba(139, 92, 246, 0.2)'
                }}
            >
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Wand2 size={18} style={{ color: 'rgb(139, 92, 246)' }} />
                        <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                            Suggested Reply
                        </h3>
                    </div>
                    {hasMessages && (
                        <button
                            onClick={handleGenerateReplies}
                            disabled={generating}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5"
                            style={{
                                background: 'rgba(139, 92, 246, 0.1)',
                                color: 'rgb(139, 92, 246)'
                            }}
                        >
                            {generating ? (
                                <Loader2 size={12} className="animate-spin" />
                            ) : (
                                <Sparkles size={12} />
                            )}
                            {suggestedReplies.length > 0 ? 'Regenerate' : 'Generate'}
                        </button>
                    )}
                </div>

                {!hasMessages ? (
                    <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>
                        Start a thread first to get AI reply suggestions
                    </p>
                ) : suggestedReplies.length > 0 ? (
                    <div className="space-y-3">
                        {suggestedReplies.map((reply, idx) => (
                            <div
                                key={idx}
                                className="p-4 rounded-lg"
                                style={{
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border-soft)'
                                }}
                            >
                                <p
                                    className="text-sm leading-relaxed mb-3 whitespace-pre-wrap"
                                    style={{ color: 'var(--text-primary)' }}
                                >
                                    {reply}
                                </p>
                                <button
                                    onClick={() => onInsert(reply)}
                                    className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5"
                                    style={{
                                        background: 'var(--brand-soft)',
                                        color: 'var(--brand)'
                                    }}
                                >
                                    Insert into Composer
                                    <ArrowRight size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        Click "Generate" to get AI-powered reply suggestions
                    </p>
                )}
            </div>

            {/* Error display */}
            {error && (
                <div
                    className="p-4 rounded-lg flex items-center gap-3"
                    style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)'
                    }}
                >
                    <p className="text-sm flex-1" style={{ color: 'rgb(239, 68, 68)' }}>{error}</p>
                    <button onClick={() => setError(null)} style={{ color: 'rgb(239, 68, 68)' }}>
                        <X size={14} />
                    </button>
                </div>
            )}
        </div>
    );
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
