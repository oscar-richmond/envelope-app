'use client';

import { useState } from 'react';
import { Loader2, Sparkles, MessageSquareText, Wand2, RefreshCw, X, ArrowRight, Type, Zap, MessageCircle, Mail, PenTool, Building2 } from 'lucide-react';
import type { ThreadData, ThreadMessage } from './MessageThreadComposerModal';

interface AIAssistPanelProps {
    emailId?: number;
    companyId?: number;
    thread: ThreadData | null;
    summary: string | null;
    onSummaryChange: (summary: string | null) => void;
    suggestedReplies: string[];
    onSuggestedRepliesChange: (replies: string[]) => void;
    onInsert: (text: string) => void;
    // New props for enhanced AI
    currentDraft?: string;
    onDraftChange?: (draft: string) => void;
    onSubjectChange?: (subject: string) => void;
    // Company context for outreach mode
    companyContext?: {
        websiteSignals?: string[];
        financialSignals?: string[];
        offering?: string;
        industry?: string;
    };
}

// Rewrite styles
const REWRITE_STYLES = [
    { id: 'shorter', label: 'Shorter', icon: '✂️' },
    { id: 'clearer', label: 'Clearer', icon: '💡' },
    { id: 'confident', label: 'More Confident', icon: '💪' },
    { id: 'friendly', label: 'More Friendly', icon: '😊' },
    { id: 'direct', label: 'More Direct', icon: '🎯' }
];

// Tone presets
const TONE_PRESETS = [
    { id: 'polite', label: 'Polite' },
    { id: 'assertive', label: 'Assertive' },
    { id: 'ultra-soft', label: 'Ultra-soft' }
];

// Quick snippets
const QUICK_SNIPPETS = [
    { id: 'chat', label: '15-min chat?', text: 'Would you be open to a quick 15-minute chat this week?' },
    { id: 'ideas', label: 'Send ideas', text: 'Happy to send over a few ideas that might help.' },
    { id: 'intro', label: 'Quick intro', text: 'I came across your company and thought I would reach out.' },
    { id: 'follow-up', label: 'Following up', text: 'Just wanted to follow up on my previous message.' },
    { id: 'thanks', label: 'Thanks', text: 'Thanks for taking the time to consider this.' }
];

