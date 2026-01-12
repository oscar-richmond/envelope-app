'use client';

import { useState, useRef, useEffect } from 'react';
import { useCompanyOverviewModal } from '@/components/modals/CompanyOverviewModalProvider';
import { getCompanyDisplayInfo, CompanyWithNumber } from '@/lib/utils/displayName';

interface CompanyNameProps {
    company: CompanyWithNumber;
    prospectId?: number;
    leadId?: number;
    variant?: 'header' | 'row' | 'inline';
    showMismatchTooltip?: boolean;
    className?: string;
    style?: React.CSSProperties;
}

/**
 * CompanyName Component
 * 
 * Displays brand name with optional legal name tooltip when there's a meaningful mismatch.
 * Use this everywhere company names appear for consistent behavior.
 */
export function CompanyName({
    company,
    prospectId,
    leadId,
    variant = 'row',
    showMismatchTooltip = true,
    className = '',
    style
}: CompanyNameProps) {
    const { openCompanyOverview } = useCompanyOverviewModal();
    const [tooltipVisible, setTooltipVisible] = useState(false);
    const [tooltipPosition, setTooltipPosition] = useState<'top' | 'bottom'>('bottom');
    const nameRef = useRef<HTMLButtonElement>(null);
    const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const info = getCompanyDisplayInfo(company);
    const showTooltip = showMismatchTooltip && info.hasMismatch;

    // Calculate tooltip position based on viewport
    useEffect(() => {
        if (tooltipVisible && nameRef.current) {
            const rect = nameRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            setTooltipPosition(spaceBelow < 100 ? 'top' : 'bottom');
        }
    }, [tooltipVisible]);

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (leadId) {
            openCompanyOverview({ leadId });
        } else if (prospectId) {
            openCompanyOverview({ prospectId });
        }
    };

    const handleMouseEnter = () => {
        if (!showTooltip) return;
        tooltipTimeoutRef.current = setTimeout(() => {
            setTooltipVisible(true);
        }, 200); // 200ms delay
    };

    const handleMouseLeave = () => {
        if (tooltipTimeoutRef.current) {
            clearTimeout(tooltipTimeoutRef.current);
        }
        setTooltipVisible(false);
    };

    const handleFocus = () => {
        if (showTooltip) setTooltipVisible(true);
    };

    const handleBlur = () => {
        setTooltipVisible(false);
    };

    // Variant-specific styles
    const variantStyles: Record<string, string> = {
        header: 'text-2xl font-bold',
        row: 'text-sm font-semibold',
        inline: 'text-sm font-medium'
    };

    return (
        <span className="relative inline-block">
            <button
                ref={nameRef}
                onClick={handleClick}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onFocus={handleFocus}
                onBlur={handleBlur}
                className={`
                    text-left transition-colors cursor-pointer 
                    hover:text-[var(--lilac-text)] hover:underline
                    focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)] focus:ring-offset-1
                    ${showTooltip ? 'decoration-dotted underline-offset-2' : ''}
                    ${variantStyles[variant]}
                    ${className}
                `}
                style={style}
                type="button"
                aria-describedby={showTooltip && tooltipVisible ? 'company-legal-tooltip' : undefined}
                aria-label={`${info.displayName}${showTooltip ? `. Legal name: ${info.legalName}` : ''}`}
            >
                {info.displayName}
            </button>

            {/* Tooltip */}
            {showTooltip && tooltipVisible && (
                <div
                    id="company-legal-tooltip"
                    role="tooltip"
                    className={`
                        absolute z-50 px-3 py-2 text-xs
                        bg-[var(--nav-bg)] text-white
                        rounded-lg shadow-lg
                        max-w-[260px] whitespace-normal
                        animate-in fade-in zoom-in-95 duration-150
                        ${tooltipPosition === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'}
                        left-0
                    `}
                    style={{
                        boxShadow: '0 4px 20px rgba(0,0,0,0.25)'
                    }}
                >
                    <div className="font-medium text-white/90 mb-1">Legal name:</div>
                    <div className="text-white/80 leading-relaxed">{info.legalName}</div>
                    {info.companyNumber && (
                        <div className="text-white/60 mt-1.5 pt-1.5 border-t border-white/10">
                            <span className="text-white/50">Registered no:</span> {info.companyNumber}
                        </div>
                    )}
                    <div className="text-white/40 mt-1 text-[10px]">Source: Companies House</div>

                    {/* Tooltip arrow */}
                    <div
                        className={`
                            absolute w-2 h-2 bg-[var(--nav-bg)] rotate-45
                            ${tooltipPosition === 'top' ? 'bottom-[-4px]' : 'top-[-4px]'}
                            left-4
                        `}
                    />
                </div>
            )}
        </span>
    );
}

/**
 * Simple version that just returns the display name string
 * Use when you don't need the interactive component
 */
export { displayName } from '@/lib/utils/displayName';
