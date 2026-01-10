import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    helperText?: string;
    icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ label, error, helperText, icon, className = '', ...props }, ref) => {
        return (
            <div className="w-full">
                {label && <label className="label">{label}</label>}
                <div className="relative">
                    {icon && (
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                            {icon}
                        </div>
                    )}
                    <input
                        ref={ref}
                        className={`input ${error ? 'input-error' : ''} ${icon ? 'pl-10' : ''} ${className}`}
                        {...props}
                    />
                </div>
                {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
                {helperText && !error && <p className="helper-text">{helperText}</p>}
            </div>
        );
    }
);

Input.displayName = "Input";