export function AIAssistPanel({
    emailId,
    companyId,
    thread,
    summary,
    onSummaryChange,
    suggestedReplies,
    onSuggestedRepliesChange,
    onInsert,
    currentDraft,
    onDraftChange,
    onSubjectChange,
    companyContext
}: AIAssistPanelProps) {
    const [summarizing, setSummarizing] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [rewriting, setRewriting] = useState(false);
    const [generatingSubjects, setGeneratingSubjects] = useState(false);
    const [selectedTone, setSelectedTone] = useState<string>('polite');
    const [subjectSuggestions, setSubjectSuggestions] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    const hasMessages = (thread?.messages?.length ?? 0) > 0;
    const hasDraft = !!currentDraft && currentDraft.trim().length > 0;

    function getThreadContent(): string {
        if (!thread?.messages) return '';
        return thread.messages.map(m =>
            `[${m.isOutbound ? 'SENT' : 'RECEIVED'}] ${m.fromName} (${formatRelativeTime(m.timestamp)}):\n${m.body}`
        ).join('\n\n---\n\n');
    }

    async function handleSummarize() {
        // Outreach mode: summarize company
        if (!hasMessages && thread?.company) {
            setSummarizing(true);
            setError(null);
            try {
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
                    onSummaryChange(data.result);
                } else {
                    setError(data.error || 'Failed to summarize');
                }
            } catch (e) {
                setError('AI service unavailable');
            } finally {
                setSummarizing(false);
            }
            return;
        }

        // Reply mode: summarize thread
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
        // Outreach mode: draft outreach
        if (!hasMessages && thread?.company) {
            setGenerating(true);
            setError(null);
            try {
                const res = await fetch('/api/ai/outreach', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'draft_outreach',
                        companyName: thread.company.name,
                        contactName: thread.contact?.name,
                        contactEmail: thread.contact?.email,
                        context: companyContext,
                        tone: selectedTone
                    })
                });
                const data = await res.json();
                if (data.success) {
                    onSuggestedRepliesChange([data.result]);
                } else {
                    setError(data.error || 'Failed to generate draft');
                }
            } catch (e) {
                setError('AI service unavailable');
            } finally {
                setGenerating(false);
            }
            return;
        }

        // Reply mode: suggest reply
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
                    contactName: thread.contact.name,
                    tone: selectedTone
                })
            });

            const data = await res.json();
            if (data.success) {
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

    async function handleRewrite(style: string) {
        if (!currentDraft || !onDraftChange) return;
        setRewriting(true);
        setError(null);

        try {
            const res = await fetch('/api/ai/rewrite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: currentDraft,
                    style,
                    companyName: thread?.company?.name,
                    contactName: thread?.contact?.name
                })
            });

            const data = await res.json();
            if (data.success && data.result) {
                onDraftChange(data.result);
            } else {
                setError(data.error || 'Failed to rewrite');
            }
        } catch (e) {
            setError('AI service unavailable');
        } finally {
            setRewriting(false);
        }
    }

    async function handleGenerateSubjects() {
        if (!thread) return;
        setGeneratingSubjects(true);
        setError(null);

        try {
            const res = await fetch('/api/ai/subject', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    companyName: thread.company.name,
                    contactName: thread.contact.name,
                    content: currentDraft || '',
                    count: 5
                })
            });

            const data = await res.json();
            if (data.success && data.subjects) {
                setSubjectSuggestions(data.subjects);
            } else {
                setError(data.error || 'Failed to generate subjects');
            }
        } catch (e) {
            setError('AI service unavailable');
        } finally {
            setGeneratingSubjects(false);
        }
    }

    function handleInsertSnippet(text: string) {
        onInsert(text);
    }

    function handleSelectSubject(subject: string) {
        if (onSubjectChange) {
            onSubjectChange(subject);
        }
        setSubjectSuggestions([]);
    }

    return (
        <div className="h-full overflow-y-auto p-6 space-y-5" style={{ background: 'var(--bg-page)' }}>
            {/* Rewrite Tools */}
            {hasDraft && onDraftChange && (
                <div
                    className="p-4 rounded-xl"
                    style={{
                        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05), rgba(139, 92, 246, 0.05))',
                        border: '1px solid rgba(59, 130, 246, 0.2)'
                    }}
                >
                    <div className="flex items-center gap-2 mb-3">
                        <PenTool size={16} style={{ color: 'rgb(59, 130, 246)' }} />
                        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                            Rewrite Draft
                        </h3>
                        {rewriting && <Loader2 size={14} className="animate-spin text-blue-500" />}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {REWRITE_STYLES.map(style => (
                            <button
                                key={style.id}
                                onClick={() => handleRewrite(style.id)}
                                disabled={rewriting}
                                className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all hover:bg-blue-100"
                                style={{
                                    background: 'white',
                                    color: 'rgb(59, 130, 246)',
                                    border: '1px solid rgba(59, 130, 246, 0.3)'
                                }}
                            >
                                {style.icon} {style.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Tone Toggle */}
            <div
                className="p-4 rounded-xl"
                style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-soft)'
                }}
            >
                <div className="flex items-center gap-2 mb-3">
                    <MessageCircle size={16} style={{ color: 'var(--text-muted)' }} />
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        Tone
                    </h3>
                </div>
                <div className="flex gap-2">
                    {TONE_PRESETS.map(tone => (
                        <button
                            key={tone.id}
                            onClick={() => setSelectedTone(tone.id)}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
                            style={{
                                background: selectedTone === tone.id ? 'var(--brand-soft)' : 'var(--bg-card-muted)',
                                color: selectedTone === tone.id ? 'var(--brand)' : 'var(--text-secondary)',
                                border: selectedTone === tone.id ? '1px solid var(--brand)' : '1px solid transparent'
                            }}
                        >
                            {tone.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Subject Line Generator */}
            {onSubjectChange && (
                <div
                    className="p-4 rounded-xl"
                    style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-soft)'
                    }}
                >
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Mail size={16} style={{ color: 'rgb(234, 179, 8)' }} />
                            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                                Subject Lines
                            </h3>
                        </div>
                        <button
                            onClick={handleGenerateSubjects}
                            disabled={generatingSubjects}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5"
                            style={{
                                background: 'rgba(234, 179, 8, 0.1)',
                                color: 'rgb(202, 138, 4)'
                            }}
                        >
                            {generatingSubjects ? (
                                <Loader2 size={12} className="animate-spin" />
                            ) : (
                                <Sparkles size={12} />
                            )}
                            Generate
                        </button>
                    </div>
                    {subjectSuggestions.length > 0 ? (
                        <div className="space-y-2">
                            {subjectSuggestions.map((subject, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleSelectSubject(subject)}
                                    className="w-full text-left text-sm p-2 rounded-lg hover:bg-gray-50 transition"
                                    style={{ color: 'var(--text-primary)' }}
                                >
                                    {subject}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            Click Generate for AI subject line suggestions
                        </p>
                    )}
                </div>
            )}

            {/* Quick Snippets */}
            <div
                className="p-4 rounded-xl"
                style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-soft)'
                }}
            >
                <div className="flex items-center gap-2 mb-3">
                    <Zap size={16} style={{ color: 'rgb(16, 185, 129)' }} />
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        Quick Snippets
                    </h3>
                </div>
                <div className="flex flex-wrap gap-2">
                    {QUICK_SNIPPETS.map(snippet => (
                        <button
                            key={snippet.id}
                            onClick={() => handleInsertSnippet(snippet.text)}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all hover:bg-green-100"
                            style={{
                                background: 'rgba(16, 185, 129, 0.1)',
                                color: 'rgb(16, 185, 129)'
                            }}
                        >
                            {snippet.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Company/Thread Summary */}
            <div
                className="p-4 rounded-xl"
                style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-soft)'
                }}
            >
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        {hasMessages ? (
                            <MessageSquareText size={16} style={{ color: 'rgb(139, 92, 246)' }} />
                        ) : (
                            <Building2 size={16} style={{ color: 'rgb(139, 92, 246)' }} />
                        )}
                        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {hasMessages ? 'Thread Summary' : 'Company Snapshot'}
                        </h3>
                    </div>
                    {(hasMessages || thread?.company) && (
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

                {summary ? (
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                        {summary}
                    </p>
                ) : thread?.company ? (
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {hasMessages
                            ? 'Click "Generate" for an AI summary of the thread'
                            : 'Click "Generate" for an AI snapshot of this company'
                        }
                    </p>
                ) : (
                    <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>
                        No company selected
                    </p>
                )}
            </div>

            {/* Suggested Reply / Draft Outreach */}
            <div
                className="p-4 rounded-xl"
                style={{
                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.04), rgba(59, 130, 246, 0.04))',
                    border: '1px solid rgba(139, 92, 246, 0.2)'
                }}
            >
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Wand2 size={16} style={{ color: 'rgb(139, 92, 246)' }} />
                        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {hasMessages ? 'Suggested Reply' : 'Draft Outreach'}
                        </h3>
                    </div>
                    {(hasMessages || thread?.company) && (
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

                {suggestedReplies.length > 0 ? (
                    <div className="space-y-3">
                        {suggestedReplies.map((reply, idx) => (
                            <div
                                key={idx}
                                className="p-3 rounded-lg"
                                style={{
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border-soft)'
                                }}
                            >
                                <p className="text-sm leading-relaxed mb-2 whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>
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
                                    Insert <ArrowRight size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : thread?.company ? (
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {hasMessages
                            ? 'Click "Generate" for AI reply suggestions'
                            : 'Click "Generate" for an AI-drafted first outreach'
                        }
                    </p>
                ) : (
                    <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>
                        No company selected
                    </p>
                )}
            </div>

            {/* Error display */}
            {error && (
                <div
                    className="p-3 rounded-lg flex items-center gap-3"
                    style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)'
                    }}
                >
                    <p className="text-xs flex-1" style={{ color: 'rgb(239, 68, 68)' }}>{error}</p>
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
