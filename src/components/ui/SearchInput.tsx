'use client';

import React from 'react';
import { Search } from 'lucide-react';

interface SearchInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

/**
 * Standardized search input with icon
 * Premium styling with consistent focus states
 */
export function SearchInput({
    value,
    onChange,
    placeholder = 'Search...',
    className = ''
}: SearchInputProps) {
    return (
        <div className={`search-input-wrapper ${className}`}>
            <Search
                size={16}
                className="search-input-icon"
            />
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="search-input"
            />
        </div>
    );
}

export default SearchInput;
