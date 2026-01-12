'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
    Columns3, ArrowLeft, RefreshCw, GripVertical,
    Building2, Mail, Calendar, ChevronRight, X,
    AlertCircle, CheckCircle2, Phone, FileText, Trophy, XCircle
} from 'lucide-react';
import ThreadViewer from '@/components/ThreadViewer';

// Outcome stages configuration
const STAGES = [
    { key: 'NEW', label: 'New', color: 'bg-gray-100', textColor: 'text-gray-600', borderColor: 'border-gray-200', icon: <Mail size={14} /> },
    { key: 'INTERESTED', label: 'Interested', color: 'bg-blue-50', textColor: 'text-blue-700', borderColor: 'border-blue-200', icon: <CheckCircle2 size={14} /> },
    { key: 'CALL_BOOKED', label: 'Call Booked', color: 'bg-purple-50', textColor: 'text-purple-700', borderColor: 'border-purple-200', icon: <Phone size={14} /> },
    { key: 'PROPOSAL_SENT', label: 'Proposal', color: 'bg-amber-50', textColor: 'text-amber-700', borderColor: 'border-amber-200', icon: <FileText size={14} /> },
    { key: 'WON', label: 'Won', color: 'bg-green-50', textColor: 'text-green-700', borderColor: 'border-green-200', icon: <Trophy size={14} /> },
    { key: 'LOST', label: 'Lost', color: 'bg-gray-100', textColor: 'text-gray-500', borderColor: 'border-gray-200', icon: <XCircle size={14} /> },
    { key: 'NOT_INTERESTED', label: 'Not Interested', color: 'bg-red-50', textColor: 'text-red-600', borderColor: 'border-red-200', icon: <AlertCircle size={14} /> }
];

interface Deal {
    id: number;
    subject: string;
    formattedTo: string;
    sentAt: string;
    status: string;
    conversationOutcome: string | null;
    replyIntent: string | null;
    replySummary: string | null;
    nextActionDate: string | null;
    dealNotes: string | null;
    lastInboundAt: string | null;
    lead: {
        id: number;
        companyName: string;
        industry?: string | null;
        companyProspect?: {
            displayBrandName?: string | null;
            contactPriorityBand?: string | null;
        } | null;
    };
}

