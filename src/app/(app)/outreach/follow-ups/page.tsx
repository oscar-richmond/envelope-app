'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Send, Clock, X, XCircle, ChevronDown, ChevronUp,
    CheckCircle, Building2, Calendar, TrendingUp,
    Mail, Zap
} from 'lucide-react';
import { SnoozeModal } from '@/components/outreach/SnoozeModal';
import { CompanyProfilePopup } from '@/components/company/CompanyProfilePopup';

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
    const [completedCount, setCompletedCount] = useState(0);
    const [currentIndex, setCurrentIndex] = useState(0);

    // UI State
    const [sending, setSending] = useState(false);
    const [showSnoozeModal, setShowSnoozeModal] = useState(false);
    const [showThread, setShowThread] = useState(false);
    const [showCompanyProfile, setShowCompanyProfile] = useState(false);
    const [toast, setToast] = useState<string | null>(null);

    // Editable content
    const [editedSubject, setEditedSubject] = useState('');
    const [editedBody, setEditedBody] = useState('');
    const [selectedVariant, setSelectedVariant] = useState<'callFirst' | 'emailIdeasFirst'>('callFirst');

    const currentItem = queue[currentIndex];

    useEffect(() => {
        fetchQueue();
    }, []);

    // Initialize editable content when current item changes
    useEffect(() => {
        if (currentItem) {
            setEditedSubject(currentItem.draft.subject);
            setEditedBody(currentItem.draft.bodyText);
            setShowThread(false);
            setSelectedVariant('callFirst');
        }
    }, [currentItem?.id]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (showSnoozeModal || showCompanyProfile) return;

            // Don't trigger if user is typing in input/textarea
            if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
                // Allow Cmd/Ctrl+Enter to send
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
                    setShowSnoozeModal(true);
                    break;
                case 'x':
                    e.preventDefault();
                    handleSkip();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentItem, sending, showSnoozeModal, showCompanyProfile]);

    async function fetchQueue() {
        setLoading(true);
        try {
            const res = await fetch('/api/follow-ups');
            const data = await res.json();
            if (data.items) {
                setQueue(data.items);
                setCurrentIndex(0);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    const showToast = (message: string) => {
        setToast(message);
        setTimeout(() => setToast(null), 2500);
    };

    const advanceToNext = () => {
        // Remove current item from queue
        setQueue(q => q.filter((_, i) => i !== currentIndex));
        // If we were at the end, go back one
        if (currentIndex >= queue.length - 1) {
            setCurrentIndex(Math.max(0, currentIndex - 1));
        }
    };

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
                setCompletedCount(c => c + 1);
                showToast('Follow-up sent ✓');
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
            const res = await fetch(`/api/follow-ups/${currentItem.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'SNOOZE', snoozeDays: days })
            });

            if (res.ok) {
                showToast(`Snoozed for ${days} business days`);
                advanceToNext();
            }
        } catch (e) {
            console.error(e);
        }
        setShowSnoozeModal(false);
    };

    const handleSkip = async () => {
        if (!currentItem) return;

        try {
            const res = await fetch(`/api/follow-ups/${currentItem.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'SKIP' })
            });

            if (res.ok) {
                showToast('Skipped');
                advanceToNext();
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleClose = async () => {
        if (!currentItem) return;

        try {
            const res = await fetch(`/api/follow-ups/${currentItem.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'CLOSE' })
            });

            if (res.ok) {
                showToast('Thread closed');
                advanceToNext();
            }
        } catch (e) {
            console.error(e);
        }
    };

    const loadVariant = async (variant: 'callFirst' | 'emailIdeasFirst') => {
        if (!currentItem) return;

        try {
            const res = await fetch(`/api/follow-ups/${currentItem.id}`);
            const data = await res.json();

            if (data.variants) {
                setEditedBody(data.variants[variant].bodyText);
                setSelectedVariant(variant);
            }
        } catch (e) {
            console.error(e);
        }
    };

    // Loading state
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-gray-400 animate-pulse">Loading follow-ups...</div>
            </div>
        );
    }

    // Empty state
    if (queue.length === 0) {
        return (
            <div className="max-w-2xl mx-auto mt-20 text-center">
                <div className="bg-green-100 text-green-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle size={32} />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">All caught up!</h1>
                <p className="text-gray-500 mb-8">You've cleared your follow-up queue.</p>
                {completedCount > 0 && (
                    <div className="text-sm text-gray-400">
                        Completed {completedCount} follow-up{completedCount !== 1 ? 's' : ''} this session.
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-gray-50">
            {/* Sidebar: Queue List */}
            <div className="w-[280px] border-r border-gray-200 bg-white overflow-y-auto hidden lg:block">
                <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                    <span className="font-semibold text-xs text-gray-500 uppercase tracking-wider">
                        Queue
                    </span>
                    <span className="text-xs text-gray-400">{queue.length} remaining</span>
                </div>
                {queue.map((item, i) => (
                    <div
                        key={item.id}
                        className={`p-4 border-b border-gray-50 cursor-pointer transition-all ${i === currentIndex
                            ? 'bg-indigo-50 border-l-4 border-l-indigo-500'
                            : 'opacity-60 hover:opacity-100 hover:bg-gray-50'
                            }`}
                        onClick={() => setCurrentIndex(i)}
                    >
                        <div className="font-medium text-gray-900 truncate text-sm">
                            {item.company.name}
                        </div>
                        <div className="text-xs text-gray-500 truncate mt-1">
                            FU{item.followUpNumber} • {item.recipient.email.split('@')[0]}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${item.priority.isOverdue
                                ? 'bg-red-100 text-red-700'
                                : 'bg-gray-100 text-gray-600'
                                }`}>
                                {item.priority.isOverdue ? 'Overdue' : 'Due'}
                            </span>
                            {item.company.opportunityBand && (
                                <span className={`text-xs px-2 py-0.5 rounded-full ${item.company.opportunityBand === 'High'
                                    ? 'bg-green-100 text-green-700'
                                    : item.company.opportunityBand === 'Medium'
                                        ? 'bg-amber-100 text-amber-700'
                                        : 'bg-gray-100 text-gray-600'
                                    }`}>
                                    {item.company.opportunityBand}
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Main: Card View */}
            <div className="flex-1 p-6 lg:p-8 flex flex-col max-w-4xl mx-auto w-full">
                {/* Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col flex-1 overflow-hidden">
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                        <div className="flex items-start justify-between">
                            <div>
                                <button
                                    onClick={() => currentItem.company.prospectId && setShowCompanyProfile(true)}
                                    className="font-semibold text-lg text-gray-900 hover:text-indigo-600 transition-colors flex items-center gap-2"
                                >
                                    <Building2 size={18} className="text-gray-400" />
                                    {currentItem.company.name}
                                </button>
                                <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                                    <Mail size={14} />
                                    {currentItem.recipient.formatted}
                                </p>
                            </div>

                            {/* Priority Indicators */}
                            <div className="flex flex-col items-end gap-1">
                                <div className="flex items-center gap-2">
                                    {currentItem.priority.isOverdue && (
                                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-red-100 text-red-700 flex items-center gap-1">
                                            <Calendar size={12} />
                                            Overdue
                                        </span>
                                    )}
                                    {currentItem.company.opportunityBand && (
                                        <span className={`text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1 ${currentItem.company.opportunityBand === 'High'
                                            ? 'bg-green-100 text-green-700'
                                            : currentItem.company.opportunityBand === 'Medium'
                                                ? 'bg-amber-100 text-amber-700'
                                                : 'bg-gray-100 text-gray-600'
                                            }`}>
                                            <TrendingUp size={12} />
                                            {currentItem.company.opportunityBand}
                                        </span>
                                    )}
                                </div>
                                {currentItem.priority.reasonSummary && (
                                    <span className="text-xs text-gray-400 mt-1">
                                        {currentItem.priority.reasonSummary}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Composer */}
                    <div className="flex-1 flex flex-col p-6 overflow-y-auto">
                        {/* Subject */}
                        <div className="mb-4">
                            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1 block">
                                Subject
                            </label>
                            <input
                                type="text"
                                value={editedSubject}
                                onChange={(e) => setEditedSubject(e.target.value)}
                                className="w-full text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>

                        {/* Variant Selector */}
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-xs text-gray-500">Variant:</span>
                            <button
                                onClick={() => loadVariant('callFirst')}
                                className={`text-xs px-3 py-1 rounded-full transition-all ${selectedVariant === 'callFirst'
                                    ? 'bg-indigo-100 text-indigo-700'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                Call First
                            </button>
                            <button
                                onClick={() => loadVariant('emailIdeasFirst')}
                                className={`text-xs px-3 py-1 rounded-full transition-all ${selectedVariant === 'emailIdeasFirst'
                                    ? 'bg-indigo-100 text-indigo-700'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                Email Ideas First
                            </button>
                        </div>

                        {/* Body */}
                        <textarea
                            value={editedBody}
                            onChange={(e) => setEditedBody(e.target.value)}
                            className="flex-1 min-h-[200px] w-full resize-none outline-none text-gray-800 leading-relaxed font-sans text-sm bg-white border border-gray-200 rounded-lg p-4 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            placeholder="Write your follow-up..."
                        />
                    </div>

                    {/* Thread Context (Collapsible) */}
                    {showThread && (
                        <div className="border-t border-gray-200 bg-gray-50 p-6 max-h-64 overflow-y-auto">
                            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                                Original Email
                            </div>
                            <div className="text-sm font-medium text-gray-900 mb-2">
                                {currentItem.originalEmail.subject}
                            </div>
                            <div className="text-sm text-gray-600 whitespace-pre-wrap">
                                {currentItem.originalEmail.bodyText}
                            </div>
                        </div>
                    )}

                    {/* Actions Footer */}
                    <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowThread(!showThread)}
                                className="text-xs text-gray-500 flex items-center gap-1 hover:text-gray-700 transition-colors px-3 py-2 rounded-lg hover:bg-white"
                            >
                                {showThread ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                                {showThread ? 'Hide' : 'Show'} Original
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Secondary Actions */}
                            <button
                                onClick={handleClose}
                                className="text-gray-400 hover:text-red-600 px-3 py-2 rounded-lg hover:bg-white transition-all text-sm flex items-center gap-1"
                                title="Close Thread (no more follow-ups)"
                            >
                                <XCircle size={16} />
                                <span className="hidden sm:inline">Close</span>
                            </button>

                            <button
                                onClick={handleSkip}
                                className="text-gray-400 hover:text-gray-700 px-3 py-2 rounded-lg hover:bg-white transition-all text-sm flex items-center gap-1"
                                title="Skip (X)"
                            >
                                <X size={16} />
                                <span className="hidden sm:inline">Skip</span>
                            </button>

                            <button
                                onClick={() => setShowSnoozeModal(true)}
                                className="text-gray-400 hover:text-amber-600 px-3 py-2 rounded-lg hover:bg-white transition-all text-sm flex items-center gap-1"
                                title="Snooze (S)"
                            >
                                <Clock size={16} />
                                <span className="hidden sm:inline">Snooze</span>
                            </button>

                            {/* Primary Action */}
                            <button
                                onClick={handleSend}
                                disabled={sending}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 shadow-sm disabled:opacity-50 transition-all ml-2"
                            >
                                {sending ? (
                                    <>
                                        <Zap size={16} className="animate-pulse" />
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        <Send size={16} />
                                        Approve & Send
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Counter */}
                <div className="mt-4 text-center text-xs text-gray-400">
                    {queue.length - 1} more item{queue.length - 1 !== 1 ? 's' : ''} in queue
                    {completedCount > 0 && ` • ${completedCount} sent this session`}
                </div>
            </div>

            {/* Snooze Modal */}
            {showSnoozeModal && (
                <SnoozeModal
                    onSnooze={handleSnooze}
                    onClose={() => setShowSnoozeModal(false)}
                />
            )}

            {/* Company Profile Popup */}
            {showCompanyProfile && currentItem.company.prospectId && (
                <CompanyProfilePopup
                    prospectId={currentItem.company.prospectId}
                    onClose={() => setShowCompanyProfile(false)}
                />
            )}

            {/* Toast */}
            {toast && (
                <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg animate-fade-in-up text-sm">
                    {toast}
                </div>
            )}
        </div>
    );
}
