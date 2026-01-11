'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, Check } from 'lucide-react';

interface DateRangeOption {
    label: string;
    value: string;
}

interface DateRangeSelectProps {
    value: string;
    onChange: (value: string) => void;
    options?: DateRangeOption[];
    className?: string;
}

const DEFAULT_OPTIONS: DateRangeOption[] = [
    { label: 'Last 7 days', value: '7' },
    { label: 'Last 14 days', value: '14' },
    { label: 'Last 30 days', value: '30' },
    { label: 'Last 90 days', value: '90' },
];

/**
 * Clean date range dropdown
 * Premium styling with hover/focus states
 */
export function DateRangeSelect({
    value,
    onChange,
    options = DEFAULT_OPTIONS,
    className = ''
}: DateRangeSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = options.find(o => o.value === value) || options[0];

    return (
        <div ref={ref} className={`date-range-select ${className}`}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="date-range-trigger"
            >
                <Calendar size={14} className="date-range-icon" />
                <span>{selectedOption.label}</span>
                <ChevronDown
                    size={14}
                    className={`date-range-chevron ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {isOpen && (
                <div className="date-range-dropdown">
                    {options.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                                onChange(option.value);
                                setIsOpen(false);
                            }}
                            className={`date-range-option ${option.value === value ? 'active' : ''}`}
                        >
                            <span>{option.label}</span>
                            {option.value === value && (
                                <Check size={14} className="date-range-check" />
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export default DateRangeSelect;
