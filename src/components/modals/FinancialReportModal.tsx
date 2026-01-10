'use client';

import { X, RefreshCw, Building2, TrendingUp, AlertTriangle } from 'lucide-react';

interface FinancialReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    score: number;
    band: string;
    evidence: any; // Can be array of strings or object with 'breakdown'
    companyName?: string;
}

export default function FinancialReportModal({ isOpen, onClose, score, band, evidence, companyName }: FinancialReportModalProps) {
    if (!isOpen) return null;

    // Normalize evidence
    // In Prospects it handles { breakdown: [], details: [] } OR legacy string[]
    // API might return string[] from Overview if not fully parsed?
    // My previous fix ensured it is an Array if parsed from JSON string.
    // If it's an object (breakdown), we need to handle that.

    // Overview API returns `financialSignals`. 
    // If it was Array found in DB JSON, it's array.
    // If it was complex object, Overview API might have simplified it? 
    // Overview API code: `if (Array.isArray(parsed)) financialSignals = parsed;`
    // This means if it was an OBJECT with breakdown, it might have been ignored and set to empty array?
    // Wait, my previous fix:
    // `const parsed = JSON.parse(lead.companyProspect.financialSignals);`
    // `if (Array.isArray(parsed)) financialSignals = parsed;`
    // If `parsed` is `{ breakdown: [...] }`, `Array.isArray` is false.
    // So my "fix" might have inadvertently HIDDEN rich data if it wasn't an array!
    // I should check if I need to support Objects too (Prospect logic supports both).
    // I will update the modal to handle both, assuming I fix the API later or now.

    const isRichData = !Array.isArray(evidence) && evidence?.breakdown;
    const listData = Array.isArray(evidence) ? evidence : (evidence?.details || []);

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Financial Report</h3>
                        {companyName && <p className="text-xs text-gray-500">{companyName}</p>}
                    </div>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6">
                    <div className="flex items-center justify-between mb-8 bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <div>
                            <div className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">Health Score</div>
                            <div className={`text-3xl font-black ${band === 'Very Strong' || band === 'Strong' ? 'text-emerald-600' :
                                    band === 'Medium' ? 'text-amber-600' : 'text-rose-600'
                                }`}>
                                {score} <span className="text-sm text-gray-400 font-medium">/ 100</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${band === 'Very Strong' || band === 'Strong' ? 'bg-emerald-100 text-emerald-800' :
                                    band === 'Medium' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                                }`}>
                                {band}
                            </span>
                        </div>
                    </div>

                    <div className="space-y-4 overflow-y-auto max-h-[40vh] pr-2">
                        <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2 mb-4">
                            Analysis Breakdown
                        </h4>

                        {isRichData ? (
                            evidence.breakdown.map((item: any, idx: number) => (
                                <div key={idx} className="flex items-start gap-3">
                                    <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${item.points > 10 ? 'bg-emerald-500' : item.points > 0 ? 'bg-amber-500' : 'bg-gray-300'}`} />
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm font-medium text-gray-900">{item.label}</span>
                                            <span className="text-xs font-mono font-bold text-gray-500">+{item.points}</span>
                                        </div>
                                        <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{item.text}</p>
                                    </div>
                                </div>
                            ))
                        ) : listData.length > 0 ? (
                            listData.map((d: string, idx: number) => (
                                <div key={idx} className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded transition-colors">
                                    <TrendingUp size={14} className="mt-1 text-gray-400 shrink-0" />
                                    <span className="text-sm text-gray-600">{d}</span>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-8 text-gray-400 italic flex flex-col items-center gap-2">
                                <AlertTriangle size={24} className="opacity-20" />
                                No detailed breakdown available.
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-between items-center text-xs text-gray-400">
                    <span>Last verified check</span>
                    <button className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-700 font-medium">
                        <RefreshCw size={12} /> Sync Financials
                    </button>
                </div>
            </div>
        </div>
    );
}
