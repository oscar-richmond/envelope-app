/**
 * Mismatch Banner
 * 
 * Shows warning when Web Health canonical and rendered values don't match.
 */

'use client';

import { useDiagnostics } from '@/hooks/useDiagnostics';

interface Props {
    canonical: {
        websiteHealthStatus?: string | null;
        websiteHealthScore?: number | null;
    };
    rendered: {
        score: number | null;
        label: string;
        showScore: boolean;
    };
    onOpenSnapshot: () => void;
}

export function MismatchBanner({ canonical, rendered, onOpenSnapshot }: Props) {
    const diagnostics = useDiagnostics();

    if (!diagnostics) return null;

    // Detect mismatches
    const hasMismatch =
        // null in DB but 0 in UI
        (canonical.websiteHealthScore === null && rendered.score === 0) ||
        // Different scores when both are numbers
        (typeof canonical.websiteHealthScore === 'number' &&
            typeof rendered.score === 'number' &&
            canonical.websiteHealthScore !== rendered.score) ||
        // Status mismatch (success in DB but not shown as score)
        (canonical.websiteHealthStatus === 'success' && !rendered.showScore);

    if (!hasMismatch) return null;

    return (
        <div className="bg-yellow-100 border border-yellow-400 rounded px-2 py-1 text-[10px] flex items-center justify-between mt-1">
            <span className="text-yellow-800 font-medium">⚠️ Web Health mismatch</span>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onOpenSnapshot();
                }}
                className="text-yellow-900 underline hover:text-yellow-950 ml-2"
            >
                Open snapshot
            </button>
        </div>
    );
}
