'use client';

import Link from 'next/link';
import { Search, Columns3, List, PlusCircle } from 'lucide-react';

export default function QuickActions() {
    const actions = [
        {
            href: '/prospects',
            icon: Search,
            label: 'Find Prospects',
            description: 'Search for new leads',
            accent: 'brand' as const
        },
        {
            href: '/outreach/deals',
            icon: Columns3,
            label: 'View Pipeline',
            description: 'Track deal progress',
            accent: 'lilac' as const
        },
        {
            href: '/outreach',
            icon: List,
            label: 'Review Queue',
            description: 'Pending follow-ups',
            accent: 'mint' as const
        },
        {
            href: '/import',
            icon: PlusCircle,
            label: 'Import Leads',
            description: 'Upload CSV or add manually',
            accent: 'neutral' as const
        }
    ];

    const accentStyles: Record<string, {
        iconBg: string;
        iconColor: string;
        hoverBorder: string;
    }> = {
        brand: {
            iconBg: 'var(--brand-soft)',
            iconColor: 'var(--brand)',
            hoverBorder: 'var(--brand-border)'
        },
        lilac: {
            iconBg: 'var(--lilac-soft)',
            iconColor: 'var(--lilac-text)',
            hoverBorder: 'var(--chip-lilac-border)'
        },
        mint: {
            iconBg: 'var(--mint-soft)',
            iconColor: 'var(--mint-text)',
            hoverBorder: 'var(--chip-mint-border)'
        },
        neutral: {
            iconBg: 'var(--bg-card-muted)',
            iconColor: 'var(--text-secondary)',
            hoverBorder: 'var(--border-default)'
        }
    };

    return (
        <div className="hero-surface h-full p-6">
            <h3
                className="font-semibold mb-1"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
            >
                Quick Actions
            </h3>
            <p
                className="text-xs mb-5"
                style={{ color: 'var(--text-muted)' }}
            >
                Jump to common tasks
            </p>

            <div className="grid grid-cols-2 gap-3">
                {actions.map((action) => {
                    const style = accentStyles[action.accent];
                    const Icon = action.icon;

                    return (
                        <Link
                            key={action.href}
                            href={action.href}
                            className="group flex flex-col items-center justify-center gap-2 py-5 px-3 rounded-[var(--radius-lg)] border transition-all"
                            style={{
                                background: 'rgba(255, 255, 255, 0.7)',
                                borderColor: 'var(--border-soft)',
                                backdropFilter: 'blur(8px)'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = style.hoverBorder;
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = 'var(--shadow-card)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = 'var(--border-soft)';
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = 'none';
                            }}
                        >
                            <div
                                className="w-11 h-11 rounded-[var(--radius-md)] flex items-center justify-center transition-transform group-hover:scale-105"
                                style={{ background: style.iconBg, color: style.iconColor }}
                            >
                                <Icon size={20} strokeWidth={1.75} />
                            </div>
                            <div className="text-center">
                                <span
                                    className="text-sm font-semibold block"
                                    style={{ color: 'var(--text-primary)' }}
                                >
                                    {action.label}
                                </span>
                                <span
                                    className="text-[10px] block mt-0.5"
                                    style={{ color: 'var(--text-muted)' }}
                                >
                                    {action.description}
                                </span>
                            </div>
                        </Link>
                    );
                })}
            </div>

            <p
                className="mt-5 text-center text-[11px] italic"
                style={{ color: 'var(--text-muted)' }}
            >
                "Best results come from 10–20 personalised emails per day."
            </p>
        </div>
    );
}
