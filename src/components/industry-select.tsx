'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';
import { INDUSTRY_TAXONOMY } from '@/lib/taxonomy';

interface IndustrySelectProps {
    selected: string[]; // List of Labels
    onChange: (selected: string[]) => void;
}

export default function IndustrySelect({ selected, onChange }: IndustrySelectProps) {
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

    const toggleSelection = (label: string) => {
        if (selected.includes(label)) {
            onChange(selected.filter(s => s !== label));
        } else {
            onChange([...selected, label]);
        }
    };

    const removeSelection = (e: React.MouseEvent, label: string) => {
        e.stopPropagation();
        onChange(selected.filter(s => s !== label));
    };

    return (
        <div className="relative" ref={containerRef}>
            <label className="label">Industries</label>
            <div
                className={`
                    min-h-[42px] cursor-pointer flex flex-wrap gap-2 items-center
                    input h-auto py-1.5
                    ${isOpen ? 'ring-2 ring-indigo-100 border-indigo-500' : ''}
                `}
                onClick={() => setIsOpen(!isOpen)}
            >
                {selected.length === 0 && <span className="text-gray-400 text-sm">Select industries...</span>}
                {selected.map(label => (
                    <span key={label} className="badge badge-neutral bg-indigo-50 text-indigo-700 border-indigo-100 flex items-center gap-1 pl-2 pr-1 h-7">
                        {label}
                        <button
                            onClick={(e) => removeSelection(e, label)}
                            className="hover:bg-indigo-200 rounded-full p-0.5 transition-colors"
                        >
                            <X size={12} />
                        </button>
                    </span>
                ))}
                <div className="ml-auto pointer-events-none text-gray-400 pl-2">
                    <ChevronDown size={16} />
                </div>
            </div>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute z-50 w-[400px] mt-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-[400px] overflow-y-auto left-0 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-3 sticky top-0 bg-white border-b border-gray-100 pb-2 mb-2 z-10">
                        <p className="text-xs text-gray-500 font-medium px-1 flex items-center gap-1">
                            <Check size={12} className="text-green-600" />
                            Industries mapped to SIC codes
                        </p>
                    </div>
                    <div className="p-2 space-y-4">
                        {INDUSTRY_TAXONOMY.map(group => (
                            <div key={group.key}>
                                <h4 className="text-[10px] uppercase font-bold text-gray-400 mb-2 px-2 tracking-wider">{group.label}</h4>
                                <div className="space-y-0.5">
                                    {group.items.map(item => {
                                        const isSelected = selected.includes(item.label);
                                        return (
                                            <div
                                                key={item.label}
                                                className={`
                                                    flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors
                                                    ${isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'}
                                                `}
                                                onClick={() => toggleSelection(item.label)}
                                            >
                                                <div className={`
                                                    w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors
                                                    ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'}
                                                `}>
                                                    {isSelected && <Check size={10} className="text-white" />}
                                                </div>
                                                <div>
                                                    <span className={`text-sm block ${isSelected ? 'text-indigo-900 font-medium' : 'text-gray-700'}`}>
                                                        {item.label}
                                                    </span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
