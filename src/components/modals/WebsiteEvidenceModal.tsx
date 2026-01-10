'use client';

import { X, RefreshCw } from 'lucide-react';

interface WebsiteEvidenceModalProps {
    isOpen: boolean;
    onClose: () => void;
    evidence: string[]; // Preloaded strings
    url?: string;
}

export default function WebsiteEvidenceModal({ isOpen, onClose, evidence, url }: WebsiteEvidenceModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Website Evidence</h3>
                        {url && <p className="text-xs text-gray-500 truncate max-w-sm">{url}</p>}
                    </div>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto">
                    <div className="space-y-6">
                        <div>
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                Content & Activity Signals
                            </h4>
                            <ul className="space-y-2">
                                {evidence.filter(r => r.match(/blog|sitemap|copyright|content update/i)).map((r: string, i: number) => (
                                    <li key={i} className="text-sm text-gray-700 bg-gray-50 p-2 rounded border border-gray-100">{r}</li>
                                ))}
                                {evidence.filter(r => r.match(/blog|sitemap|copyright|content update/i)).length === 0 && (
                                    <li className="text-sm text-gray-400 italic pl-2">No strong content signals recorded.</li>
                                )}
                            </ul>
                        </div>

                        <div className="border-t border-gray-100 pt-6">
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                Design & Technical Opportunities
                            </h4>
                            <ul className="space-y-2">
                                {evidence.filter(r => !r.match(/blog|sitemap|copyright|Assumed Fresh|content update/i)).map((r: string, i: number) => (
                                    <li key={i} className="text-sm text-gray-700 bg-gray-50 p-2 rounded border border-gray-100">{r}</li>
                                ))}
                                {evidence.filter(r => !r.match(/blog|sitemap|copyright|Assumed Fresh|content update/i)).length === 0 && (
                                    <li className="text-sm text-gray-400 italic pl-2">No specific design issues detected.</li>
                                )}
                            </ul>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-between items-center text-xs text-gray-400">
                    <span>Analysis based on public signals</span>
                    {/* Placeholder for refresh */}
                    <button className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-700 font-medium">
                        <RefreshCw size={12} /> Refresh
                    </button>
                </div>
            </div>
        </div>
    );
}
