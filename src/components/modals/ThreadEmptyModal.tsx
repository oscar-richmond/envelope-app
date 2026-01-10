'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Mail, Send, PenTool, ChevronRight, Loader2 } from 'lucide-react';
import RichComposer from '@/components/RichComposer';

interface ThreadEmptyModalProps {
    isOpen: boolean;
    onClose: () => void;
    companyName: string;
    onComposeOutreach: () => void;
}

export function ThreadEmptyModal({
    isOpen,
    onClose,
    companyName,
    onComposeOutreach
}: ThreadEmptyModalProps) {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(4px)' }}
        >
            <div className="absolute inset-0" onClick={onClose} />

            <div
                className="relative z-10 w-full max-w-md animate-in fade-in zoom-in-95 duration-200"
                style={{
                    background: 'var(--bg-card)',
                    borderRadius: 'var(--radius-xl)',
                    boxShadow: 'var(--shadow-float)',
                    border: '1px solid var(--border-soft)',
                    overflow: 'hidden'
                }}
            >
                {/* Header */}
                <div
                    className="px-6 py-4 flex items-center justify-between"
                    style={{ borderBottom: '1px solid var(--border-soft)' }}
                >
                    <h3
                        className="text-lg font-bold"
                        style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
                    >
                        {companyName}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 transition-all"
                        style={{ color: 'var(--text-muted)', borderRadius: 'var(--radius-md)' }}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-10 text-center">
                    <div
                        className="w-16 h-16 rounded-[var(--radius-xl)] flex items-center justify-center mx-auto mb-4"
                        style={{ background: 'var(--bg-card-muted)', color: 'var(--text-muted)' }}
                    >
                        <Mail size={28} />
                    </div>
                    <h4
                        className="text-base font-semibold mb-2"
                        style={{ color: 'var(--text-primary)' }}
                    >
                        No email thread yet
                    </h4>
                    <p
                        className="text-sm"
                        style={{ color: 'var(--text-muted)' }}
                    >
                        Send your first outreach to start a conversation.
                    </p>
                </div>

                {/* Footer */}
                <div
                    className="px-6 py-4 flex items-center justify-center gap-3"
                    style={{
                        borderTop: '1px solid var(--border-soft)',
                        background: 'var(--bg-card-muted)'
                    }}
                >
                    <button
                        onClick={() => {
                            onClose();
                            onComposeOutreach();
                        }}
                        className="px-5 py-2.5 text-sm font-semibold transition-all flex items-center gap-2"
                        style={{
                            background: 'var(--accent-lilac-bg)',
                            color: 'var(--accent-lilac-text)',
                            borderRadius: 'var(--radius-button)',
                            border: '1px solid rgba(184, 166, 255, 0.3)'
                        }}
                    >
                        <PenTool size={16} />
                        Compose outreach
                    </button>
                </div>
            </div>
        </div>
    );
}
