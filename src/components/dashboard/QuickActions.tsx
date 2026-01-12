'use client';

import Link from 'next/link';
import { Search, RefreshCw, PlusCircle, List, Columns3 } from 'lucide-react';

export default function QuickActions() {
    const actions = [
        { href: '/prospects', icon: Search, label: 'Find Prospects', accent: 'mint' },
        { href: '/outreach/deals', icon: Columns3, label: 'View Pipeline', accent: 'primary' },
        { href: '/outreach', icon: List, label: 'Review Queue', accent: 'lilac' },
        { href: '/import', icon: PlusCircle, label: 'Import Leads', accent: 'default' }
    ];

    const accentStyles: Record<string, { iconBg: string; iconColor: string }> = {
        mint: { iconBg: 'var(--accent-mint-bg)', iconColor: 'var(--accent-mint-text)' },
        lilac: { iconBg: 'var(--accent-lilac-bg)', iconColor: 'var(--accent-lilac-text)' },
        primary: { iconBg: 'rgb(79, 70, 229)', iconColor: 'white' },
        default: { iconBg: 'var(--bg-card-muted)', iconColor: 'var(--text-secondary)' }
    };

    return (
        <div
            className="h-full p-6"
            style={{
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius-card)',
                border: '1px solid var(--border-soft)',
                boxShadow: 'var(--shadow-card)'
            }}
        >
            <h3
                className="font-semibold mb-5"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
            >
                Quick Actions
            </h3>

            <div className="grid grid-cols-2 gap-3">
                {actions.map((action) => {
                    const style = accentStyles[action.accent];
                    const Icon = action.icon;

                    return (
                        <Link
                            key={action.href}
                            href={action.href}
                            className="flex flex-col items-center justify-center gap-2.5 py-4 px-3 rounded-[var(--radius-lg)] border transition-all hover:shadow-[var(--shadow-card)] hover:border-[var(--border-default)]"
                            style={{
                                background: 'var(--bg-card)',
                                borderColor: 'var(--border-soft)'
                            }}
                        >
                            <div
                                className="w-10 h-10 rounded-[var(--radius-md)] flex items-center justify-center"
                                style={{ background: style.iconBg, color: style.iconColor }}
                            >
                                <Icon size={20} />
                            </div>
                            <span
                                className="text-xs font-medium text-center"
                                style={{ color: 'var(--text-primary)' }}
                            >
                                {action.label}
                            </span>
                        </Link>
                    );
                })}
            </div>

            <p
                className="mt-5 text-center text-xs italic"
                style={{ color: 'var(--text-muted)' }}
            >
                "Best results come from sending 10–20 personalised emails per day."
            </p>
        </div>
    );
}
