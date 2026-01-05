'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Minimize2, Send, Save, Check, RotateCcw, AlertCircle, Sparkles, ChevronDown, Paperclip, Bold, Italic, Link as LinkIcon, List, Mail, User } from 'lucide-react';

import { RecipientPicker } from './recipient-picker';

interface ComposerProps {
    isOpen: boolean;
    onClose: () => void;
    prospect: any;
    lead: any;
    initialDraft?: { subject: string; body: string; tier: string; toEmail?: string };
    onSendSuccess: () => void;
}

export default function OutreachComposer({ isOpen, onClose, prospect, lead, initialDraft, onSendSuccess }: ComposerProps) {
    const [toEmails, setToEmails] = useState<string[]>(initialDraft?.toEmail ? [initialDraft.toEmail] : []);
    const [subject, setSubject] = useState(initialDraft?.subject || (lead?.subjectLine1 || ""));
    const [body, setBody] = useState(initialDraft?.body || (lead?.emailDraft || ""));
    const [status, setStatus] = useState<'DRAFTED' | 'APPROVED' | 'SENT'>(lead?.emailStatus || 'DRAFTED');
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [isSending, setIsSending] = useState(false);
    const [hasRisk, setHasRisk] = useState(false);

    // Debounce Save
    useEffect(() => {
        if (!lead?.id) return;
        const timer = setTimeout(() => {
            handleSave();
        }, 3000);
        return () => clearTimeout(timer);
    }, [subject, body]);

    // Initial load sync
    useEffect(() => {
        if (initialDraft) {
            setSubject(initialDraft.subject);
            setBody(initialDraft.body);
            if (initialDraft.toEmail) setToEmails([initialDraft.toEmail]);
        }
    }, [initialDraft]);

    const handleSave = async (newStatus?: string) => {
        if (!lead?.id) return;
        setIsSaving(true);
        try {
            const payload: any = { subject, body };
            if (newStatus) payload.status = newStatus;

            await fetch(`/api/leads/${lead.id}/save-draft`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            setLastSaved(new Date());
            if (newStatus) setStatus(newStatus as any);
        } catch (e) {
            console.error("Autosave failed", e);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSend = async () => {
        if (!subject || !body) {
            alert("Subject and Body are required");
            return;
        }
        if (toEmails.length === 0) {
            alert("Please select at least one recipient");
            return;
        }

        if (hasRisk) {
            if (!confirm(`Warning: Some recipients are marked High Risk and may bounce. Send anyway?`)) return;
        } else {
            if (!confirm(`Confirm sending this email to ${toEmails.join(', ')}?`)) return;
        }

        setIsSending(true);
        try {
            // 1. Approve first if not approved
            if (status !== 'APPROVED') {
                await handleSave('APPROVED');
            }

            // 2. Send
            const res = await fetch('/api/outreach/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    leadId: lead.id,
                    to: toEmails.join(','), // Comma separated for now
                    subject,
                    message: body
                })
            });

            if (res.ok) {
                setStatus('SENT');
                onSendSuccess();
                onClose();
            } else {
                const err = await res.json();
                alert("Failed to send: " + err.error);
            }
        } catch (e) {
            console.error(e);
            alert("Error sending email");
        } finally {
            setIsSending(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-end pointer-events-none pr-4 pb-0 sm:pb-0 sm:items-end">
            {/* Modal Container - Bottom Right like Gmail */}
            <div className="pointer-events-auto bg-white w-full max-w-[600px] shadow-2xl rounded-t-lg border border-gray-200 flex flex-col h-[600px] transition-transform duration-200 ease-out transform translate-y-0">

                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-gray-900 text-white rounded-t-lg">
                    <h3 className="text-sm font-medium flex items-center gap-2">
                        <span>New Message</span>
                        {status === 'DRAFTED' && <span className="text-[10px] bg-gray-700 px-1.5 py-0.5 rounded text-gray-300">Draft</span>}
                        {status === 'APPROVED' && <span className="text-[10px] bg-green-900 text-green-100 px-1.5 py-0.5 rounded flex items-center gap-1"><Check size={8} /> Approved</span>}
                    </h3>
                    <div className="flex items-center gap-2">
                        <button className="text-gray-400 hover:text-white"><Minimize2 size={14} /></button>
                        <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={14} /></button>
                    </div>
                </div>

                {/* Metadata Fields */}
                <div className="px-4 py-2 border-b border-gray-100 space-y-1">
                    <div className="flex items-start py-2 border-b border-transparent hover:border-gray-100 group z-50">
                        {/* <span className="text-gray-500 text-sm w-16 pt-2">To</span> */}
                        <div className="flex-1">
                            <RecipientPicker
                                leadId={lead?.id}
                                selectedEmails={toEmails}
                                onSelectionChange={setToEmails}
                                onRiskChange={setHasRisk}
                            />
                        </div>
                    </div>

                    {hasRisk && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border-b border-red-100 text-red-700 text-xs font-medium">
                            <AlertCircle size={14} className="shrink-0" />
                            <span>Warning: <strong>High risk</strong> recipients detected. Deliverability may be low.</span>
                        </div>
                    )}

                    <div className="flex items-center py-1">
                        <span className="text-gray-500 text-sm w-16">Subject</span>
                        <input
                            type="text"
                            className="flex-1 text-sm outline-none placeholder-gray-400 font-medium"
                            placeholder="Subject line"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                        />
                    </div>
                </div>

                {/* Editor Toolbar (Fake) */}
                {/* 
                <div className="px-3 py-2 border-b border-gray-50 flex gap-1 text-gray-500">
                    <button className="p-1 hover:bg-gray-100 rounded"><Bold size={14} /></button>
                    <button className="p-1 hover:bg-gray-100 rounded"><Italic size={14} /></button>
                    <button className="p-1 hover:bg-gray-100 rounded"><LinkIcon size={14} /></button>
                    <div className="w-px h-4 bg-gray-200 mx-1 self-center" />
                    <button className="p-1 hover:bg-gray-100 rounded"><List size={14} /></button>
                </div>
                */}

                {/* Body Area */}
                <div className="flex-1 p-4 overflow-y-auto flex flex-col">
                    <textarea
                        className="flex-1 w-full resize-none outline-none text-sm leading-relaxed text-gray-800 font-sans"
                        placeholder="Write your email here..."
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        readOnly={status === 'APPROVED' && false} // Can still edit, maybe auto-unlock?
                    />

                    {/* Signature Preview */}
                    <div className="mt-8 pt-4 border-t border-gray-100 text-gray-500 text-xs">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="font-semibold text-gray-400 uppercase tracking-wider text-[10px]">Signature Preview (Gmail)</span>
                        </div>
                        <div className="opacity-70 font-serif">
                            <p>Oscar Richmond</p>
                            <p className="text-gray-400">Founder, Selfhood Studios</p>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-3 border-t border-gray-100 flex items-center justify-between bg-white">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleSend}
                            disabled={isSending || !subject}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
                        >
                            {isSending ? 'Sending...' : 'Send'}
                        </button>

                        <div className="h-6 w-px bg-gray-200 mx-1" />

                        <button className="text-gray-500 hover:bg-gray-100 p-2 rounded text-sm relative" title="Attach files">
                            <Paperclip size={18} />
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Status Indicator */}
                        <div className="text-xs text-gray-400 italic">
                            {isSaving ? 'Saving...' : (lastSaved ? 'Saved' : '')}
                        </div>

                        {/* Approve Toggle */}
                        <button
                            onClick={() => handleSave(status === 'APPROVED' ? 'DRAFTED' : 'APPROVED')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${status === 'APPROVED'
                                ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                                : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                                }`}
                        >
                            {status === 'APPROVED' ? <Check size={12} /> : <AlertCircle size={12} />}
                            {status === 'APPROVED' ? 'Approved' : 'Approve'}
                        </button>

                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2"><RotateCcw size={16} /></button>
                    </div>
                </div>
            </div>
        </div>
    );
}
