'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Save, Loader2, AlertCircle, Mail, Search, ChevronDown, User, Users } from 'lucide-react';
import type { ThreadData } from './MessageThreadComposerModal';
import { ComposerAIToolbar } from './ComposerAIToolbar';
import dynamic from 'next/dynamic';

const RichEditor = dynamic(() => import('../outreach/rich-editor'), {
    ssr: false,
    loading: () => <div className="h-[200px] bg-gray-50 border rounded-md animate-pulse" />
});

interface Contact {
    id?: string;
    email: string;
    fullName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    role?: string | null;
    roleTitle?: string | null;
    source?: string;
}

interface ComposePaneProps {
    thread: ThreadData | null;
    leadId?: number;
    emailId?: number;
    companyId?: number;
    toEmail: string;
    onToEmailChange: (email: string) => void;
    subject: string;
    onSubjectChange: (subject: string) => void;
    content: string;
    onContentChange: (content: string) => void;
    onSuccess: () => void;
    contacts?: Contact[];
    onFindContacts?: () => void;
    companyContext?: {
        websiteSignals?: string[];
        financialSignals?: string[];
        offering?: string;
        industry?: string;
    };
}

export function ComposePane({
    thread,
    leadId,
    emailId,
    companyId,
    toEmail,
    onToEmailChange,
    subject,
    onSubjectChange,
    content,
    onContentChange,
    onSuccess,
    contacts = [],
    onFindContacts,
    companyContext
}: ComposePaneProps) {
    const [bodyText, setBodyText] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showRecipientDropdown, setShowRecipientDropdown] = useState(false);
    const [aiSummary, setAiSummary] = useState<string | null>(null);
    const [aiReplies, setAiReplies] = useState<string[]>([]);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowRecipientDropdown(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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
                    {onFindContacts && (
                        <button
                            onClick={onFindContacts}
                            className="btn btn-sm btn-secondary"
                        >
                            <Search size={14} />
                            Find Contacts
                        </button>
                    )}
                </div>
            )}

            {/* Compose Fields */}
            <div className="px-6 py-4 space-y-3 border-b" style={{ borderColor: 'var(--border-soft)' }}>
                {/* To Field with Dropdown */}
                <div className="flex items-center gap-3">
                    <label className="text-sm font-medium w-16" style={{ color: 'var(--text-secondary)' }}>
                        To
                    </label>
                    <div className="flex-1 relative" ref={dropdownRef}>
                        <div
                            className="flex items-center gap-2 cursor-pointer py-1"
                            onClick={() => contacts.length > 0 && setShowRecipientDropdown(!showRecipientDropdown)}
                        >
                            <input
                                type="email"
                                value={toEmail}
                                onChange={(e) => {
                                    onToEmailChange(e.target.value);
                                    setShowRecipientDropdown(false);
                                }}
                                placeholder={contacts.length > 0 ? 'Select or type email...' : 'recipient@email.com'}
                                className="flex-1 text-sm outline-none bg-transparent"
                                style={{ color: 'var(--text-primary)' }}
                                onFocus={() => contacts.length > 0 && setShowRecipientDropdown(true)}
                            />
                            {contacts.length > 0 && (
                                <ChevronDown
                                    size={14}
                                    style={{ color: 'var(--text-muted)' }}
                                    className={`transition-transform ${showRecipientDropdown ? 'rotate-180' : ''}`}
                                />
                            )}
                            {hasEmail && (
                                <Mail size={14} style={{ color: 'var(--mint-text)' }} />
                            )}
                        </div>

                        {/* Dropdown */}
                        {showRecipientDropdown && contacts.length > 0 && (
                            <div
                                className="absolute top-full left-0 right-0 mt-1 z-50 max-h-[200px] overflow-y-auto rounded-lg shadow-lg border"
                                style={{ background: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
                            >
                                {contacts.map((contact, i) => {
                                    const name = contact.fullName || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email.split('@')[0];
                                    const role = contact.role || contact.roleTitle || 'Unknown role';
                                    const isSelected = toEmail === contact.email;

                                    return (
                                        <div
                                            key={contact.id || contact.email}
                                            className={`px-3 py-2 cursor-pointer transition-all flex items-center gap-3 ${isSelected ? 'bg-purple-50' : 'hover:bg-gray-50'}`}
                                            onClick={() => {
                                                onToEmailChange(contact.email);
                                                setShowRecipientDropdown(false);
                                            }}
                                        >
                                            <div
                                                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                                                style={{ background: 'linear-gradient(135deg, var(--brand), rgb(139, 92, 246))', color: 'white' }}
                                            >
                                                {name[0]?.toUpperCase() || '?'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                                    {name}
                                                    <span className="text-xs ml-1.5" style={{ color: 'var(--text-muted)' }}>• {role}</span>
                                                </div>
                                                <div className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                                                    {contact.email}
                                                </div>
                                            </div>
                                            {isSelected && <Mail size={14} style={{ color: 'var(--brand)' }} />}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Empty state - no contacts */}
                        {showRecipientDropdown && contacts.length === 0 && (
                            <div
                                className="absolute top-full left-0 right-0 mt-1 z-50 p-4 rounded-lg shadow-lg border text-center"
                                style={{ background: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
                            >
                                <Users size={24} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
                                <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>No contacts saved</p>
                                {onFindContacts && (
                                    <button
                                        onClick={() => {
                                            setShowRecipientDropdown(false);
                                            onFindContacts();
                                        }}
                                        className="text-xs font-medium px-3 py-1.5 rounded-lg"
                                        style={{ background: 'var(--brand)', color: 'white' }}
                                    >
                                        Find Contacts
                                    </button>
                                )}
                            </div>
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

            {/* AI Toolbar */}
            <ComposerAIToolbar
                emailId={emailId}
                thread={thread}
                companyContext={companyContext}
                onSummaryGenerated={(summary) => {
                    setAiSummary(summary);
                    // Show summary in a toast or panel - for now log
                    console.log('[AI] Summary:', summary);
                }}
                onRepliesGenerated={(replies) => {
                    setAiReplies(replies);
                    // Insert first reply if available
                    if (replies.length > 0) {
                        onContentChange(replies[0]);
                    }
                }}
                onDraftGenerated={(draft) => {
                    onContentChange(draft);
                }}
            />

            {/* AI Summary Panel (if generated) */}
            {aiSummary && (
                <div
                    className="px-6 py-3 text-sm border-b"
                    style={{
                        background: 'rgba(139, 92, 246, 0.05)',
                        borderColor: 'rgba(139, 92, 246, 0.2)',
                        color: 'var(--text-secondary)'
                    }}
                >
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgb(139, 92, 246)' }}>
                            AI Summary
                        </span>
                        <button
                            onClick={() => setAiSummary(null)}
                            className="ml-auto text-xs hover:underline"
                            style={{ color: 'var(--text-muted)' }}
                        >
                            Dismiss
                        </button>
                    </div>
                    <p className="text-sm leading-relaxed">{aiSummary}</p>
                </div>
            )}

            {/* AI Replies Panel (if generated) */}
            {aiReplies.length > 0 && (
                <div
                    className="px-6 py-3 text-sm border-b"
                    style={{
                        background: 'rgba(16, 185, 129, 0.05)',
                        borderColor: 'rgba(16, 185, 129, 0.2)',
                        color: 'var(--text-secondary)'
                    }}
                >
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgb(16, 185, 129)' }}>
                            Suggested Replies
                        </span>
                        <button
                            onClick={() => setAiReplies([])}
                            className="ml-auto text-xs hover:underline"
                            style={{ color: 'var(--text-muted)' }}
                        >
                            Dismiss
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {aiReplies.map((reply, i) => (
                            <button
                                key={i}
                                onClick={() => onContentChange(reply)}
                                className="text-xs px-3 py-1.5 rounded-lg border hover:bg-gray-50 transition-colors"
                                style={{ borderColor: 'var(--border-soft)', color: 'var(--text-primary)' }}
                            >
                                Option {i + 1}
                            </button>
                        ))}
                    </div>
                </div>
            )}

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
