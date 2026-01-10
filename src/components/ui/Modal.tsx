'use client';

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: React.ReactNode;
    children: React.ReactNode;
    footer?: React.ReactNode;
    maxWidth?: string;
}

export default function Modal({
    isOpen,
    onClose,
    title,
    children,
    footer,
    maxWidth = '600px'
}: ModalProps) {
    const overlayRef = useRef<HTMLDivElement>(null);

    // Close on escape
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        if (isOpen) {
            document.body.style.overflow = 'hidden';
            window.addEventListener('keydown', handleEscape);
        }

        return () => {
            document.body.style.overflow = '';
            window.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    // Use portal to render at root level
    if (typeof document === 'undefined') return null;

    return createPortal(
        <div className="modal-overlay flex items-center justify-center p-4">
            <div
                className="modal-overlay absolute inset-0"
                onClick={onClose}
                aria-hidden="true"
            />
            <div
                className="modal-content w-full flex flex-col max-h-[90vh]"
                style={{ maxWidth }}
                role="dialog"
                aria-modal="true"
            >
                {/* Header */}
                <div className="modal-header shrink-0">
                    <div className="modal-title">{title}</div>
                    <button
                        onClick={onClose}
                        className="btn btn-ghost p-1.5 rounded-full text-gray-400 hover:text-gray-600 -mr-2"
                        aria-label="Close modal"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body - Scrollable */}
                <div className="modal-body">
                    {children}
                </div>

                {/* Footer - Fixed at bottom */}
                {footer && (
                    <div className="modal-footer shrink-0">
                        {footer}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}

// Sub-components for custom layouts if needed
export function ModalHeader({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
    return (
        <div className="modal-header">
            <div className="modal-title">{children}</div>
            {onClose && (
                <button onClick={onClose} className="btn btn-ghost p-1.5 rounded-full text-gray-400 hover:text-gray-600">
                    <X size={20} />
                </button>
            )}
        </div>
    );
}

export function ModalBody({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return <div className={`modal-body ${className}`}>{children}</div>;
}

export function ModalFooter({ children }: { children: React.ReactNode }) {
    return <div className="modal-footer">{children}</div>;
}
