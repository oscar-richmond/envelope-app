'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';

interface MultiSelectOption {
    value: string;
    label: string;
}

interface MultiSelectProps {
    label: string;
    options: MultiSelectOption[];
    selected: string[];
    onChange: (selected: string[]) => void;
    placeholder?: string;
    maxVisible?: number; // Max chips to show before collapsing to "+N more"
}

export default function MultiSelect({
    label,
    options,
    selected,
    onChange,
    placeholder = 'Select...',
    maxVisible = 2
}: MultiSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleSelection = (value: string) => {
        if (selected.includes(value)) {
            onChange(selected.filter(s => s !== value));
        } else {
            onChange([...selected, value]);
        }
    };

    const removeSelection = (e: React.MouseEvent, value: string) => {
        e.stopPropagation();
        onChange(selected.filter(s => s !== value));
    };

    const clearAll = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange([]);
    };

    // Get display labels for selected values
    const getLabel = (value: string) => {
        const option = options.find(o => o.value === value);
        return option?.label || value;
    };

    // Split visible and hidden chips
    const visibleChips = selected.slice(0, maxVisible);
    const hiddenCount = selected.length - maxVisible;

    return (
        <div className="relative" ref={containerRef}>
            <label className="label">{label}</label>
            <div
                className={`
                    min-h-[42px] cursor-pointer flex flex-wrap gap-1.5 items-center
                    input h-auto py-1.5 pr-8
                    ${isOpen ? 'ring-2 ring-indigo-100 border-indigo-500' : ''}
                `}
                onClick={() => setIsOpen(!isOpen)}
            >
                {selected.length === 0 && (
                    <span className="text-gray-400 text-sm">{placeholder}</span>
                )}
                {visibleChips.map(value => (
                    <span
                        key={value}
                        className="badge badge-neutral bg-indigo-50 text-indigo-700 border-indigo-100 flex items-center gap-1 pl-2 pr-1 h-6 text-xs"
                    >
                        {getLabel(value)}
                        <button
                            onClick={(e) => removeSelection(e, value)}
                            className="hover:bg-indigo-200 rounded-full p-0.5 transition-colors"
                        >
                            <X size={10} />
                        </button>
                    </span>
                ))}
                {hiddenCount > 0 && (
                    <span className="text-xs text-gray-500 font-medium">
                        +{hiddenCount} more
                    </span>
                )}
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {selected.length > 0 && (
                        <button
                            onClick={clearAll}
                            className="p-1 hover:bg-gray-100 rounded transition-colors text-gray-400 hover:text-gray-600"
                            title="Clear all"
                        >
                            <X size={14} />
                        </button>
                    )}
                    <ChevronDown size={16} className="text-gray-400 pointer-events-none" />
                </div>
            </div>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-[280px] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-1">
                        {options.map(option => {
                            const isSelected = selected.includes(option.value);
                            return (
                                <div
                                    key={option.value}
                                    className={`
                                        flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors
                                        ${isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'}
                                    `}
                                    onClick={() => toggleSelection(option.value)}
                                >
                                    <div className={`
                                        w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors
                                        ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'}
                                    `}>
                                        {isSelected && <Check size={10} className="text-white" />}
                                    </div>
                                    <span className={`text-sm ${isSelected ? 'text-indigo-900 font-medium' : 'text-gray-700'}`}>
                                        {option.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
