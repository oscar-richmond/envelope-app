'use client';

import { useState, useEffect, useRef } from 'react';
import {
    X, Loader2, Clock, Reply, ChevronDown, ChevronUp,
    Sparkles, MessageSquareText, Wand2, RefreshCw,
    Info, AlertCircle, Copy, ExternalLink, Maximize2,
    Send, Save
} from 'lucide-react';
import Link from 'next/link';

// Sub-components
import { ThreadMessages } from './ThreadMessages';
import { AIAssistPanel } from './AIAssistPanel';
import { ComposePane } from './ComposePane';
import { ModalErrorBoundary } from './ModalErrorBoundary';

export interface ThreadMessage {
    id: string;
    from: string;
    fromName: string;
    to: string;
    subject: string;
    body: string;
    timestamp: string;
    isOutbound: boolean;
}

export interface ThreadData {
    email: any;
    company: { id?: number; name: string; domain?: string };
    contact: { name: string; email: string };
    messages: ThreadMessage[];
    threadId: string | null;
    lead?: any;
    prospect?: any;
    partial?: boolean;
    partialReason?: string;
    retryable?: boolean;
}

interface MessageThreadComposerModalProps {
    // One of these must be provided
    emailId?: number;
    leadId?: number;
    prospectId?: number;

    // Pre-fill data (for prospects/leads without threads)
    initialData?: {
        companyName?: string;
        contactName?: string;
        contactEmail?: string;
        lead?: any;
        prospect?: any;
    };

    // UI Configuration
    defaultTab?: 'thread' | 'ai' | 'compose';
    onClose: () => void;
    onSuccess?: () => void;
}

type Tab = 'thread' | 'ai' | 'compose';

