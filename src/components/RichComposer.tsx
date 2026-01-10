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

    // Initialize editor content
    useEffect(() => {
        if (editorRef.current && initialValue) {
            editorRef.current.innerHTML = initialValue;
        }
    }, [initialValue]);

    // Autosave draft every 15 seconds (in-app only)
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
        // Convert HTML to plain text
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
            // Clear editor on success
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
        <div className="bg-white border-t border-gray-200">
            {/* To/Subject (read-only) */}
            <div className="px-4 py-2 border-b border-gray-100 text-xs text-gray-500">
                <div className="flex items-center gap-2">
                    <span className="font-medium">To:</span>
                    <span>{to}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                    <span className="font-medium">Subject:</span>
                    <span className="truncate">Re: {subject}</span>
                </div>
            </div>

            {/* Formatting toolbar */}
            <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-1 flex-wrap">
                <ToolbarButton onClick={handleBold} title="Bold (⌘B)">
                    <Bold size={14} />
                </ToolbarButton>
                <ToolbarButton onClick={handleItalic} title="Italic (⌘I)">
                    <Italic size={14} />
                </ToolbarButton>
                <ToolbarButton onClick={handleUnderline} title="Underline (⌘U)">
                    <Underline size={14} />
                </ToolbarButton>
                <div className="w-px h-4 bg-gray-200 mx-1" />
                <ToolbarButton onClick={handleBulletList} title="Bullet list">
                    <List size={14} />
                </ToolbarButton>
                <ToolbarButton onClick={handleNumberedList} title="Numbered list">
                    <ListOrdered size={14} />
                </ToolbarButton>
                <div className="w-px h-4 bg-gray-200 mx-1" />
                <ToolbarButton onClick={handleLink} title="Insert link">
                    <Link2 size={14} />
                </ToolbarButton>
                <ToolbarButton onClick={handleRemoveFormat} title="Remove formatting">
                    <RemoveFormatting size={14} />
                </ToolbarButton>

                {lastSaved && (
                    <span className="ml-auto text-[10px] text-gray-400">
                        Draft saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                )}
            </div>

            {/* Editor */}
            <div
                ref={editorRef}
                contentEditable={!disabled}
                onKeyDown={handleKeyDown}
                className="min-h-[120px] max-h-[200px] overflow-y-auto px-4 py-3 text-sm text-gray-700 focus:outline-none"
                style={{ lineHeight: 1.6 }}
                data-placeholder="Write your reply..."
            />

            {/* Actions */}
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
                <button
                    onClick={handleSaveDraft}
                    disabled={disabled}
                    className="btn btn-tertiary text-xs py-1.5 h-8"
                >
                    <Save size={14} />
                    {draftSaved ? 'Saved!' : 'Save Draft'}
                </button>

                <button
                    onClick={handleSend}
                    disabled={disabled || sending}
                    className="btn btn-primary"
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
                    color: #9ca3af;
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
            className="btn btn-tertiary p-1.5 h-7 w-7 justify-center"
        >
            {children}
        </button>
    );
}
