
'use client';

import { useState } from 'react';
import { CompanyProfilePopup } from './CompanyProfilePopup';

interface Props {
    prospectId: number;
    name: string;
    className?: string;
    onAddToLeads?: () => void;
    onCompose?: () => void;
}

export function CompanyNameLink({ prospectId, name, className = '', onAddToLeads, onCompose }: Props) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className={`text-left hover:text-blue-600 hover:underline transition-colors cursor-pointer ${className}`}
            >
                {name}
            </button>

            {isOpen && (
                <CompanyProfilePopup
                    prospectId={prospectId}
                    onClose={() => setIsOpen(false)}
                    onAddToLeads={onAddToLeads}
                    onCompose={onCompose}
                />
            )}
        </>
    );
}
