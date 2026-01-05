'use client';

import { useState, useEffect } from 'react';
import { Send, Clock, X, ChevronDown, ChevronUp } from 'lucide-react';

interface FollowUpComposerProps {
    sentEmail: any; // The original email record
    onSend: (subject: string, body: string) => Promise<void>;
    onskip: () => void;
    onSnooze: () => void;
}

export function FollowUpComposer({ sentEmail, onSend, onskip, onSnooze }: FollowUpComposerProps) {
    const [body, setBody] = useState("");
    const [subject, setSubject] = useState("");
    const [generating, setGenerating] = useState(true);
    const [sending, setSending] = useState(false);
    const [threadOpen, setThreadOpen] = useState(false);

    useEffect(() => {
        // Generate Draft on mount (simulate API latency or do it directly if we had the service on client, which we don't)
        // We'll call an API to generate it.
        async function gen() {
            setGenerating(true);
            try {
                // Call API to generate draft
                const res = await fetch('/api/outreach/generate-follow-up', {
                    method: 'POST',
                    body: JSON.stringify({ 
                        originalSubject: sentEmail.subject, 
                        companyName: sentEmail.lead.companyName,
                        followUpCount: sentEmail.followUpCount
                    })
                });
                const data = await res.json();
                setBody(data.draft);
                setSubject(`Re: ${sentEmail.subject}`);
            } catch (e) {
                console.error(e);
                setBody("Hi,\n\nJust following up on my previous note.\n\nBest,\nOscar");
            } finally {
                setGenerating(false);
            }
        }
        if (sentEmail) {
            gen();
            setThreadOpen(false);
        }
    }, [sentEmail]);

    const handleSend = async () => {
        setSending(true);
        await onSend(subject, body);
        setSending(false);
    };

    if (!sentEmail) return <div className="p-10 text-center text-gray-400">No overdue follow-ups.</div>;

    return (
        <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <div>
                    <h2 className="font-semibold text-gray-900">{sentEmail.lead.companyName}</h2>
                    <p className="text-xs text-gray-500">Sent {new Date(sentEmail.sentAt).toLocaleDateString()} • {sentEmail.formattedTo}</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={onSnooze} className="p-2 hover:bg-white rounded-full text-gray-400 hover:text-amber-500 border border-transparent hover:border-gray-200 transition-all font-medium text-xs flex items-center gap-1">
                        <Clock size={14} /> Snooze
                    </button>
                    <button onClick={onskip} className="p-2 hover:bg-white rounded-full text-gray-400 hover:text-gray-600 border border-transparent hover:border-gray-200 transition-all font-medium text-xs flex items-center gap-1">
                        <X size={14} /> Skip
                    </button>
                </div>
            </div>

            {/* Composer */}
            <div className="flex-1 p-6 flex flex-col">
                <div className="mb-4">
                    <input 
                        className="w-full text-sm font-medium text-gray-700 placeholder-gray-400 outline-none border-b border-transparent focus:border-gray-100 py-1"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                    />
                </div>
                
                {generating ? (
                    <div className="flex-1 flex items-center justify-center text-gray-400 text-sm animate-pulse">
                        Generating smart follow-up...
                    </div>
                ) : (
                    <textarea 
                        className="flex-1 w-full resize-none outline-none text-gray-800 leading-relaxed font-sans"
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        placeholder="Write your follow up..."
                    />
                )}
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-gray-100 flex justify-between items-center">
                <button 
                    onClick={() => setThreadOpen(!threadOpen)}
                    className="text-xs text-gray-500 flex items-center gap-1 hover:text-gray-800"
                >
                    {threadOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                    {threadOpen ? 'Hide' : 'Show'} Context
                </button>

                <button 
                    onClick={handleSend}
                    disabled={sending || generating}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 shadow-sm disabled:opacity-50 transition-all"
                >
                    <Send size={16} />
                    {sending ? 'Sending...' : 'Approve & Send'}
                </button>
            </div>

            {/* Thread Context */}
            {threadOpen && (
                <div className="h-64 overflow-y-auto bg-gray-50 p-6 border-t border-gray-200 text-sm text-gray-600">
                    <div className="mb-2 font-medium text-gray-900">{sentEmail.subject}</div>
                    <div className="whitespace-pre-wrap">{sentEmail.bodyText}</div>
                </div>
            )}
        </div>
    );
}