export function MessageThreadComposerModal({
    emailId,
    leadId,
    prospectId,
    initialData,
    defaultTab = 'thread',
    onClose,
    onSuccess
}: MessageThreadComposerModalProps) {
    const [activeTab, setActiveTab] = useState<Tab>(defaultTab);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [thread, setThread] = useState<ThreadData | null>(null);

    // Compose state
    const [draftContent, setDraftContent] = useState('');
    const [draftSubject, setDraftSubject] = useState('');
    const [toEmail, setToEmail] = useState('');

    // AI state
    const [aiSummary, setAiSummary] = useState<string | null>(null);
    const [suggestedReplies, setSuggestedReplies] = useState<string[]>([]);

    const containerRef = useRef<HTMLDivElement>(null);

    // Load thread data
    useEffect(() => {
        fetchThreadData();

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [emailId, leadId, prospectId]);

    // Load saved draft
    useEffect(() => {
        const key = emailId ? `draft-${emailId}` : leadId ? `draft-lead-${leadId}` : null;
        if (key) {
            const saved = localStorage.getItem(key);
            if (saved) setDraftContent(saved);
        }
    }, [emailId, leadId]);

    async function fetchThreadData() {
        setLoading(true);
        setError(null);

        try {
            // Case 1: Existing email with thread
            if (emailId) {
                const res = await fetch(`/api/outreach/sent/${emailId}/thread`);
                const data = await res.json();

                if (!res.ok || data.success === false) {
                    setError(data.error || 'Failed to load thread');
                    return;
                }

                setThread(data);
                setToEmail(data.contact?.email || '');
                setDraftSubject(data.email?.subject ? `Re: ${data.email.subject}` : '');
            }
            // Case 2: Lead without existing thread
            else if (leadId) {
                const res = await fetch(`/api/leads/${leadId}`);
                const lead = await res.json();

                if (!res.ok) {
                    setError('Failed to load lead');
                    return;
                }

                // Build thread data from lead
                setThread({
                    email: null,
                    company: {
                        name: lead.companyName || initialData?.companyName || 'Company',
                        domain: lead.websiteUrl?.replace(/^https?:\/\/(www\.)?/, '')
                    },
                    contact: {
                        name: initialData?.contactName || '',
                        email: initialData?.contactEmail || ''
                    },
                    messages: [],
                    threadId: null,
                    lead
                });

                setToEmail(initialData?.contactEmail || '');
                setDraftSubject(lead.subjectLine1 || '');
                setDraftContent(lead.emailDraftHtml || lead.emailDraft || '');
            }
            // Case 3: Prospect without lead
            else if (prospectId || initialData?.prospect) {
                const prospect = initialData?.prospect;

                setThread({
                    email: null,
                    company: {
                        id: prospect?.id,
                        name: prospect?.brandNameOverride || prospect?.websiteBrandName || prospect?.companyName || 'Company',
                        domain: prospect?.websiteUrl?.replace(/^https?:\/\/(www\.)?/, '')
                    },
                    contact: {
                        name: initialData?.contactName || '',
                        email: initialData?.contactEmail || ''
                    },
                    messages: [],
                    threadId: null,
                    prospect
                });

                setToEmail(initialData?.contactEmail || '');
            }
            // Case 4: Just initial data
            else if (initialData) {
                setThread({
                    email: null,
                    company: { name: initialData.companyName || 'Company' },
                    contact: {
                        name: initialData.contactName || '',
                        email: initialData.contactEmail || ''
                    },
                    messages: [],
                    threadId: null,
                    lead: initialData.lead,
                    prospect: initialData.prospect
                });

                setToEmail(initialData.contactEmail || '');
            }
        } catch (e) {
            setError('Failed to load data');
        } finally {
            setLoading(false);
        }
    }

    function handleInsertSuggestion(text: string) {
        setDraftContent(text);
        setActiveTab('compose');
    }

    const hasThread = (thread?.messages?.length ?? 0) > 0;
    const hasEmail = !!toEmail;

    const tabs: { id: Tab; label: string; disabled?: boolean }[] = [
        { id: 'thread', label: 'Thread' },
        { id: 'ai', label: 'AI' },
        { id: 'compose', label: 'Compose' }
    ];

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(6px)' }}
        >
            <div className="absolute inset-0" onClick={onClose} />

            {/* Modal Panel */}
            <div
                ref={containerRef}
                className="relative z-10 w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                style={{
                    background: 'var(--bg-card)',
                    borderRadius: '20px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                    border: '1px solid var(--border-soft)'
                }}
            >
                {/* Header */}
                <div
                    className="px-6 py-5 flex items-start justify-between shrink-0"
                    style={{ borderBottom: '1px solid var(--border-soft)' }}
                >
                    <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-3 mb-1">
                            {thread?.company.id ? (
                                <Link
                                    href={`/company/${thread.company.id}`}
                                    className="text-xl font-bold truncate hover:underline decoration-dotted"
                                    style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
                                >
                                    {thread?.company.name || 'Conversation'}
                                </Link>
                            ) : (
                                <h2
                                    className="text-xl font-bold truncate"
                                    style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
                                >
                                    {thread?.company.name || 'Conversation'}
                                </h2>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                            {thread?.contact.name && (
                                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                                    {thread.contact.name}
                                </span>
                            )}
                            {thread?.contact.email && (
                                <span style={{ color: 'var(--text-muted)' }}>
                                    &lt;{thread.contact.email}&gt;
                                </span>
                            )}
                            {!thread?.contact.email && (
                                <span className="italic" style={{ color: 'var(--text-muted)' }}>
                                    No email found
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Header Actions */}
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => navigator.clipboard.writeText(window.location.href)}
                            className="p-2.5 transition-all hover:bg-gray-100 rounded-lg"
                            style={{ color: 'var(--text-muted)' }}
                            title="Copy link"
                        >
                            <Copy size={16} />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2.5 transition-all hover:bg-gray-100 rounded-lg"
                            style={{ color: 'var(--text-muted)' }}
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div
                    className="px-6 py-2 flex items-center gap-1 shrink-0"
                    style={{ borderBottom: '1px solid var(--border-soft)' }}
                >
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            disabled={tab.disabled}
                            className="px-4 py-2 text-sm font-medium rounded-lg transition-all"
                            style={{
                                background: activeTab === tab.id ? 'var(--brand-soft)' : 'transparent',
                                color: activeTab === tab.id ? 'var(--brand)' : 'var(--text-secondary)',
                                opacity: tab.disabled ? 0.5 : 1
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full py-16">
                            <Loader2 className="animate-spin mb-3" size={32} style={{ color: 'var(--text-muted)' }} />
                            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center h-full py-16">
                            <div
                                className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
                                style={{ background: 'rgba(239, 68, 68, 0.1)' }}
                            >
                                <AlertCircle size={24} style={{ color: 'rgb(239, 68, 68)' }} />
                            </div>
                            <p className="mb-4 font-medium" style={{ color: 'var(--text-primary)' }}>
                                {error}
                            </p>
                            <button
                                onClick={fetchThreadData}
                                className="btn btn-secondary"
                            >
                                <RefreshCw size={14} />
                                Try again
                            </button>
                        </div>
                    ) : (
                        <>
                            {activeTab === 'thread' && (
                                <ModalErrorBoundary componentName="Thread">
                                    <ThreadMessages
                                        messages={thread?.messages || []}
                                        partial={thread?.partial}
                                        partialReason={thread?.partialReason}
                                        retryable={thread?.retryable}
                                        onRetry={fetchThreadData}
                                        onComposeClick={() => setActiveTab('compose')}
                                    />
                                </ModalErrorBoundary>
                            )}

                            {activeTab === 'ai' && (
                                <ModalErrorBoundary componentName="AI Assistant">
                                    <AIAssistPanel
                                        emailId={emailId}
                                        thread={thread}
                                        summary={aiSummary}
                                        onSummaryChange={setAiSummary}
                                        suggestedReplies={suggestedReplies}
                                        onSuggestedRepliesChange={setSuggestedReplies}
                                        onInsert={handleInsertSuggestion}
                                    />
                                </ModalErrorBoundary>
                            )}

                            {activeTab === 'compose' && (
                                <ModalErrorBoundary componentName="Compose">
                                    <ComposePane
                                        thread={thread}
                                        leadId={leadId}
                                        emailId={emailId}
                                        toEmail={toEmail}
                                        onToEmailChange={setToEmail}
                                        subject={draftSubject}
                                        onSubjectChange={setDraftSubject}
                                        content={draftContent}
                                        onContentChange={setDraftContent}
                                        onSuccess={() => {
                                            onSuccess?.();
                                            onClose();
                                        }}
                                    />
                                </ModalErrorBoundary>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
