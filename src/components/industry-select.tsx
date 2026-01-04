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
            <label className="block text-sm font-medium text-gray-700 mb-1">Industries</label>
            <div
                className="w-full border rounded-md px-3 py-2 bg-white min-h-[42px] cursor-pointer flex flex-wrap gap-2 items-center"
                onClick={() => setIsOpen(!isOpen)}
            >
                {selected.length === 0 && <span className="text-gray-400 text-sm">Select industries...</span>}
                {selected.map(label => (
                    <span key={label} className="bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded flex items-center gap-1 border border-blue-100">
                        {label}
                        <button onClick={(e) => removeSelection(e, label)} className="hover:text-blue-900"><X size={12} /></button>
                    </span>
                ))}
                <div className="ml-auto pointer-events-none text-gray-400">
                    <ChevronDown size={16} />
                </div>
            </div>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute z-50 w-[400px] mt-2 bg-white border border-gray-200 rounded-lg shadow-xl max-h-[400px] overflow-y-auto left-0">
                    <div className="p-2 sticky top-0 bg-white border-b border-gray-100 pb-2 mb-2">
                        <p className="text-xs text-gray-500 font-medium px-2">
                            Industries are mapped to Companies House SIC codes.
                        </p>
                    </div>
                    <div className="p-2 space-y-4">
                        {INDUSTRY_TAXONOMY.map(group => (
                            <div key={group.key}>
                                <h4 className="text-xs uppercase font-bold text-gray-500 mb-2 px-2">{group.label}</h4>
                                <div className="space-y-1">
                                    {group.items.map(item => {
                                        const isSelected = selected.includes(item.label);
                                        return (
                                            <div
                                                key={item.label}
                                                className={`flex items-start gap-3 p-2 rounded cursor-pointer hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}
                                                onClick={() => toggleSelection(item.label)}
                                            >
                                                <div className={`mt-0.5 w-4 h-4 border rounded flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                                                    {isSelected && <Check size={12} className="text-white" />}
                                                </div>
                                                <div>
                                                    <span className={`text-sm block ${isSelected ? 'text-blue-900 font-medium' : 'text-gray-700'}`}>
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
