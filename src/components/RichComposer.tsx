'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
    Bold, Italic, Underline, List, ListOrdered, Link2,
    RemoveFormatting, Send, Save, Loader2
} from 'lucide-react';

interface RichComposerProps {
    to: string;
    subject: string;
    initialValue?: string;
    onSend: (html: string, plainText: string) => Promise<void>;
    onSaveDraft?: (html: string) => void;
    disabled?: boolean;
}

export default function RichComposer({
    to,
    subject,
    initialValue = '',
    onSend,
    onSaveDraft,
    disabled = false
}: RichComposerProps) {
    const editorRef = useRef<HTMLDivElement>(null);
    const [sending, setSending] = useState(false);
    const [draftSaved, setDraftSaved] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);

    useEffect(() => {
        if (editorRef.current && initialValue) {
            editorRef.current.innerHTML = initialValue;
        }
    }, [initialValue]);

    useEffect(() => {
        const interval = setInterval(() => {
            if (editorRef.current && onSaveDraft) {
                const content = editorRef.current.innerHTML;
                if (content && content !== '<br>') {
                    onSaveDraft(content);
                    setLastSaved(new Date());
                }
            }
        }, 15000);
        return () => clearInterval(interval);
    }, [onSaveDraft]);

    const execCommand = useCallback((command: string, value?: string) => {
        document.execCommand(command, false, value);
        editorRef.current?.focus();
    }, []);

    const handleBold = () => execCommand('bold');
    const handleItalic = () => execCommand('italic');
    const handleUnderline = () => execCommand('underline');
    const handleBulletList = () => execCommand('insertUnorderedList');
    const handleNumberedList = () => execCommand('insertOrderedList');
    const handleRemoveFormat = () => execCommand('removeFormat');

    const handleLink = () => {
        const url = prompt('Enter URL:');
        if (url) {
            execCommand('createLink', url);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'b' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleBold();
        }
        if (e.key === 'i' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleItalic();
        }
        if (e.key === 'u' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleUnderline();
        }
    };

    const getPlainText = (): string => {
        if (!editorRef.current) return '';
        const temp = document.createElement('div');
        temp.innerHTML = editorRef.current.innerHTML;
        return temp.textContent || temp.innerText || '';
    };

    const getHtml = (): string => {
        return editorRef.current?.innerHTML || '';
    };

    const handleSend = async () => {
        const html = getHtml();
        const plainText = getPlainText();

        if (!plainText.trim()) return;

        try {
            setSending(true);
            await onSend(html, plainText);
            if (editorRef.current) {
                editorRef.current.innerHTML = '';
            }
        } finally {
            setSending(false);
        }
    };

    const handleSaveDraft = () => {
        if (onSaveDraft && editorRef.current) {
            onSaveDraft(editorRef.current.innerHTML);
            setDraftSaved(true);
            setLastSaved(new Date());
            setTimeout(() => setDraftSaved(false), 2000);
        }
    };

    return (
        <div style={{ background: 'var(--bg-card)' }}>
            {/* To/Subject Header */}
            <div
                className="px-5 py-3"
                style={{ borderBottom: '1px solid var(--border-soft)' }}
            >
                <div
                    className="flex items-center gap-2 text-sm"
                    style={{ color: 'var(--text-secondary)' }}
                >
                    <span className="font-semibold" style={{ color: 'var(--text-muted)' }}>To:</span>
                    <span style={{ color: 'var(--text-primary)' }}>{to}</span>
                </div>
                <div
                    className="flex items-center gap-2 text-sm mt-1.5"
                    style={{ color: 'var(--text-secondary)' }}
                >
                    <span className="font-semibold" style={{ color: 'var(--text-muted)' }}>Subject:</span>
                    <span className="truncate" style={{ color: 'var(--text-primary)' }}>Re: {subject}</span>
                </div>
            </div>

            {/* Formatting Toolbar */}
            <div
                className="px-4 py-2.5 flex items-center gap-1 flex-wrap"
                style={{
                    borderBottom: '1px solid var(--border-soft)',
                    background: 'var(--bg-card-muted)'
                }}
            >
                <ToolbarButton onClick={handleBold} title="Bold (⌘B)">
                    <Bold size={15} />
                </ToolbarButton>
                <ToolbarButton onClick={handleItalic} title="Italic (⌘I)">
                    <Italic size={15} />
                </ToolbarButton>
                <ToolbarButton onClick={handleUnderline} title="Underline (⌘U)">
                    <Underline size={15} />
                </ToolbarButton>

                <div
                    className="mx-2"
                    style={{ width: '1px', height: '18px', background: 'var(--border-default)' }}
                />

                <ToolbarButton onClick={handleBulletList} title="Bullet list">
                    <List size={15} />
                </ToolbarButton>
                <ToolbarButton onClick={handleNumberedList} title="Numbered list">
                    <ListOrdered size={15} />
                </ToolbarButton>

                <div
                    className="mx-2"
                    style={{ width: '1px', height: '18px', background: 'var(--border-default)' }}
                />

                <ToolbarButton onClick={handleLink} title="Insert link">
                    <Link2 size={15} />
                </ToolbarButton>
                <ToolbarButton onClick={handleRemoveFormat} title="Remove formatting">
                    <RemoveFormatting size={15} />
                </ToolbarButton>

                {lastSaved && (
                    <span
                        className="ml-auto text-[10px]"
                        style={{ color: 'var(--text-muted)' }}
                    >
                        Draft saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                )}
            </div>

            {/* Editor */}
            <div
                ref={editorRef}
                contentEditable={!disabled}
                onKeyDown={handleKeyDown}
                className="min-h-[140px] max-h-[240px] overflow-y-auto px-5 py-4 text-sm focus:outline-none"
                style={{
                    lineHeight: 1.7,
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-body)'
                }}
                data-placeholder="Write your reply..."
            />

            {/* Actions Footer */}
            <div
                className="px-5 py-4 flex items-center justify-between"
                style={{ borderTop: '1px solid var(--border-soft)' }}
            >
                <button
                    onClick={handleSaveDraft}
                    disabled={disabled}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-all"
                    style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-button)',
                        color: 'var(--text-primary)'
                    }}
                >
                    <Save size={14} />
                    {draftSaved ? 'Saved!' : 'Save Draft'}
                </button>

                <button
                    onClick={handleSend}
                    disabled={disabled || sending}
                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-all"
                    style={{
                        background: 'var(--text-primary)',
                        color: 'white',
                        borderRadius: 'var(--radius-button)',
                        boxShadow: 'var(--shadow-card)',
                        opacity: disabled || sending ? 0.6 : 1
                    }}
                >
                    {sending ? (
                        <>
                            <Loader2 size={16} className="animate-spin" />
                            Sending...
                        </>
                    ) : (
                        <>
                            <Send size={16} />
                            Send
                        </>
                    )}
                </button>
            </div>

            <style jsx>{`
                [contenteditable]:empty:before {
                    content: attr(data-placeholder);
                    color: var(--text-muted);
                    pointer-events: none;
                }
            `}</style>
        </div>
    );
}

function ToolbarButton({
    onClick,
    title,
    children
}: {
    onClick: () => void;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            title={title}
            className="p-2 transition-all"
            style={{
                background: 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-secondary)'
            }}
        >
            {children}
        </button>
    );
}
