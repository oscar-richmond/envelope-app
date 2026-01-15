'use client';

import { useState, useRef, useEffect } from 'react';
import { Info } from 'lucide-react';

interface InfoTooltipProps {
    title: string;
    body: string;
    className?: string;
}

/**
 * Info icon with tooltip
 * - Hover on desktop shows tooltip
 * - Click on mobile toggles tooltip
 * - Keyboard accessible (focusable, shows on focus)
 * - Closes when clicking outside
 */
export function InfoTooltip({ title, body, className = '' }: InfoTooltipProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    const handleMouseEnter = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setIsOpen(true);
    };

    const handleMouseLeave = () => {
        timeoutRef.current = setTimeout(() => setIsOpen(false), 150);
    };

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(prev => !prev);
    };

    const handleFocus = () => setIsOpen(true);
    const handleBlur = () => {
        timeoutRef.current = setTimeout(() => setIsOpen(false), 150);
    };

    return (
        <div
            ref={containerRef}
            className={`relative inline-flex items-center ${className}`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <button
                type="button"
                onClick={handleClick}
                onFocus={handleFocus}
                onBlur={handleBlur}
                className="
                    p-0.5 rounded-full transition-colors duration-150
                    text-[#B8BDC7] hover:text-[#8F97A6] focus:text-[#8F97A6]
                    focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20
                    cursor-pointer
                "
                aria-label={`Info about ${title}`}
                aria-expanded={isOpen}
            >
                <Info size={14} strokeWidth={2} />
            </button>

            {/* Tooltip */}
            <div
                className={`
                    absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-2
                    w-[260px] max-w-[90vw]
                    bg-white rounded-xl shadow-lg border border-[var(--border-soft)]
                    p-3
                    transition-all duration-150 origin-bottom
                    ${isOpen
                        ? 'opacity-100 translate-y-0 pointer-events-auto'
                        : 'opacity-0 translate-y-1 pointer-events-none'
                    }
                `}
                role="tooltip"
            >
                {/* Arrow */}
                <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-white" />

                <h4 className="text-xs font-bold text-[var(--text-primary)] mb-1">
                    {title}
                </h4>
                <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
                    {body}
                </p>
            </div>
        </div>
    );
}

export default InfoTooltip;
