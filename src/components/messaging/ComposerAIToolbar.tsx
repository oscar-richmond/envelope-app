'use client';

import { useState, useCallback } from 'react';
import { Sparkles, MessageSquareText, Wand2, Loader2 } from 'lucide-react';
import type { ThreadData } from './MessageThreadComposerModal';

interface ComposerAIToolbarProps {
    emailId?: number;
    thread: ThreadData | null;
    companyContext?: {
        websiteSignals?: string[];
        financialSignals?: string[];
        offering?: string;
        industry?: string;
    };
    onSummaryGenerated?: (summary: string) => void;
    onRepliesGenerated?: (replies: string[]) => void;
    onDraftGenerated?: (draft: string) => void;
}

function formatRelativeTime(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

/**
 * ComposerAIToolbar
 * 
 * Compact AI toolbar for the Compose tab with 3 CTAs:
 * - Summarize: Thread summary or company context summary
 * - Suggest Reply: Disabled without thread, generates reply suggestions
 * - AI Draft: Generates full draft for editor
 */
export function ComposerAIToolbar({
    emailId,
    thread,
    companyContext,
    onSummaryGenerated,
    onRepliesGenerated,
    onDraftGenerated
}: ComposerAIToolbarProps) {
    const [summarizing, setSummarizing] = useState(false);
    const [suggesting, setSuggesting] = useState(false);
    const [drafting, setDrafting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const hasMessages = (thread?.messages?.length ?? 0) > 0;
    const isLoading = summarizing || suggesting || drafting;

    // Build thread content for API
    const getThreadContent = useCallback((): string => {
        if (!thread?.messages) return '';
        return thread.messages.map(m =>
            `[${m.isOutbound ? 'SENT' : 'RECEIVED'}] ${m.fromName} (${formatRelativeTime(m.timestamp)}):\n${m.body}`
        ).join('\n\n---\n\n');
    }, [thread]);

    // Summarize - works with or without thread
    const handleSummarize = useCallback(async () => {
        setSummarizing(true);
        setError(null);

        try {
            // Outreach mode: summarize company
            if (!hasMessages && thread?.company) {
                const res = await fetch('/api/ai/outreach', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'summarize_company',
                        companyName: thread.company.name,
                        context: companyContext
                    })
                });
                const data = await res.json();
                if (data.success) {
                    onSummaryGenerated?.(data.result);
                } else {
                    setError(data.error || 'Failed to summarize');
                }
                return;
            }

            // Thread mode: summarize conversation
            if (emailId && thread) {
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
                    onSummaryGenerated?.(data.result);
                } else {
                    setError(data.error || 'Failed to summarize');
                }
            }
        } catch (e) {
            setError('AI service unavailable');
        } finally {
            setSummarizing(false);
        }
    }, [emailId, thread, hasMessages, companyContext, getThreadContent, onSummaryGenerated]);

    // Suggest Reply - requires thread
    const handleSuggestReply = useCallback(async () => {
        if (!hasMessages) return;

        setSuggesting(true);
        setError(null);

        try {
            if (emailId && thread) {
                const res = await fetch(`/api/outreach/sent/${emailId}/ai`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'suggest_replies',
                        threadContent: getThreadContent(),
                        companyName: thread.company.name,
                        contactName: thread.contact.name
                    })
                });
                const data = await res.json();
                if (data.success && data.replies) {
                    onRepliesGenerated?.(data.replies);
                } else {
                    setError(data.error || 'Failed to generate suggestions');
                }
            }
        } catch (e) {
            setError('AI service unavailable');
        } finally {
            setSuggesting(false);
        }
    }, [emailId, thread, hasMessages, getThreadContent, onRepliesGenerated]);

    // AI Draft - works with or without thread
    const handleAIDraft = useCallback(async () => {
        setDrafting(true);
        setError(null);

        try {
            // Outreach mode: generate cold draft
            if (!hasMessages && thread?.company) {
                const res = await fetch('/api/ai/outreach', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'draft_outreach',
                        companyName: thread.company.name,
                        contactName: thread.contact?.name,
                        context: companyContext
                    })
                });
                const data = await res.json();
                if (data.success) {
                    onDraftGenerated?.(data.result);
                } else {
                    setError(data.error || 'Failed to generate draft');
                }
                return;
            }

            // Thread mode: generate reply
            if (emailId && thread) {
                const res = await fetch(`/api/outreach/sent/${emailId}/ai`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'generate_draft',
                        threadContent: getThreadContent(),
                        companyName: thread.company.name,
                        contactName: thread.contact.name
                    })
                });
                const data = await res.json();
                if (data.success) {
                    onDraftGenerated?.(data.result || data.draft);
                } else {
                    setError(data.error || 'Failed to generate draft');
                }
            }
        } catch (e) {
            setError('AI service unavailable');
        } finally {
            setDrafting(false);
        }
    }, [emailId, thread, hasMessages, companyContext, getThreadContent, onDraftGenerated]);

    return (
        <div
            className="flex items-center gap-2 py-3 px-4 border-b"
            style={{
                background: 'linear-gradient(to right, rgba(139, 92, 246, 0.06), rgba(139, 92, 246, 0.02))',
                borderColor: 'rgba(139, 92, 246, 0.15)'
            }}
        >
            {/* AI Toolbar Label */}
            <span
                className="text-xs font-bold uppercase tracking-wider px-2 py-1 rounded"
                style={{
                    background: 'rgba(139, 92, 246, 0.12)',
                    color: 'rgb(139, 92, 246)'
                }}
            >
                ✨ AI Assist
            </span>

            {/* Summarize */}
            <button
                onClick={handleSummarize}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                    background: 'white',
                    color: 'rgb(99, 102, 241)',
                    border: '1px solid rgba(99, 102, 241, 0.25)',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgb(238, 242, 255)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; }}
                title={hasMessages ? 'Summarize thread' : 'Company snapshot'}
            >
                {summarizing ? (
                    <Loader2 size={13} className="animate-spin" />
                ) : (
                    <Sparkles size={13} />
                )}
                {hasMessages ? 'Summarize' : 'Snapshot'}
            </button>

            {/* Suggest Reply */}
            <button
                onClick={handleSuggestReply}
                disabled={isLoading || !hasMessages}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                    background: 'white',
                    color: hasMessages ? 'rgb(99, 102, 241)' : 'rgb(156, 163, 175)',
                    border: `1px solid ${hasMessages ? 'rgba(99, 102, 241, 0.25)' : 'rgba(156, 163, 175, 0.25)'}`,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}
                onMouseEnter={(e) => { if (hasMessages) e.currentTarget.style.background = 'rgb(238, 242, 255)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; }}
                title={hasMessages ? 'Suggest reply options' : 'Requires an email thread'}
            >
                {suggesting ? (
                    <Loader2 size={13} className="animate-spin" />
                ) : (
                    <MessageSquareText size={13} />
                )}
                Suggest Reply
            </button>

            {/* AI Draft */}
            <button
                onClick={handleAIDraft}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                    background: 'rgb(99, 102, 241)',
                    color: 'white',
                    border: '1px solid rgb(99, 102, 241)',
                    boxShadow: '0 1px 3px rgba(99, 102, 241, 0.3)'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgb(79, 70, 229)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgb(99, 102, 241)'; }}
                title={hasMessages ? 'Generate reply draft' : 'Generate outreach draft'}
            >
                {drafting ? (
                    <Loader2 size={13} className="animate-spin" />
                ) : (
                    <Wand2 size={13} />
                )}
                AI Draft
            </button>

            {/* Error indicator */}
            {error && (
                <span className="text-xs ml-2 px-2 py-1 rounded" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'rgb(239, 68, 68)' }}>
                    {error}
                </span>
            )}
        </div>
    );
}
