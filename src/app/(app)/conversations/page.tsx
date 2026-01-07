'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    MessageSquare, Clock, Building2,
    TrendingUp, DollarSign, GripVertical, StickyNote
} from 'lucide-react';
import Link from 'next/link';

interface ConversationCard {
    id: number;
    leadId: number;
    company: { name: string; domain: string | null };
    contact: { name: string; email: string };
    lastActivity: string;
    daysSinceActivity: number;
    badges: {
        opportunity: string | null;
        financialHealth: string | null;
    };
    outcome: string;
    column: string;
    hasNotes?: boolean;
}

interface ColumnData {
    INTERESTED: ConversationCard[];
    CALL_PROPOSED: ConversationCard[];
    CALL_COMPLETED: ConversationCard[];
    PAUSED: ConversationCard[];
    CLOSED: ConversationCard[];
}

const COLUMN_INFO = {
    INTERESTED: {
        title: 'Interested',
        description: 'Positive reply, needs engagement',
        color: 'border-green-200 bg-green-50/50'
    },
    CALL_PROPOSED: {
        title: 'Call Proposed',
        description: 'Awaiting scheduling',
        color: 'border-blue-200 bg-blue-50/50'
    },
    CALL_COMPLETED: {
        title: 'Call Completed',
        description: 'Next steps pending',
        color: 'border-indigo-200 bg-indigo-50/50'
    },
    PAUSED: {
        title: 'Paused',
        description: 'Waiting for later',
        color: 'border-amber-200 bg-amber-50/50'
    },
    CLOSED: {
        title: 'Closed',
        description: 'Conversation ended',
        color: 'border-gray-200 bg-gray-50/50'
    }
};

type ColumnKey = keyof typeof COLUMN_INFO;

