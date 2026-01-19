'use client';

import { useState } from 'react';
import { useDiagnostics } from '@/hooks/useDiagnostics';

interface ProofPillProps {
    score: number | null;
    label: string | null;
    origin?: string;
    receipt?: any; // The receipt object from server
}

export default function ProofPill({ score, label, origin, receipt }: ProofPillProps) {
    const diagnostics = useDiagnostics();
    const [expanded, setExpanded] = useState(false);

    if (!diagnostics) return null;

    // Convergence Check: Do rendered values match receipt values?
    let status = 'MATCH';
    let statusColor = 'bg-green-100 text-green-800 border-green-300';

    if (receipt) {
        // Strict equality check (treating null and undefined loosely equal if needed, but we want strict)
        const receiptScore = receipt.persistedReadback.score;
        const receiptLabel = receipt.persistedReadback.label;
        const reportExists = receipt.persistedReadback.reportExists;

        if (!reportExists) {
            status = 'NO_REPORT';
            statusColor = 'bg-red-100 text-red-800 border-red-300';
        } else if (score !== receiptScore) {
            status = 'SCORE_MISMATCH';
            statusColor = 'bg-red-100 text-red-800 border-red-300';
        } else if (label !== receiptLabel) {
            status = 'LABEL_MISMATCH';
            statusColor = 'bg-yellow-100 text-yellow-800 border-yellow-300';
        }
    } else {
        status = 'NO_RECEIPT';
        statusColor = 'bg-gray-100 text-gray-800 border-gray-300';
    }

    // Special Check: Zero Score
    if (score === 0 && status !== 'MATCH') {
        status = 'INVALID_ZERO';
        statusColor = 'bg-red-600 text-white border-red-800 font-bold';
    }

    return (
        <div className="relative inline-block ml-1 z-[2001]" onClick={(e) => e.stopPropagation()}>
            <button
                onClick={() => setExpanded(!expanded)}
                className={`text-[9px] px-1 py-0.5 rounded border ${statusColor} hover:opacity-80 transition-opacity`}
                title="Click for Scan Proof"
            >
                PROOF: {status}
            </button>

            {expanded && (
                <div className="absolute bottom-full left-0 mb-2 w-64 bg-white border border-gray-300 shadow-xl rounded p-2 text-[10px] font-mono z-[2002]">
                    <div className="font-bold border-b pb-1 mb-1 flex justify-between">
                        <span>Scan Receipt Proof</span>
                        <button onClick={() => setExpanded(false)}>x</button>
                    </div>

                    <div className="space-y-1">
                        <div>
                            <span className="text-gray-500">Rendered:</span> {score} ({label})
                        </div>
                        <div>
                            <span className="text-gray-500">Origin:</span> {origin || 'Unknown'}
                        </div>

                        <div className="border-t my-1 pt-1">
                            <span className="text-gray-500 font-bold">Latest Receipt:</span>
                        </div>

                        {receipt ? (
                            <>
                                <div><span className="text-gray-500">Trace:</span> {receipt.traceId?.slice(0, 8)}...</div>
                                <div><span className="text-gray-500">Writer:</span> {receipt.writer}</div>
                                <div><span className="text-gray-500">Computed:</span> {receipt.computed.finalScore}</div>
                                <div><span className="text-gray-500">Persisted:</span> {receipt.persistedReadback.score}</div>
                                <div>
                                    <span className="text-gray-500">Report Exists:</span>
                                    <span className={receipt.persistedReadback.reportExists ? 'text-green-600' : 'text-red-600 font-bold'}>
                                        {receipt.persistedReadback.reportExists ? 'YES' : 'NO'}
                                    </span>
                                </div>
                                <div className="mt-1 text-xs break-all text-gray-400">
                                    {JSON.stringify(receipt.computed.factors)}
                                </div>
                            </>
                        ) : (
                            <div className="text-gray-400 italic">No receipt stored yet.</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
