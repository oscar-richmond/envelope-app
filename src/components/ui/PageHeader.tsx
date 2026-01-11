'use client';

import React from 'react';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    actions?: React.ReactNode;
    filters?: React.ReactNode;
    className?: string;
}

/**
 * Standardized page header component
 * Selfhood-style: minimal, premium, consistent
 */
export function PageHeader({
    title,
    subtitle,
    actions,
    filters,
    className = ''
}: PageHeaderProps) {
    return (
        <header className={`page-header-wrapper ${className}`}>
            {/* Row 1: Title + Actions */}
            <div className="page-header-row">
                <div className="page-header-left">
                    <h1 className="page-header-title">{title}</h1>
                    {subtitle && (
                        <p className="page-header-subtitle">{subtitle}</p>
                    )}
                </div>
                {actions && (
                    <div className="page-header-actions">
                        {actions}
                    </div>
                )}
            </div>

            {/* Row 2: Filters (optional) */}
            {filters && (
                <div className="page-header-filters">
                    {filters}
                </div>
            )}
        </header>
    );
}

export default PageHeader;
