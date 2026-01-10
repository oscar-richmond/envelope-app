'use client';

import { X, AlertTriangle } from 'lucide-react';

interface ConfirmDeleteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    companyName: string;
    isDeleting?: boolean;
}

export default function ConfirmDeleteModal({
    isOpen,
    onClose,
    onConfirm,
    companyName,
    isDeleting = false
}: ConfirmDeleteModalProps) {
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
                    <div className="flex items-center gap-3">
                        <div
                            className="w-10 h-10 rounded-[var(--radius-md)] flex items-center justify-center"
                            style={{ background: 'var(--error-light)', color: 'var(--error-text)' }}
                        >
                            <AlertTriangle size={20} />
                        </div>
                        <h3
                            className="text-lg font-bold"
                            style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
                        >
                            Remove lead?
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 transition-all"
                        style={{ color: 'var(--text-muted)', borderRadius: 'var(--radius-md)' }}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5">
                    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        This will remove <strong style={{ color: 'var(--text-primary)' }}>{companyName}</strong> from your Lead Board.
                        You can re-add it later from Prospect Search.
                    </p>
                    <p
                        className="mt-3 text-sm"
                        style={{ color: 'var(--text-muted)' }}
                    >
                        Your Gmail drafts and sent emails will not be affected.
                    </p>
                </div>

                {/* Footer */}
                <div
                    className="px-6 py-4 flex items-center justify-end gap-3"
                    style={{
                        borderTop: '1px solid var(--border-soft)',
                        background: 'var(--bg-card-muted)'
                    }}
                >
                    <button
                        onClick={onClose}
                        className="px-4 py-2.5 text-sm font-semibold transition-all"
                        style={{
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-default)',
                            borderRadius: 'var(--radius-button)',
                            color: 'var(--text-primary)'
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isDeleting}
                        className="px-5 py-2.5 text-sm font-semibold transition-all flex items-center gap-2"
                        style={{
                            background: 'var(--error)',
                            color: 'white',
                            borderRadius: 'var(--radius-button)',
                            opacity: isDeleting ? 0.6 : 1
                        }}
                    >
                        {isDeleting ? 'Removing...' : 'Remove'}
                    </button>
                </div>
            </div>
        </div>
    );
}
