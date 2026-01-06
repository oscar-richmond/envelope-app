'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Send, Clock, X, ArrowLeft, CheckCircle, Building2,
    Globe, MapPin, TrendingUp, Palette, DollarSign,
    ChevronRight, ExternalLink
} from 'lucide-react';
import Link from 'next/link';

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

    // Editable content
    const [editedTo, setEditedTo] = useState('');
    const [editedSubject, setEditedSubject] = useState('');
    const [editedBody, setEditedBody] = useState('');

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

    // Loading state
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[80vh]">
                <div className="text-gray-400 animate-pulse">Loading follow-ups...</div>
            </div>
        );
    }

    // Empty state - All caught up!
    if (queue.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
                <div className="bg-green-100 text-green-600 w-20 h-20 rounded-full flex items-center justify-center mb-8">
                    <CheckCircle size={40} strokeWidth={1.5} />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-3">You're all caught up.</h1>
                <p className="text-gray-500 mb-8 text-center max-w-md">
                    {completedCount > 0
                        ? `You completed ${completedCount} follow-up${completedCount !== 1 ? 's' : ''} this session.`
                        : 'No follow-ups are due right now.'}
                </p>
                <div className="flex gap-3">
                    <Link
                        href="/outreach/sent"
                        className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-6 py-3 rounded-lg font-medium flex items-center gap-2 shadow-sm"
                    >
                        <ArrowLeft size={18} />
                        Back to Inbox
                    </Link>
                    <Link
                        href="/prospects"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 shadow-sm"
                    >
                        Find more leads
                        <ChevronRight size={18} />
                    </Link>
                </div>
            </div>
        );
    }

    const progress = totalCount > 0 ? completedCount + 1 : 0;

    return (
        <div className={`min-h-screen bg-gray-50 transition-opacity duration-200 ${transitioning ? 'opacity-50' : 'opacity-100'}`}>
            {/* Header */}
            <header className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="max-w-3xl mx-auto flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-semibold text-gray-900">Follow-Up Queue</h1>
                        <p className="text-sm text-gray-500">{queue.length} follow-up{queue.length !== 1 ? 's' : ''} remaining</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-400">{progress} / {totalCount + completedCount}</span>
                        <Link
                            href="/outreach/sent"
                            className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                            <X size={20} />
                        </Link>
                    </div>
                </div>
            </header>

            {/* Main Card */}
            <main className="max-w-3xl mx-auto p-6">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    {/* Company Context */}
                    <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                        <div className="flex items-start justify-between">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400">
                                    <Building2 size={24} />
                                </div>
                                <div>
                                    <h2 className="font-semibold text-lg text-gray-900">{currentItem.company.name}</h2>
                                    {currentItem.company.location && (
                                        <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
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
                                            className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1 mt-1"
                                        >
                                            <Globe size={12} />
                                            Visit website
                                            <ExternalLink size={10} />
                                        </a>
                                    )}
                                </div>
                            </div>

                            {/* Compact Badges */}
                            <div className="flex gap-2">
                                {currentItem.company.financialBand && (
                                    <span className={`text-xs px-2.5 py-1 rounded-full flex items-center gap-1 ${currentItem.company.financialBand === 'excellent' ? 'bg-green-100 text-green-700' :
                                            currentItem.company.financialBand === 'good' ? 'bg-emerald-100 text-emerald-700' :
                                                'bg-gray-100 text-gray-600'
                                        }`}>
                                        <DollarSign size={10} />
                                        {currentItem.company.financialBand}
                                    </span>
                                )}
                                {currentItem.company.opportunityBand && (
                                    <span className={`text-xs px-2.5 py-1 rounded-full flex items-center gap-1 ${currentItem.company.opportunityBand === 'High' ? 'bg-indigo-100 text-indigo-700' :
                                            currentItem.company.opportunityBand === 'Medium' ? 'bg-amber-100 text-amber-700' :
                                                'bg-gray-100 text-gray-600'
                                        }`}>
                                        <TrendingUp size={10} />
                                        {currentItem.company.opportunityBand}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Gmail-Style Composer */}
                    <div className="p-6">
                        {/* To Field */}
                        <div className="flex items-center gap-3 py-3 border-b border-gray-100">
                            <label className="text-sm text-gray-400 w-12">To</label>
                            <input
                                type="email"
                                value={editedTo}
                                onChange={(e) => setEditedTo(e.target.value)}
                                disabled={!isEditing}
                                className="flex-1 text-sm text-gray-700 bg-transparent border-none focus:outline-none focus:ring-0 disabled:text-gray-500"
                            />
                        </div>

                        {/* Subject Field */}
                        <div className="flex items-center gap-3 py-3 border-b border-gray-100">
                            <label className="text-sm text-gray-400 w-12">Subject</label>
                            <input
                                type="text"
                                value={editedSubject}
                                onChange={(e) => setEditedSubject(e.target.value)}
                                disabled={!isEditing}
                                className="flex-1 text-sm font-medium text-gray-800 bg-transparent border-none focus:outline-none focus:ring-0 disabled:text-gray-700"
                            />
                        </div>

                        {/* Body */}
                        <div className="pt-4">
                            <textarea
                                value={editedBody}
                                onChange={(e) => setEditedBody(e.target.value)}
                                disabled={!isEditing}
                                rows={10}
                                className="w-full resize-none outline-none text-gray-800 leading-relaxed text-[15px] bg-transparent disabled:text-gray-700 placeholder:text-gray-400"
                                placeholder="Write your follow-up..."
                            />
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="px-6 py-5 border-t border-gray-100 bg-gray-50">
                        {showSnoozeOptions ? (
                            // Snooze Options
                            <div className="flex items-center justify-center gap-3">
                                <span className="text-sm text-gray-500 mr-2">Remind me:</span>
                                <button
                                    onClick={() => handleSnooze(3)}
                                    className="bg-white border border-gray-200 hover:border-amber-300 hover:bg-amber-50 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
                                >
                                    In 3 days
                                </button>
                                <button
                                    onClick={() => handleSnooze(7)}
                                    className="bg-white border border-gray-200 hover:border-amber-300 hover:bg-amber-50 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
                                >
                                    In 7 days
                                </button>
                                <button
                                    onClick={handleRemove}
                                    className="bg-white border border-gray-200 hover:border-red-200 hover:bg-red-50 text-gray-500 hover:text-red-600 px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
                                >
                                    Remove
                                </button>
                                <button
                                    onClick={() => setShowSnoozeOptions(false)}
                                    className="text-gray-400 hover:text-gray-600 text-sm px-3 py-2"
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            // Main Actions
                            <div className="flex items-center justify-between">
                                <button
                                    onClick={() => setShowSnoozeOptions(true)}
                                    className="text-gray-500 hover:text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-white transition-all"
                                >
                                    <Clock size={16} />
                                    Skip / Snooze
                                </button>

                                <div className="flex items-center gap-3">
                                    {isEditing ? (
                                        <button
                                            onClick={handleSend}
                                            disabled={sending}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-lg font-medium flex items-center gap-2 shadow-sm disabled:opacity-50 transition-all"
                                        >
                                            {sending ? 'Sending...' : (
                                                <>
                                                    <Send size={18} />
                                                    Send Follow-Up
                                                </>
                                            )}
                                        </button>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => setIsEditing(true)}
                                                className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-5 py-3 rounded-lg font-medium transition-all"
                                            >
                                                Edit & Send
                                            </button>
                                            <button
                                                onClick={handleSend}
                                                disabled={sending}
                                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-lg font-medium flex items-center gap-2 shadow-sm disabled:opacity-50 transition-all"
                                            >
                                                {sending ? 'Sending...' : (
                                                    <>
                                                        <Send size={18} />
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
