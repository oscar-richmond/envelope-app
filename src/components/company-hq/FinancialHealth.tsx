'use client';

import { hqStyles } from './SharedStyles';
import { TrendingUp, DollarSign } from 'lucide-react';

interface FinancialHealthProps {
    score: number;
    band: string;
    signals: string[];
    onFullReport?: () => void;
}

export default function FinancialHealth({ score, band, signals, onFullReport }: FinancialHealthProps) {
    return (
        <div className={hqStyles.card}>
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-white rounded-t-xl">
                <div className="flex items-center gap-2">
                    <TrendingUp size={16} className="text-gray-400" />
                    <h3 className="text-sm font-bold text-gray-900">Financial Health</h3>
                </div>
                {onFullReport && (
                    <button
                        onClick={onFullReport}
                        className="text-xs font-medium text-indigo-600 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
                    >
                        View report
                    </button>
                )}
            </div>
            <div className={hqStyles.cardBody}>
                <div className="flex items-center gap-4 mb-6">
                    <div className="flex-1">
                        <div className="text-3xl font-bold text-gray-900">{score}</div>
                        <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Financial Score</div>
                    </div>
                    <div className="text-right">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${band === 'Strong' ? 'bg-green-100 text-green-800' :
                            band === 'Medium' ? 'bg-amber-100 text-amber-800' :
                                'bg-rose-100 text-rose-800'
                            }`}>
                            {band}
                        </span>
                    </div>
                </div>

                <div>
                    <h4 className="text-xs font-semibold text-gray-900 mb-2">Key Indicators</h4>
                    <ul className="space-y-2">
                        {signals.length > 0 ? signals.map((s, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                                <DollarSign size={14} className="mt-0.5 text-gray-400 shrink-0" />
                                <span>{s}</span>
                            </li>
                        )) : (
                            <li className="text-sm text-gray-400 italic">No specific financial indicators available.</li>
                        )}
                    </ul>
                </div>
            </div>
        </div>
    );
}
