'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Send, Clock, X, ArrowLeft, CheckCircle, Building2,
    Globe, MapPin, TrendingUp, DollarSign,
    ChevronRight, ExternalLink, RefreshCw
} from 'lucide-react';
import Link from 'next/link';

// Format date for display
function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}


interface QueueItem {
    id: number;
    followUpNumber: number;
    dueAt: string;
    priorityScore: number;
    draftVariant: string;
    draft: {
        subject: string;
        bodyText: string;
        bodyHtml: string | null;
    };
    recipient: {
        email: string;
        formatted: string;
    };
    company: {
        name: string;
        prospectId: number | null;
        websiteUrl: string | null;
        financialBand: string | null;
        opportunityBand: string | null;
        location?: string | null;
    };
    originalEmail: {
        id: number;
        subject: string;
        bodyText: string;
        sentAt: string;
        threadId: string | null;
    };
    priority: {
        score: number;
        reasonSummary: string | null;
        isOverdue: boolean;
    };
    leadId: number;
}

type ToneVariant = 'polite' | 'assertive' | 'ultra-soft';

const TONE_LABELS: Record<ToneVariant, { label: string; description: string }> = {
    'polite': { label: 'Polite', description: 'Calm, respectful, low pressure' },
    'assertive': { label: 'Assertive', description: 'Confident, direct' },
    'ultra-soft': { label: 'Ultra-Soft', description: 'Minimal, easy to ignore' }
};

