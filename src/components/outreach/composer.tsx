'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Minimize2, Send, Save, Check, RotateCcw, AlertCircle, Sparkles, ChevronDown, Paperclip, Bold, Italic, Link as LinkIcon, List, Mail, User, Pencil } from 'lucide-react';

import { RecipientPicker } from './recipient-picker';
import { ErrorBoundary } from '../ui/error-boundary';
import dynamic from 'next/dynamic';

const RichEditor = dynamic(() => import('./rich-editor'), {
    ssr: false,
    loading: () => <div className="h-[150px] bg-gray-50 border rounded-md animate-pulse" />
});

interface ComposerProps {
    isOpen: boolean;
    onClose: () => void;
    prospect: any;
    lead: any;
    initialDraft?: { subject: string; subjectOptions?: string[]; body: string; tier: string; toEmail?: string };
    onSendSuccess: () => void;
}

export default function OutreachComposer({ isOpen, onClose, prospect, lead, initialDraft, onSendSuccess }: ComposerProps) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);

    const [toEmails, setToEmails] = useState<string[]>(initialDraft?.toEmail ? [initialDraft.toEmail] : []);
    const [subject, setSubject] = useState(initialDraft?.subject || (lead?.subjectLine1 || ""));
    const [subjectOptions, setSubjectOptions] = useState<string[]>(initialDraft?.subjectOptions || []);

    // Primary State: HTML. Fallback: Text.
    const [bodyHtml, setBodyHtml] = useState(initialDraft?.body || (lead?.emailDraftHtml || ""));
    const [bodyText, setBodyText] = useState(initialDraft?.body || (lead?.emailDraft || ""));

    // Status
    const [status, setStatus] = useState<'DRAFTED' | 'APPROVED' | 'SENT'>(lead?.emailStatus || 'DRAFTED');
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [isSending, setIsSending] = useState(false);
    const [hasRisk, setHasRisk] = useState(false);

    // Sync Initial Draft
    useEffect(() => {
        if (initialDraft) {
            setSubject(initialDraft.subject);
            setSubjectOptions(initialDraft.subjectOptions || []);
            setBodyText(initialDraft.body);
            // If bodyHtml saved, use it. Else fallback to body text if rich text missing
            setBodyHtml(initialDraft.body);
            if (initialDraft.toEmail) setToEmails([initialDraft.toEmail]);
        }
    }, [initialDraft]);

    // Debounce Save
    useEffect(() => {
        if (!lead?.id) return;
        const timer = setTimeout(() => {
            handleSave();
        }, 3000);
        return () => clearTimeout(timer);
    }, [subject, bodyHtml]); // Save on HTML change

    const handleEditorChange = (html: string, text: string) => {
        setBodyHtml(html);
        setBodyText(text);
    };

    const handleSave = async (newStatus?: string) => {
        if (!lead?.id) return;
        setIsSaving(true);
        try {
            const payload: any = { subject, body: bodyText, bodyHtml: bodyHtml };
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
        if (!subject || !bodyText) {
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
                    to: toEmails.join(','),
                    subject,
                    message: bodyHtml, // Prefer HTML
                    messageText: bodyText  // Fallback
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

    if (!mounted || !isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-end pointer-events-none pr-4 pb-0 sm:pb-0 sm:items-end">
            {/* Modal Container - Bottom Right like Gmail */}
            <div className="pointer-events-auto bg-white w-full max-w-[600px] shadow-2xl rounded-t-lg border border-gray-200 flex flex-col h-[600px] transition-transform duration-200 ease-out transform translate-y-0">

                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-gray-900 text-white rounded-t-lg">
                    <h3 className="text-sm font-medium flex items-center gap-2">
                        <div className="flex flex-col group relative">
                            {/* Click to Edit Brand Name */}
                            <div className="flex items-center gap-2">
                                <span
                                    className="leading-tight hover:underline decoration-dotted cursor-pointer"
                                    title="Click to edit brand name"
                                    onClick={() => {
                                        const currentVal = prospect?.brandNameOverride || prospect?.websiteBrandName || prospect?.companyName;
                                        const newName = prompt("Update Brand Name for Outreach:", currentVal);
                                        if (newName !== null) { // User didn't cancel
                                            // If empty string provided, treat as 'Reset'? Or just save empty? 
                                            // Let's treat empty as reset if they want. Or provide explicit reset?
                                            // Explicit reset button is better.
                                            // If they provide a name, save it.
                                            if (newName.trim()) {
                                                fetch(`/api/prospects/${prospect.id}/brand`, {
                                                    method: 'PUT',
                                                    body: JSON.stringify({ brandName: newName.trim() })
                                                }).then(() => {
                                                    alert("Brand name updated!");
                                                    // Ideally refresh data
                                                });
                                            }
                                        }
                                    }}
                                >
                                    {prospect?.brandNameOverride || prospect?.websiteBrandName || prospect?.companyName || "New Message"}
                                </span>

                                {/* Indicators */}
                                {prospect?.brandNameOverride ? (
                                    <div className="flex items-center gap-1">
                                        <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1 rounded uppercase font-bold tracking-wider">Manual</span>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (confirm("Reset to auto-generated name?")) {
                                                    fetch(`/api/prospects/${prospect.id}/brand`, {
                                                        method: 'PUT',
                                                        body: JSON.stringify({ brandName: null }) // Reset
                                                    }).then(() => alert("Reset to auto name."));
                                                }
                                            }}
                                            className="text-gray-400 hover:text-red-500"
                                            title="Reset to auto"
                                        >
                                            <RotateCcw size={10} />
                                        </button>
                                    </div>
                                ) : (
                                    <span className="text-[9px] text-gray-400 opacity-50 uppercase tracking-wider font-medium">
                                        {prospect?.websiteBrandNameSource ? `Auto (${prospect.websiteBrandNameSource.replace('_', ' ')})` : 'Legal'}
                                    </span>
                                )}

                                <Pencil size={10} className="opacity-0 group-hover:opacity-50 cursor-pointer" />
                            </div>

                            {/* Legal Name fallback for context if different */}
                            {((prospect?.brandNameOverride || prospect?.websiteBrandName) && prospect?.companyName && (prospect.brandNameOverride || prospect.websiteBrandName) !== prospect.companyName) && (
                                <span className="text-[9px] text-gray-400 font-normal leading-none mt-0.5">{prospect.companyName}</span>
                            )}
                        </div>
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
                        <div className="flex-1">
                            <ErrorBoundary name="RecipientPicker">
                                <RecipientPicker
                                    companyId={prospect?.id}
                                    leadId={lead?.id}
                                    selectedEmails={toEmails}
                                    onSelectionChange={setToEmails}
                                    onRiskChange={setHasRisk}
                                />
                            </ErrorBoundary>
                        </div>
                    </div>

                    {hasRisk && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border-b border-red-100 text-red-700 text-xs font-medium">
                            <AlertCircle size={14} className="shrink-0" />
                            <span>Warning: <strong>High risk</strong> recipients detected. Deliverability may be low.</span>
                        </div>
                    )}

                    <div className="flex items-center py-1 relative group">
                        <span className="text-gray-500 text-sm w-16 px-1">Subject</span>
                        <div className="flex-1 flex items-center relative">
                            <input
                                type="text"
                                className="flex-1 text-sm outline-none placeholder-gray-400 font-medium bg-transparent"
                                placeholder="Subject line"
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                            />
                            {/* Subject Options Dropdown Trigger */}
                            {subjectOptions.length > 0 && (
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="relative group/dropdown">
                                        <button className="text-gray-400 hover:text-indigo-600 bg-white shadow-sm border border-gray-200 rounded p-1">
                                            <Sparkles size={12} />
                                        </button>
                                        <div className="hidden group-hover/dropdown:block absolute right-0 top-full mt-1 w-[300px] bg-white border border-gray-200 shadow-xl rounded-md z-50 overflow-hidden">
                                            <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                                                AI Suggestions
                                            </div>
                                            {subjectOptions.map((opt, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => setSubject(opt)}
                                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors border-b border-gray-50 last:border-0"
                                                >
                                                    {opt}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                </div>

                {/* Body Area */}
                <div className="flex-1 p-4 overflow-y-auto flex flex-col">
                    <ErrorBoundary name="RichEditor">
                        <RichEditor
                            valueHtml={bodyHtml}
                            onChange={handleEditorChange}
                            placeholder="Write your email here..."
                            disabled={false}
                        />
                    </ErrorBoundary>

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
