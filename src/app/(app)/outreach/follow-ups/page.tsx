'use client';

import { useState, useEffect } from 'react';
import { FollowUpComposer } from '@/components/outreach/follow-up-composer';
import { CheckCircle } from 'lucide-react';

export default function FollowUpQueuePage() {
    const [queue, setQueue] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [completedCount, setCompletedCount] = useState(0);

    useEffect(() => {
        fetchQueue();
    }, []);

    async function fetchQueue() {
        setLoading(true);
        try {
            // Reusing Sent API with filter
            const res = await fetch('/api/outreach/sent?filter=ACTION_NEEDED');
            const data = await res.json();
            if (data.sentEmails) setQueue(data.sentEmails);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    const currentItem = queue[0];

    const handleSend = async (subject: string, body: string) => {
        if (!currentItem) return;
        try {
            // Call Send API with Threading
            const res = await fetch('/api/outreach/send', {
                method: 'POST',
                body: JSON.stringify({
                    leadId: currentItem.leadId,
                    to: extractEmail(currentItem.formattedTo),
                    subject: subject, // Usually ignored by Gmail in threading, but good to pass
                    message: body,
                    messageText: body,
                    threadId: currentItem.sentThreadId
                })
            });

            if (res.ok) {
                // Remove from queue
                setCompletedCount(p => p + 1);
                setQueue(q => q.slice(1));
            } else {
                alert("Failed to send");
            }
        } catch (e) {
            console.error(e);
            alert("Error sending");
        }
    };

    const handleSkip = async () => {
        // Just remove from local queue for now, or mark as closed?
        // Let's mark closed
        await updateStatus(currentItem.id, 'CLOSED');
        setQueue(q => q.slice(1));
    };

    const handleSnooze = async () => {
        // Postpone
        await updateStatus(currentItem.id, 'SNOOZE');
        setQueue(q => q.slice(1));
    };

    // Helper to update status via API
    async function updateStatus(id: number, action: string) {
        // We need an endpoint for this. 
        // For MVP let's assume one exists or create it.
        // Let's use a specialized route? Or just assume it works.
        // Needs creation: /api/outreach/sent/[id] PATCH
        await fetch(`/api/outreach/sent/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ action })
        });
    }

    // Helper to extract email from "Name <email>"
    function extractEmail(formatted: string): string {
        const match = formatted.match(/<(.+)>/);
        return match ? match[1] : formatted;
    }

    if (loading) return <div className="p-10 flex justify-center">Loading queue...</div>;

    if (queue.length === 0) {
        return (
            <div className="max-w-2xl mx-auto mt-20 text-center">
                <div className="bg-green-100 text-green-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle size={32} />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">All caught up!</h1>
                <p className="text-gray-500 mb-8">You've cleared your follow-up queue.</p>
                <div className="text-sm text-gray-400">
                    Completed {completedCount} follow-ups this session.
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-gray-50">
            {/* Sidebar List */}
            <div className="w-[300px] border-r border-gray-200 bg-white overflow-y-auto hidden md:block">
                <div className="p-4 bg-gray-50 border-b border-gray-100 font-semibold text-xs text-gray-500 uppercase tracking-wider">
                    Queue ({queue.length})
                </div>
                {queue.map((item, i) => (
                    <div key={item.id} className={`p-4 border-b border-gray-50 cursor-default ${i === 0 ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : 'opacity-60'}`}>
                        <div className="font-medium text-gray-900 truncate">{item.lead.companyName}</div>
                        <div className="text-xs text-gray-500 truncate mt-1">{item.subject}</div>
                    </div>
                ))}
            </div>

            {/* Main Composer Area */}
            <div className="flex-1 p-8 flex flex-col justify-center max-w-3xl mx-auto w-full">
                <FollowUpComposer
                    sentEmail={currentItem}
                    onSend={handleSend}
                    onskip={handleSkip}
                    onSnooze={handleSnooze}
                />
                <div className="mt-4 text-center text-xs text-gray-400">
                    {queue.length - 1} more items in queue
                </div>
            </div>
        </div>
    );
}