export default function ConversationsPage() {
    const [columns, setColumns] = useState<ColumnData | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeCount, setActiveCount] = useState(0);
    const [draggedCard, setDraggedCard] = useState<ConversationCard | null>(null);
    const [dragOverColumn, setDragOverColumn] = useState<ColumnKey | null>(null);

    useEffect(() => {
        fetchConversations();
    }, []);

    async function fetchConversations() {
        try {
            const res = await fetch('/api/conversations');
            const data = await res.json();
            if (data.columns) {
                setColumns(data.columns);
                setActiveCount(data.activeCount);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    const handleDragStart = (card: ConversationCard) => {
        setDraggedCard(card);
    };

    const handleDragOver = (e: React.DragEvent, column: ColumnKey) => {
        e.preventDefault();
        setDragOverColumn(column);
    };

    const handleDragLeave = () => {
        setDragOverColumn(null);
    };

    const handleDrop = async (targetColumn: ColumnKey) => {
        if (!draggedCard || draggedCard.column === targetColumn) {
            setDraggedCard(null);
            setDragOverColumn(null);
            return;
        }

        // Optimistic update
        setColumns(prev => {
            if (!prev) return prev;
            const newColumns = { ...prev };

            // Remove from old column
            const oldColumn = draggedCard.column as ColumnKey;
            newColumns[oldColumn] = newColumns[oldColumn].filter(c => c.id !== draggedCard.id);

            // Add to new column
            newColumns[targetColumn] = [...newColumns[targetColumn], { ...draggedCard, column: targetColumn }];

            return newColumns;
        });

        // Persist
        try {
            await fetch('/api/conversations', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    emailId: draggedCard.id,
                    column: targetColumn
                })
            });
        } catch (e) {
            console.error(e);
            fetchConversations(); // Revert on error
        }

        setDraggedCard(null);
        setDragOverColumn(null);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[80vh]">
                <div className="text-gray-400 animate-pulse">Loading conversations...</div>
            </div>
        );
    }

    if (!columns || activeCount === 0) {
        // Check if all conversations are just closed (vs truly empty)
        const hasAnyConversations = columns && Object.values(columns).some(col => col.length > 0);

        return (
            <div className="min-h-screen bg-gray-50">
                {/* Header */}
                <header className="bg-white border-b border-gray-200 px-6 py-4">
                    <div className="text-center">
                        <h1 className="text-xl font-semibold text-gray-900">Conversations</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            This is where active conversations live once someone replies or shows interest.
                        </p>
                    </div>
                </header>

                <div className="max-w-4xl mx-auto px-6 py-12">
                    {/* Static Column Preview */}
                    <div className="mb-12">
                        <div className="flex gap-3 overflow-x-auto pb-4">
                            {(Object.keys(COLUMN_INFO) as ColumnKey[]).map(columnKey => (
                                <div
                                    key={columnKey}
                                    className="w-44 flex-shrink-0 rounded-lg border border-gray-200 bg-gray-50/50 opacity-60"
                                >
                                    <div className="px-3 py-2.5 border-b border-gray-100">
                                        <h3 className="text-sm font-medium text-gray-400">
                                            {COLUMN_INFO[columnKey].title}
                                        </h3>
                                    </div>
                                    <div className="h-24 flex items-center justify-center">
                                        <div className="w-3/4 h-3 bg-gray-100 rounded" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Explanation */}
                    <div className="text-center max-w-lg mx-auto">
                        <p className="text-gray-600 mb-6">
                            When someone replies to an email or shows interest, the conversation will appear here
                            so you can track progress without needing a CRM.
                        </p>

                        {/* How this gets filled hint */}
                        <p className="text-sm text-gray-400 mb-8">
                            Conversations appear here after a reply, referral, or when someone asks to talk.
                        </p>

                        {/* Soft secondary CTA */}
                        <Link
                            href="/outreach/sent"
                            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                        >
                            View Inbox →
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-semibold text-gray-900">Conversations</h1>
                        <p className="text-sm text-gray-500">{activeCount} active conversation{activeCount !== 1 ? 's' : ''}</p>
                    </div>
                </div>
            </header>

            {/* Kanban Board */}
            <div className="p-6 overflow-x-auto">
                <div className="flex gap-4 min-w-max">
                    {(Object.keys(COLUMN_INFO) as ColumnKey[]).map(columnKey => (
                        <div
                            key={columnKey}
                            className={`w-72 flex-shrink-0 rounded-xl border-2 ${dragOverColumn === columnKey
                                ? 'border-indigo-400 bg-indigo-50'
                                : COLUMN_INFO[columnKey].color
                                } transition-colors`}
                            onDragOver={(e) => handleDragOver(e, columnKey)}
                            onDragLeave={handleDragLeave}
                            onDrop={() => handleDrop(columnKey)}
                        >
                            {/* Column Header */}
                            <div className="px-4 py-3 border-b border-gray-100">
                                <div className="flex items-center justify-between">
                                    <h2 className="font-medium text-gray-900">{COLUMN_INFO[columnKey].title}</h2>
                                    <span className="text-xs text-gray-400 bg-white px-2 py-0.5 rounded-full">
                                        {columns[columnKey]?.length || 0}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-400 mt-0.5">{COLUMN_INFO[columnKey].description}</p>
                            </div>

                            {/* Cards */}
                            <div className="p-2 space-y-2 min-h-[200px]">
                                {columns[columnKey]?.map(card => (
                                    <div
                                        key={card.id}
                                        draggable
                                        onDragStart={() => handleDragStart(card)}
                                        className={`bg-white rounded-lg border border-gray-200 p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow transition-shadow ${draggedCard?.id === card.id ? 'opacity-50' : ''
                                            }`}
                                    >
                                        <div className="flex items-start gap-2">
                                            <GripVertical size={14} className="text-gray-300 mt-0.5 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                {/* Company */}
                                                <Link
                                                    href={`/leads/${card.leadId}`}
                                                    className="font-medium text-gray-900 hover:text-indigo-600 block truncate"
                                                >
                                                    {card.company.name}
                                                </Link>

                                                {/* Contact */}
                                                <p className="text-xs text-gray-500 truncate">{card.contact.name}</p>

                                                {/* Time */}
                                                <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                                                    <Clock size={10} />
                                                    {card.lastActivity}
                                                </p>

                                                {/* Badges */}
                                                <div className="flex gap-1.5 mt-2">
                                                    {card.badges.opportunity && (
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5 ${card.badges.opportunity === 'High' ? 'bg-indigo-100 text-indigo-700' :
                                                            card.badges.opportunity === 'Medium' ? 'bg-amber-100 text-amber-700' :
                                                                'bg-gray-100 text-gray-600'
                                                            }`}>
                                                            <TrendingUp size={8} />
                                                            {card.badges.opportunity}
                                                        </span>
                                                    )}
                                                    {card.badges.financialHealth && (
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5 ${card.badges.financialHealth === 'excellent' ? 'bg-green-100 text-green-700' :
                                                            'bg-gray-100 text-gray-600'
                                                            }`}>
                                                            <DollarSign size={8} />
                                                            {card.badges.financialHealth}
                                                        </span>
                                                    )}
                                                    {card.hasNotes && (
                                                        <span className="text-gray-400" title="Has notes">
                                                            <StickyNote size={10} />
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {columns[columnKey]?.length === 0 && (
                                    <div className="text-center py-8 text-xs text-gray-400">
                                        No conversations
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