export default function FollowUpQueuePage() {
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalCount, setTotalCount] = useState(0);
    const [completedCount, setCompletedCount] = useState(0);
    const [currentIndex, setCurrentIndex] = useState(0);

    // UI State
    const [sending, setSending] = useState(false);
    const [showSnoozeOptions, setShowSnoozeOptions] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [transitioning, setTransitioning] = useState(false);
    const [regenerating, setRegenerating] = useState(false);

    // Tone variant
    const [selectedTone, setSelectedTone] = useState<ToneVariant>('polite');

    // Editable content
    const [editedTo, setEditedTo] = useState('');
    const [editedSubject, setEditedSubject] = useState('');
    const [editedBody, setEditedBody] = useState('');
    const [hasUserEdited, setHasUserEdited] = useState(false);

    const currentItem = queue[currentIndex];

    useEffect(() => {
        fetchQueue();
    }, []);

    // Initialize editable content when current item changes
    useEffect(() => {
        if (currentItem) {
            setEditedTo(currentItem.recipient.email);
            setEditedSubject(currentItem.draft.subject);
            setEditedBody(currentItem.draft.bodyText);
            setShowSnoozeOptions(false);
            setIsEditing(false);
            setSelectedTone('polite');
            setHasUserEdited(false);
        }
    }, [currentItem?.id]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (showSnoozeOptions) return;
            if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault();
                    handleSend();
                }
                return;
            }

            switch (e.key.toLowerCase()) {
                case 'enter':
                    e.preventDefault();
                    handleSend();
                    break;
                case 's':
                    e.preventDefault();
                    setShowSnoozeOptions(true);
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentItem, sending, showSnoozeOptions]);

    async function fetchQueue() {
        setLoading(true);
        try {
            const res = await fetch('/api/follow-ups');
            const data = await res.json();
            if (data.items) {
                setQueue(data.items);
                setTotalCount(data.items.length);
                setCurrentIndex(0);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    const advanceToNext = useCallback(() => {
        setTransitioning(true);
        setTimeout(() => {
            setQueue(q => q.filter((_, i) => i !== currentIndex));
            if (currentIndex >= queue.length - 1) {
                setCurrentIndex(Math.max(0, currentIndex - 1));
            }
            setCompletedCount(c => c + 1);
            setTransitioning(false);
        }, 200);
    }, [currentIndex, queue.length]);

    const handleSend = async () => {
        if (!currentItem || sending) return;

        setSending(true);
        try {
            const res = await fetch(`/api/follow-ups/${currentItem.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subject: editedSubject,
                    bodyText: editedBody
                })
            });

            if (res.ok) {
                advanceToNext();
            } else {
                const data = await res.json();
                alert('Failed to send: ' + (data.error || 'Unknown error'));
            }
        } catch (e) {
            console.error(e);
            alert('Error sending follow-up');
        } finally {
            setSending(false);
        }
    };

    const handleSnooze = async (days: number) => {
        if (!currentItem) return;

        try {
            await fetch(`/api/follow-ups/${currentItem.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'SNOOZE', snoozeDays: days })
            });
            advanceToNext();
        } catch (e) {
            console.error(e);
        }
        setShowSnoozeOptions(false);
    };

    const handleRemove = async () => {
        if (!currentItem) return;

        try {
            await fetch(`/api/follow-ups/${currentItem.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'CLOSE' })
            });
            advanceToNext();
        } catch (e) {
            console.error(e);
        }
        setShowSnoozeOptions(false);
    };

    // Switch tone variant
    const handleToneChange = async (tone: ToneVariant) => {
        if (!currentItem || tone === selectedTone) return;

        // Warn if user has made edits
        if (hasUserEdited) {
            if (!confirm('Switching tone will replace your edits. Continue?')) {
                return;
            }
        }

        setRegenerating(true);
        setSelectedTone(tone);

        try {
            const res = await fetch(`/api/follow-ups/${currentItem.id}/variants?tone=${tone}`);
            const data = await res.json();

            if (data.body) {
                setEditedBody(data.body);
                setHasUserEdited(false);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setRegenerating(false);
        }
    };

    // Regenerate with varied phrasing
    const handleRegenerate = async () => {
        if (!currentItem) return;

        setRegenerating(true);
        try {
            const res = await fetch(`/api/follow-ups/${currentItem.id}/variants?tone=${selectedTone}&regenerate=true`);
            const data = await res.json();

            if (data.body) {
                setEditedBody(data.body);
                setHasUserEdited(false);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setRegenerating(false);
        }
    };

    // Track user edits
    const handleBodyChange = (value: string) => {
        setEditedBody(value);
        setHasUserEdited(true);
    };

    // Loading state
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[80vh]">
                <div style={{ color: 'var(--text-muted)' }} className="animate-pulse">Loading follow-ups...</div>
            </div>
        );
    }

    // Empty state - All caught up!
    if (queue.length === 0) {
        return (
            <div className="hero-surface hero-surface-mint flex flex-col items-center justify-center min-h-[80vh] mx-4 md:mx-auto max-w-xl my-12 p-12">
                <div
                    className="w-20 h-20 rounded-full flex items-center justify-center mb-8"
                    style={{ background: 'var(--mint-soft)', color: 'var(--mint-text)' }}
                >
                    <CheckCircle size={40} strokeWidth={1.5} />
                </div>
                <h1
                    className="text-3xl font-bold mb-3"
                    style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
                >
                    You're all caught up.
                </h1>
                <p className="mb-8 text-center max-w-md" style={{ color: 'var(--text-secondary)' }}>
                    {completedCount > 0
                        ? `You completed ${completedCount} follow-up${completedCount !== 1 ? 's' : ''} this session.`
                        : 'No follow-ups are due right now.'}
                </p>
                <div className="flex gap-3">
                    <Link href="/outreach/sent" className="btn btn-secondary">
                        <ArrowLeft size={18} strokeWidth={1.75} />
                        Back to Inbox
                    </Link>
                    <Link href="/prospects" className="btn btn-primary">
                        Find more leads
                        <ChevronRight size={18} strokeWidth={1.75} />
                    </Link>
                </div>
            </div>
        );
    }

    const progress = totalCount > 0 ? completedCount + 1 : 0;

    return (
        <div
            className={`min-h-screen transition-opacity duration-200 ${transitioning ? 'opacity-50' : 'opacity-100'}`}
            style={{ background: 'var(--bg-page)' }}
        >
            {/* Header */}
            <header
                className="px-6 py-4 sticky top-0 z-10"
                style={{
                    background: 'var(--bg-card)',
                    borderBottom: '1px solid var(--border-soft)'
                }}
            >
                <div className="max-w-3xl mx-auto flex items-center justify-between">
                    <div>
                        <h1
                            className="text-lg font-semibold"
                            style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
                        >
                            Follow-Up Queue
                        </h1>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            {queue.length} follow-up{queue.length !== 1 ? 's' : ''} remaining
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                            {progress} / {totalCount + completedCount}
                        </span>
                        <Link href="/outreach/sent" className="icon-btn icon-btn-ghost">
                            <X size={18} strokeWidth={1.75} />
                        </Link>
                    </div>
                </div>
            </header>

            {/* Main Card */}
            <main className="max-w-3xl mx-auto p-6">
                <div
                    className="overflow-hidden"
                    style={{
                        background: 'var(--bg-card)',
                        borderRadius: 'var(--radius-card)',
                        border: '1px solid var(--border-soft)',
                        boxShadow: 'var(--shadow-md)'
                    }}
                >
                    {/* Company Context */}
                    <div
                        className="px-6 py-5"
                        style={{
                            background: 'var(--bg-card-muted)',
                            borderBottom: '1px solid var(--border-soft)'
                        }}
                    >
                        <div className="flex items-start justify-between">
                            <div className="flex items-start gap-4">
                                <div
                                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)' }}
                                >
                                    <Building2 size={24} style={{ color: 'var(--text-muted)' }} />
                                </div>
                                <div>
                                    <h2
                                        className="font-semibold text-lg"
                                        style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
                                    >
                                        {currentItem.company.name}
                                    </h2>
                                    {currentItem.company.location && (
                                        <p className="text-sm flex items-center gap-1 mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                                            <MapPin size={12} />
                                            {currentItem.company.location}
                                        </p>
                                    )}
                                    {currentItem.company.websiteUrl && (
                                        <a
                                            href={currentItem.company.websiteUrl.startsWith('http')
                                                ? currentItem.company.websiteUrl
                                                : `https://${currentItem.company.websiteUrl}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm flex items-center gap-1 mt-1 transition-colors"
                                            style={{ color: 'var(--brand)' }}
                                            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--brand-hover)'}
                                            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--brand)'}
                                        >
                                            <Globe size={12} />
                                            Visit website
                                            <ExternalLink size={10} />
                                        </a>
                                    )}
                                </div>
                            </div>

                            {/* Compact Badges */}
                            <div className="flex gap-2 flex-wrap justify-end">
                                {currentItem.company.financialBand && (
                                    <span
                                        className="text-xs px-2.5 py-1 rounded-[var(--radius-badge)] flex items-center gap-1 font-medium"
                                        style={{
                                            background: currentItem.company.financialBand === 'excellent' || currentItem.company.financialBand === 'good'
                                                ? 'var(--mint-soft)'
                                                : 'var(--bg-card-muted)',
                                            color: currentItem.company.financialBand === 'excellent' || currentItem.company.financialBand === 'good'
                                                ? 'var(--mint-text)'
                                                : 'var(--text-secondary)',
                                            border: `1px solid ${currentItem.company.financialBand === 'excellent' || currentItem.company.financialBand === 'good'
                                                ? 'var(--chip-mint-border)'
                                                : 'var(--border-soft)'}`
                                        }}
                                    >
                                        <DollarSign size={10} />
                                        {currentItem.company.financialBand}
                                    </span>
                                )}
                                {currentItem.company.opportunityBand && (
                                    <span
                                        className="text-xs px-2.5 py-1 rounded-[var(--radius-badge)] flex items-center gap-1 font-medium"
                                        style={{
                                            background: currentItem.company.opportunityBand === 'High'
                                                ? 'var(--lilac-soft)'
                                                : 'var(--bg-card-muted)',
                                            color: currentItem.company.opportunityBand === 'High'
                                                ? 'var(--lilac-text)'
                                                : 'var(--text-secondary)',
                                            border: `1px solid ${currentItem.company.opportunityBand === 'High'
                                                ? 'var(--chip-lilac-border)'
                                                : 'var(--border-soft)'}`
                                        }}
                                    >
                                        <TrendingUp size={10} />
                                        {currentItem.company.opportunityBand}
                                    </span>
                                )}
                                {/* Follow-up step badge */}
                                <span
                                    className="text-xs px-2.5 py-1 rounded-[var(--radius-badge)] font-semibold"
                                    style={{
                                        background: 'var(--lilac-soft)',
                                        color: 'var(--lilac-text)',
                                        border: '1px solid var(--chip-lilac-border)'
                                    }}
                                >
                                    FU{currentItem.followUpNumber}
                                </span>
                                {/* Overdue/Due badge */}
                                {currentItem.priority.isOverdue ? (
                                    <span
                                        className="text-xs px-2.5 py-1 rounded-[var(--radius-badge)] flex items-center gap-1 font-medium"
                                        style={{
                                            background: 'var(--danger-soft)',
                                            color: 'var(--danger-text)',
                                            border: '1px solid var(--chip-danger-border)'
                                        }}
                                    >
                                        <Clock size={10} />
                                        Overdue
                                    </span>
                                ) : (
                                    <span
                                        className="text-xs px-2.5 py-1 rounded-[var(--radius-badge)] flex items-center gap-1 font-medium"
                                        style={{
                                            background: 'var(--brand-soft)',
                                            color: 'var(--brand)',
                                            border: '1px solid var(--brand-border)'
                                        }}
                                    >
                                        <Clock size={10} />
                                        Due Today
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Tone Selector */}
                    <div
                        className="px-6 py-3 flex items-center justify-between"
                        style={{
                            background: 'var(--bg-card-muted)',
                            borderBottom: '1px solid var(--border-soft)'
                        }}
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Tone:</span>
                            {(Object.keys(TONE_LABELS) as ToneVariant[]).map(tone => (
                                <button
                                    key={tone}
                                    onClick={() => handleToneChange(tone)}
                                    disabled={regenerating}
                                    className="text-xs px-3 py-1.5 rounded-full transition-all disabled:opacity-50"
                                    style={{
                                        background: selectedTone === tone ? 'var(--nav-bg)' : 'var(--bg-card)',
                                        color: selectedTone === tone ? 'white' : 'var(--text-secondary)',
                                        border: selectedTone === tone ? 'none' : '1px solid var(--border-soft)'
                                    }}
                                    title={TONE_LABELS[tone].description}
                                >
                                    {TONE_LABELS[tone].label}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={handleRegenerate}
                            disabled={regenerating}
                            className="text-xs flex items-center gap-1 px-2 py-1 rounded transition-all disabled:opacity-50"
                            style={{ color: 'var(--text-muted)' }}
                        >
                            <RefreshCw size={12} className={regenerating ? 'animate-spin' : ''} />
                            Regenerate
                        </button>
                    </div>

                    {/* Original Email Context */}
                    <div
                        className="px-6 py-3"
                        style={{
                            background: 'var(--brand-weak)',
                            borderBottom: '1px solid var(--brand-border)'
                        }}
                    >
                        <details className="group">
                            <summary
                                className="cursor-pointer text-xs font-medium flex items-center gap-2"
                                style={{ color: 'var(--brand)' }}
                            >
                                <ChevronRight size={14} className="transition-transform group-open:rotate-90" />
                                View Original Email (sent {formatDate(currentItem.originalEmail.sentAt)})
                            </summary>
                            <div
                                className="mt-3 p-4 rounded-lg text-sm leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto"
                                style={{
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--brand-border)',
                                    color: 'var(--text-primary)'
                                }}
                            >
                                <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                                    Subject: {currentItem.originalEmail.subject}
                                </div>
                                {currentItem.originalEmail.bodyText}
                            </div>
                        </details>
                    </div>

                    {/* Gmail-Style Composer */}
                    <div className="p-6">
                        {/* To Field */}
                        <div
                            className="flex items-center gap-3 py-3"
                            style={{ borderBottom: '1px solid var(--border-soft)' }}
                        >
                            <label className="text-sm w-12" style={{ color: 'var(--text-muted)' }}>To</label>
                            <input
                                type="email"
                                value={editedTo}
                                onChange={(e) => setEditedTo(e.target.value)}
                                disabled={!isEditing}
                                className="flex-1 text-sm bg-transparent border-none focus:outline-none focus:ring-0"
                                style={{ color: isEditing ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                            />
                        </div>

                        {/* Subject Field */}
                        <div
                            className="flex items-center gap-3 py-3"
                            style={{ borderBottom: '1px solid var(--border-soft)' }}
                        >
                            <label className="text-sm w-12" style={{ color: 'var(--text-muted)' }}>Subject</label>
                            <input
                                type="text"
                                value={editedSubject}
                                onChange={(e) => setEditedSubject(e.target.value)}
                                disabled={!isEditing}
                                className="flex-1 text-sm font-medium bg-transparent border-none focus:outline-none focus:ring-0"
                                style={{ color: 'var(--text-primary)' }}
                            />
                        </div>

                        {/* Body */}
                        <div className="pt-4">
                            <textarea
                                value={editedBody}
                                onChange={(e) => handleBodyChange(e.target.value)}
                                disabled={!isEditing && !regenerating}
                                rows={10}
                                className={`w-full resize-none outline-none leading-relaxed text-[15px] bg-transparent placeholder:text-[var(--text-muted)] ${regenerating ? 'opacity-50' : ''}`}
                                style={{ color: 'var(--text-primary)' }}
                                placeholder="Write your follow-up..."
                            />
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div
                        className="px-6 py-5"
                        style={{
                            background: 'var(--bg-card-muted)',
                            borderTop: '1px solid var(--border-soft)'
                        }}
                    >
                        {showSnoozeOptions ? (
                            // Snooze Options
                            <div className="flex items-center justify-center gap-3">
                                <span className="text-sm mr-2" style={{ color: 'var(--text-secondary)' }}>Remind me:</span>
                                <button
                                    onClick={() => handleSnooze(3)}
                                    className="btn btn-secondary btn-sm"
                                >
                                    In 3 days
                                </button>
                                <button
                                    onClick={() => handleSnooze(7)}
                                    className="btn btn-secondary btn-sm"
                                >
                                    In 7 days
                                </button>
                                <button
                                    onClick={handleRemove}
                                    className="btn btn-danger btn-sm"
                                >
                                    Remove
                                </button>
                                <button
                                    onClick={() => setShowSnoozeOptions(false)}
                                    className="btn btn-ghost btn-sm"
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            // Main Actions
                            <div className="flex items-center justify-between">
                                <button
                                    onClick={() => setShowSnoozeOptions(true)}
                                    className="btn btn-ghost"
                                >
                                    <Clock size={16} strokeWidth={1.75} />
                                    Skip / Snooze
                                </button>

                                <div className="flex items-center gap-3">
                                    {isEditing ? (
                                        <button
                                            onClick={handleSend}
                                            disabled={sending}
                                            className="btn btn-primary btn-lg"
                                        >
                                            {sending ? 'Sending...' : (
                                                <>
                                                    <Send size={18} strokeWidth={1.75} />
                                                    Send Follow-Up
                                                </>
                                            )}
                                        </button>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => setIsEditing(true)}
                                                className="btn btn-secondary"
                                            >
                                                Edit & Send
                                            </button>
                                            <button
                                                onClick={handleSend}
                                                disabled={sending}
                                                className="btn btn-primary btn-lg"
                                            >
                                                {sending ? 'Sending...' : (
                                                    <>
                                                        <Send size={18} strokeWidth={1.75} />
                                                        Send Follow-Up
                                                    </>
                                                )}
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
