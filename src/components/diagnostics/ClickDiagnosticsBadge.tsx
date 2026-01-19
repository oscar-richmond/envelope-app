'use client';

import { useDiagnostics } from '@/hooks/useDiagnostics';

interface Props {
    clicks: number;
    lastTarget: string;
    companyId?: number;
}

export default function ClickDiagnosticsBadge({ clicks, lastTarget, companyId }: Props) {
    const enabled = useDiagnostics();

    if (!enabled) return null;

    return (
        <div
            className="absolute top-0 right-0 z-[9999] pointer-events-none flex flex-col items-end gap-0.5 p-1"
            style={{ fontSize: '9px', lineHeight: 1 }}
        >
            <div className={`px-1 py-0.5 rounded shadow-sm font-mono font-bold ${clicks > 0 ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                clicks: {clicks}
            </div>
            {lastTarget && (
                <div className="bg-black/75 text-white px-1 py-0.5 rounded shadow-sm font-mono text-[8px] max-w-[80px] truncate">
                    {lastTarget}
                </div>
            )}
            {!companyId ? (
                <div className="bg-red-600 text-white px-1 py-0.5 rounded shadow-sm font-bold animate-pulse">
                    NO ID
                </div>
            ) : (
                <div className="bg-blue-600 text-white px-1 py-0.5 rounded shadow-sm font-mono text-[8px]">
                    id:{companyId}
                </div>
            )}
        </div>
    );
}
