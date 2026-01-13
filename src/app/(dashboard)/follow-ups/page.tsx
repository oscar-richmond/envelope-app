'use client';

/**
 * Phase 7: Follow-up Queue Page
 * Tinder-style approval flow for sequence emails
 */

import React, { useState, useEffect, useCallback } from 'react';

interface QueueItem {
    id: string;
    enrollmentId: string;
    stepIndex: number;
    companyName: string;
    contactName: string;
    contactEmail: string;
    threadSummary?: string;
    previousEmailPreview?: string;
    suggestedDrafts: {
        tone: 'friendly' | 'professional' | 'urgent';
        subject: string;
        body: string;
    }[];
    scheduledFor: string;
    priority: number;
}

export default function FollowUpsPage() {
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [selectedTone, setSelectedTone] = useState<'friendly' | 'professional' | 'urgent'>('friendly');
    const [editMode, setEditMode] = useState(false);
    const [editedSubject, setEditedSubject] = useState('');
    const [editedBody, setEditedBody] = useState('');
    const [processing, setProcessing] = useState(false);

    const fetchQueue = useCallback(async () => {
        try {
            const res = await fetch('/api/sequences?action=queue');
            const data = await res.json();
            if (data.success) {
                setQueue(data.queue);
            }
        } catch (err) {
            console.error('Failed to fetch queue:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchQueue();
    }, [fetchQueue]);

    const currentItem = queue[currentIndex];
    const currentDraft = currentItem?.suggestedDrafts.find(d => d.tone === selectedTone);

    useEffect(() => {
        if (currentDraft && !editMode) {
            setEditedSubject(currentDraft.subject);
            setEditedBody(currentDraft.body);
        }
    }, [currentDraft, editMode]);

    const handleApprove = async () => {
        if (!currentItem) return;
        setProcessing(true);

        try {
            const res = await fetch('/api/sequences', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'approve',
                    enrollmentId: currentItem.enrollmentId,
                    subject: editedSubject,
                    body: editedBody,
                }),
            });

            const data = await res.json();
            if (data.success) {
                moveToNext();
            }
        } catch (err) {
            console.error('Approve failed:', err);
        } finally {
            setProcessing(false);
        }
    };

    const handleSkip = async () => {
        if (!currentItem) return;
        setProcessing(true);

        try {
            await fetch('/api/sequences', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'skip',
                    enrollmentId: currentItem.enrollmentId,
                }),
            });
            moveToNext();
        } catch (err) {
            console.error('Skip failed:', err);
        } finally {
            setProcessing(false);
        }
    };

    const handleStop = async () => {
        if (!currentItem) return;
        setProcessing(true);

        try {
            await fetch('/api/sequences', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'stop',
                    enrollmentId: currentItem.enrollmentId,
                }),
            });
            moveToNext();
        } catch (err) {
            console.error('Stop failed:', err);
        } finally {
            setProcessing(false);
        }
    };

    const moveToNext = () => {
        setEditMode(false);
        if (currentIndex < queue.length - 1) {
            setCurrentIndex(currentIndex + 1);
        } else {
            // Refresh queue
            fetchQueue();
            setCurrentIndex(0);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-slate-500">Loading follow-ups...</div>
            </div>
        );
    }

    if (queue.length === 0) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="text-6xl mb-4">✓</div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">All caught up!</h2>
                    <p className="text-slate-600">No follow-ups waiting for approval.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 p-6">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Follow-ups</h1>
                        <p className="text-slate-500">{queue.length - currentIndex} remaining</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {['friendly', 'professional', 'urgent'].map((tone) => (
                            <button
                                key={tone}
                                onClick={() => {
                                    setSelectedTone(tone as any);
                                    setEditMode(false);
                                }}
                                className={`px-3 py-1.5 text-sm rounded-full capitalize ${selectedTone === tone
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-white text-slate-600 border border-slate-200'
                                    }`}
                            >
                                {tone}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Card */}
                {currentItem && (
                    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                        {/* Card Header */}
                        <div className="p-6 border-b border-slate-100">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900">{currentItem.companyName}</h2>
                                    <p className="text-slate-600">{currentItem.contactName}</p>
                                    <p className="text-sm text-slate-400">{currentItem.contactEmail}</p>
                                </div>
                                <span className="px-3 py-1 text-xs bg-slate-100 text-slate-600 rounded-full">
                                    Step {currentItem.stepIndex + 1}
                                </span>
                            </div>

                            {currentItem.threadSummary && (
                                <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                                    <p className="text-sm text-slate-500">{currentItem.threadSummary}</p>
                                </div>
                            )}
                        </div>

                        {/* Email Content */}
                        <div className="p-6">
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
                                {editMode ? (
                                    <input
                                        type="text"
                                        value={editedSubject}
                                        onChange={(e) => setEditedSubject(e.target.value)}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                ) : (
                                    <p className="text-slate-900 font-medium">{editedSubject}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Message</label>
                                {editMode ? (
                                    <textarea
                                        value={editedBody}
                                        onChange={(e) => setEditedBody(e.target.value)}
                                        rows={8}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                ) : (
                                    <p className="whitespace-pre-wrap text-slate-700">{editedBody}</p>
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="p-6 bg-slate-50 border-t border-slate-100">
                            <div className="flex items-center justify-between gap-4">
                                <button
                                    onClick={handleStop}
                                    disabled={processing}
                                    className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    Stop Sequence
                                </button>

                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setEditMode(!editMode)}
                                        className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                    >
                                        {editMode ? 'Preview' : 'Edit'}
                                    </button>

                                    <button
                                        onClick={handleSkip}
                                        disabled={processing}
                                        className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
                                    >
                                        Skip
                                    </button>

                                    <button
                                        onClick={handleApprove}
                                        disabled={processing}
                                        className="px-6 py-2 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
                                    >
                                        {processing ? (
                                            <span>Sending...</span>
                                        ) : (
                                            <>
                                                <span>Approve & Send</span>
                                                <span>✓</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Progress */}
                <div className="mt-6 flex justify-center gap-1">
                    {queue.map((_, i) => (
                        <div
                            key={i}
                            className={`w-2 h-2 rounded-full ${i < currentIndex ? 'bg-green-500' :
                                    i === currentIndex ? 'bg-blue-500' : 'bg-slate-200'
                                }`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