export default function DealsKanbanPage() {
    const [deals, setDeals] = useState<Record<string, Deal[]>>({});
    const [loading, setLoading] = useState(true);
    const [selectedDeal, setSelectedDeal] = useState<number | null>(null);
    const [draggedDeal, setDraggedDeal] = useState<Deal | null>(null);
    const [dragOverStage, setDragOverStage] = useState<string | null>(null);

    useEffect(() => {
        fetchDeals();
    }, []);

    async function fetchDeals() {
        setLoading(true);
        try {
            const res = await fetch('/api/outreach/deals');
            const data = await res.json();
            if (data.deals) {
                setDeals(data.deals);
            }
        } catch (e) {
            console.error('Failed to fetch deals:', e);
        } finally {
            setLoading(false);
        }
    }

    const handleDragStart = (deal: Deal) => {
        setDraggedDeal(deal);
    };

    const handleDragOver = (e: React.DragEvent, stageKey: string) => {
        e.preventDefault();
        setDragOverStage(stageKey);
    };

    const handleDragLeave = () => {
        setDragOverStage(null);
    };

    const handleDrop = async (e: React.DragEvent, newStage: string) => {
        e.preventDefault();
        setDragOverStage(null);

        if (!draggedDeal) return;

        const currentStage = draggedDeal.conversationOutcome || 'NEW';
        if (currentStage === newStage) {
            setDraggedDeal(null);
            return;
        }

        // Optimistic update
        setDeals(prev => {
            const updated = { ...prev };
            // Remove from current stage
            updated[currentStage] = updated[currentStage].filter(d => d.id !== draggedDeal.id);
            // Add to new stage
            const movedDeal = { ...draggedDeal, conversationOutcome: newStage };
            updated[newStage] = [movedDeal, ...(updated[newStage] || [])];
            return updated;
        });

        // API update
        try {
            await fetch('/api/outreach/deals', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ emailId: draggedDeal.id, outcome: newStage })
            });
        } catch (e) {
            console.error('Failed to update deal:', e);
            fetchDeals(); // Revert
        }

        setDraggedDeal(null);
    };

    const totalDeals = Object.values(deals).reduce((sum, arr) => sum + arr.length, 0);

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/outreach/sent"
                            className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                            <ArrowLeft size={20} />
                        </Link>
                        <div>
                            <h1 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                <Columns3 size={20} />
                                Deals Pipeline
                            </h1>
                            <p className="text-sm text-gray-500">{totalDeals} active conversations</p>
                        </div>
                    </div>
                    <button
                        onClick={fetchDeals}
                        disabled={loading}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>
            </header>

            {/* Kanban Board */}
            <main className="p-6 overflow-x-auto">
                <div className="flex gap-4 min-w-max pb-6">
                    {STAGES.map(stage => {
                        const stageDeals = deals[stage.key] || [];
                        const isDropTarget = dragOverStage === stage.key;

                        return (
                            <div
                                key={stage.key}
                                className={`w-72 flex-shrink-0 rounded-xl ${stage.color} border ${stage.borderColor} ${isDropTarget ? 'ring-2 ring-indigo-400 ring-offset-2' : ''}`}
                                onDragOver={(e) => handleDragOver(e, stage.key)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, stage.key)}
                            >
                                {/* Column Header */}
                                <div className={`px-4 py-3 border-b ${stage.borderColor} flex items-center justify-between`}>
                                    <div className={`flex items-center gap-2 text-sm font-semibold ${stage.textColor}`}>
                                        {stage.icon}
                                        {stage.label}
                                    </div>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${stage.color} ${stage.textColor} font-medium`}>
                                        {stageDeals.length}
                                    </span>
                                </div>

                                {/* Cards */}
                                <div className="p-2 space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto">
                                    {loading ? (
                                        <div className="text-center py-8 text-gray-400 text-sm">
                                            Loading...
                                        </div>
                                    ) : stageDeals.length === 0 ? (
                                        <div className="text-center py-8 text-gray-400 text-xs">
                                            No deals
                                        </div>
                                    ) : (
                                        stageDeals.map(deal => (
                                            <DealCard
                                                key={deal.id}
                                                deal={deal}
                                                onDragStart={() => handleDragStart(deal)}
                                                onClick={() => setSelectedDeal(deal.id)}
                                            />
                                        ))
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </main>

            {/* Thread Viewer Modal */}
            {selectedDeal && (
                <ThreadViewer
                    emailId={selectedDeal}
                    onClose={() => setSelectedDeal(null)}
                    onReplySent={fetchDeals}
                />
            )}
        </div>
    );
}

// Deal Card Component
function DealCard({
    deal,
    onDragStart,
    onClick
}: {
    deal: Deal;
    onDragStart: () => void;
    onClick: () => void;
}) {
    const companyName = deal.lead.companyProspect?.displayBrandName || deal.lead.companyName;
    const recipientEmail = deal.formattedTo.match(/<(.+)>/)?.[1] || deal.formattedTo;
    const lastActivity = deal.lastInboundAt || deal.sentAt;

    return (
        <div
            draggable
            onDragStart={onDragStart}
            onClick={onClick}
            className="bg-white rounded-lg border border-gray-200 p-3 cursor-pointer hover:shadow-md hover:border-gray-300 transition-all group"
        >
            <div className="flex items-start gap-2">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab text-gray-300">
                    <GripVertical size={14} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <Building2 size={12} className="text-gray-400 flex-shrink-0" />
                        <span className="font-medium text-sm text-gray-900 truncate">
                            {companyName}
                        </span>
                    </div>
                    <div className="text-xs text-gray-500 truncate mb-2">
                        {recipientEmail}
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-400">
                            {formatRelativeTime(lastActivity)}
                        </span>
                        {deal.replyIntent && deal.replyIntent !== 'UNCLEAR' && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${getIntentStyle(deal.replyIntent)}`}>
                                {deal.replyIntent.replace('_', ' ')}
                            </span>
                        )}
                    </div>
                </div>
                <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0" />
            </div>
        </div>
    );
}

function formatRelativeTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getIntentStyle(intent: string): string {
    const styles: Record<string, string> = {
        POSITIVE: 'bg-green-100 text-green-700',
        INTERESTED: 'bg-green-100 text-green-700',
        NEUTRAL_QUESTION: 'bg-blue-100 text-blue-700',
        OBJECTION: 'bg-amber-100 text-amber-700',
        NOT_INTERESTED: 'bg-red-100 text-red-700',
        WRONG_PERSON: 'bg-purple-100 text-purple-700',
        AUTO_REPLY: 'bg-gray-100 text-gray-600'
    };
    return styles[intent] || 'bg-gray-100 text-gray-600';
}
