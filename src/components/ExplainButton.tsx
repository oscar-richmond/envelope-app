import React from 'react';
import { Info } from 'lucide-react';

interface ExplainButtonProps {
    onClick: (e: React.MouseEvent) => void;
    label?: string;
    title?: string;
    className?: string;
}

const ExplainButton: React.FC<ExplainButtonProps> = ({
    onClick,
    label = "Why?",
    title = "See how this score was calculated",
    className = ""
}) => {
    return (
        <button
            onClick={(e) => {
                e.stopPropagation();
                onClick(e);
            }}
            className={`
                group/explain
                inline-flex items-center gap-1.5 
                px-2 py-1 
                rounded-full 
                text-xs font-medium 
                text-gray-500 
                bg-gray-50/50 hover:bg-white
                border border-transparent hover:border-gray-200 hover:shadow-sm
                transition-all duration-200
                focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300
                min-h-[24px] min-w-[60px] justify-center
                cursor-pointer
                ${className}
            `}
            title={title}
            aria-label={title}
        >
            <Info size={12} className="text-gray-400 group-hover/explain:text-blue-500 transition-colors" />
            <span className="group-hover/explain:text-gray-700 transition-colors">{label}</span>
        </button>
    );
};

export default ExplainButton;
