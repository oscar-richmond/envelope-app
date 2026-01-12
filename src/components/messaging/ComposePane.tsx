'use client';

import { useState, useEffect } from 'react';
import { Send, Save, Loader2, AlertCircle, Mail, Search } from 'lucide-react';
import type { ThreadData } from './MessageThreadComposerModal';
import dynamic from 'next/dynamic';

const RichEditor = dynamic(() => import('../outreach/rich-editor'), {
    ssr: false,
    loading: () => <div className="h-[200px] bg-gray-50 border rounded-md animate-pulse" />
});

interface ComposePaneProps {
    thread: ThreadData | null;
    leadId?: number;
    emailId?: number;
    toEmail: string;
    onToEmailChange: (email: string) => void;
    subject: string;
    onSubjectChange: (subject: string) => void;
    content: string;
    onContentChange: (content: string) => void;
    onSuccess: () => void;
}

export function ComposePane({
    thread,
    leadId,
    emailId,
    toEmail,
    onToEmailChange,
    subject,
    onSubjectChange,
    content,
    onContentChange,
    onSuccess
}: ComposePaneProps) {
    const [bodyText, setBodyText] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [error, setError] = useState<string | null>(null);

    const hasEmail = !!toEmail;
    const canSend = hasEmail && !!subject && !!content;

    // Debounce save draft
    useEffect(() => {
        if (!leadId && !emailId) return;
        const timer = setTimeout(() => {
            handleSaveDraft();
        }, 3000);
        return () => clearTimeout(timer);
    }, [subject, content]);

    function handleEditorChange(html: string, text: string) {
        onContentChange(html);
        setBodyText(text);
    }

    async function handleSaveDraft() {
        if (!content || (!leadId && !emailId)) return;
        setIsSaving(true);

        try {
            // Save to localStorage first
            const key = emailId ? `draft-${emailId}` : `draft-lead-${leadId}`;
            localStorage.setItem(key, content);

            // Save to DB if we have a leadId
            if (leadId) {
                await fetch(`/api/leads/${leadId}/save-draft`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        subject,
                        body: bodyText,
                        bodyHtml: content
                    })
                });
            }

            setLastSaved(new Date());
        } catch (e) {
            console.error('Save failed', e);
        } finally {
            setIsSaving(false);
        }
    }

    async function handleSend() {
        if (!canSend) return;

        if (!confirm(`Send this email to ${toEmail}?`)) return;

        setIsSending(true);
        setError(null);

        try {
            // Case 1: Replying to existing thread
            if (emailId && thread?.threadId) {
                const res = await fetch(`/api/outreach/sent/${emailId}/reply`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        body: bodyText,
                        htmlBody: content,
                        threadId: thread.threadId
                    })
                });

                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || 'Failed to send');
                }
            }
            // Case 2: New outreach from lead
            else if (leadId) {
                const res = await fetch('/api/outreach/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        leadId,
                        to: toEmail,
                        subject,
                        message: content,
                        messageText: bodyText
                    })
                });

                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || 'Failed to send');
                }
            }

            // Clear draft
            const key = emailId ? `draft-${emailId}` : `draft-lead-${leadId}`;
            localStorage.removeItem(key);

            onSuccess();
        } catch (e: any) {
            setError(e.message || 'Failed to send email');
        } finally {
            setIsSending(false);
        }
    }

    return (
        <div className="h-full flex flex-col" style={{ background: 'var(--bg-card)' }}>
            {/* No email warning */}
            {!hasEmail && (
                <div
                    className="px-6 py-4 flex items-center gap-3"
                    style={{
                        background: 'rgba(245, 158, 11, 0.1)',
                        borderBottom: '1px solid rgba(245, 158, 11, 0.3)'
                    }}
                >
                    <AlertCircle size={18} style={{ color: 'rgb(180, 120, 20)' }} />
                    <div className="flex-1">
                        <p className="text-sm font-medium" style={{ color: 'rgb(180, 120, 20)' }}>
                            No recipient email found
                        </p>
                        <p className="text-xs" style={{ color: 'rgb(180, 120, 20)' }}>
                            You can still write your draft. Find contacts to add an email.
                        </p>
                    </div>
                    <button className="btn btn-sm btn-secondary">
                        <Search size={14} />
                        Find Contacts
                    </button>
                </div>
            )}

            {/* Compose Fields */}
            <div className="px-6 py-4 space-y-3 border-b" style={{ borderColor: 'var(--border-soft)' }}>
                {/* To Field */}
                <div className="flex items-center gap-3">
                    <label className="text-sm font-medium w-16" style={{ color: 'var(--text-secondary)' }}>
                        To
                    </label>
                    <div className="flex-1 flex items-center gap-2">
                        <input
                            type="email"
                            value={toEmail}
                            onChange={(e) => onToEmailChange(e.target.value)}
                            placeholder="recipient@email.com"
                            className="flex-1 text-sm outline-none bg-transparent"
                            style={{ color: 'var(--text-primary)' }}
                        />
                        {hasEmail && (
                            <Mail size={14} style={{ color: 'var(--mint-text)' }} />
                        )}
                    </div>
                </div>

                {/* Subject Field */}
                <div className="flex items-center gap-3">
                    <label className="text-sm font-medium w-16" style={{ color: 'var(--text-secondary)' }}>
                        Subject
                    </label>
                    <input
                        type="text"
                        value={subject}
                        onChange={(e) => onSubjectChange(e.target.value)}
                        placeholder="Email subject"
                        className="flex-1 text-sm font-medium outline-none bg-transparent"
                        style={{ color: 'var(--text-primary)' }}
                    />
                </div>
            </div>

            {/* Editor */}
            <div className="flex-1 p-6 overflow-y-auto">
                <RichEditor
                    valueHtml={content}
                    onChange={handleEditorChange}
                    placeholder="Write your email here..."
                    disabled={isSending}
                />

                {/* Signature Preview */}
                <div className="mt-6 pt-4 border-t text-xs" style={{ borderColor: 'var(--border-soft)', color: 'var(--text-muted)' }}>
                    <p className="uppercase tracking-wider font-semibold mb-2" style={{ fontSize: '10px' }}>
                        Signature Preview
                    </p>
                    <div className="opacity-70">
                        <p>Oscar Richmond</p>
                        <p style={{ color: 'var(--text-muted)' }}>Founder, Selfhood Studios</p>
                    </div>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div
                    className="px-6 py-3 flex items-center gap-2"
                    style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        borderTop: '1px solid rgba(239, 68, 68, 0.3)'
                    }}
                >
                    <AlertCircle size={14} style={{ color: 'rgb(239, 68, 68)' }} />
                    <p className="text-sm flex-1" style={{ color: 'rgb(239, 68, 68)' }}>{error}</p>
                </div>
            )}

            {/* Footer Actions */}
            <div
                className="px-6 py-4 flex items-center justify-between shrink-0"
                style={{
                    borderTop: '1px solid var(--border-soft)',
                    background: 'var(--bg-card)'
                }}
            >
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleSend}
                        disabled={!canSend || isSending}
                        className="btn btn-primary"
                    >
                        {isSending ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <Send size={16} />
                        )}
                        {isSending ? 'Sending...' : 'Send'}
                    </button>

                    <button
                        onClick={handleSaveDraft}
                        disabled={isSaving || !content}
                        className="btn btn-secondary"
                    >
                        {isSaving ? (
                            <Loader2 size={14} className="animate-spin" />
                        ) : (
                            <Save size={14} />
                        )}
                        Save Draft
                    </button>
                </div>

                <div className="text-xs italic" style={{ color: 'var(--text-muted)' }}>
                    {isSaving ? 'Saving...' : lastSaved ? 'Draft saved' : ''}
                </div>
            </div>
        </div>
    );
}
