'use client';

import { useState } from 'react';
import { Building2 } from 'lucide-react';

interface CompanyLogoProps {
    name: string;
    domain?: string;
    src?: string | null;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
}

export default function CompanyLogo({ name, domain, src, size = 'md', className = '' }: CompanyLogoProps) {
    const [imageError, setImageError] = useState(false);
    const [clearbitError, setClearbitError] = useState(false);
    const [faviconError, setFaviconError] = useState(false);

    // Size mappings
    const sizeClasses = {
        sm: 'w-8 h-8 text-xs',
        md: 'w-12 h-12 text-sm',
        lg: 'w-16 h-16 text-lg',
        xl: 'w-20 h-20 text-xl'
    };

    // 1. DB/Prop Source
    if (src && !imageError) {
        return (
            <div className={`relative shrink-0 rounded-full overflow-hidden bg-white shadow-sm border border-gray-100 ${sizeClasses[size]} ${className}`}>
                <img
                    src={src}
                    alt={`${name} logo`}
                    className="w-full h-full object-contain p-1"
                    onError={() => setImageError(true)}
                />
            </div>
        );
    }

    // 2. Clearbit
    if (domain && !clearbitError) {
        return (
            <div className={`relative shrink-0 rounded-full overflow-hidden bg-white shadow-sm border border-gray-100 ${sizeClasses[size]} ${className}`}>
                <img
                    src={`https://logo.clearbit.com/${domain}`}
                    alt={`${name} logo`}
                    className="w-full h-full object-contain p-1"
                    onError={() => setClearbitError(true)}
                />
            </div>
        );
    }

    // 3. Google Favicon
    if (domain && !faviconError) {
        return (
            <div className={`relative shrink-0 rounded-full overflow-hidden bg-white shadow-sm border border-gray-100 ${sizeClasses[size]} ${className}`}>
                <img
                    src={`https://www.google.com/s2/favicons?domain=${domain}&sz=128`}
                    alt={`${name} favicon`}
                    className="w-full h-full object-contain p-2"
                    onError={() => setFaviconError(true)}
                />
            </div>
        );
    }

    // 4. Initials / Fallback
    const initials = name
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

    // Generate a deterministic color based on name
    const colors = [
        'from-blue-500 to-indigo-600',
        'from-emerald-500 to-teal-600',
        'from-orange-500 to-red-600',
        'from-pink-500 to-rose-600',
        'from-violet-500 to-purple-600',
        'from-cyan-500 to-blue-600'
    ];
    const colorIndex = name.length % colors.length;
    const gradient = colors[colorIndex];

    return (
        <div className={`relative shrink-0 rounded-full flex items-center justify-center text-white font-bold shadow-sm bg-gradient-to-br ${gradient} ${sizeClasses[size]} ${className}`}>
            {initials || <Building2 className="w-1/2 h-1/2 opacity-80" />}
        </div>
    );
}
