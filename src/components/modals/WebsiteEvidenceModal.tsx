'use client';

import { X, RefreshCw } from 'lucide-react';

interface WebsiteEvidenceModalProps {
    isOpen: boolean;
    onClose: () => void;
    evidence: string[]; // Preloaded strings
    url?: string;
    lastChecked?: string;
}

export default function WebsiteEvidenceModal({ isOpen, onClose, evidence, url, lastChecked }: WebsiteEvidenceModalProps) {
    if (!isOpen) return null;

    const copyEvidence = () => {
        const text = `Website Evidence for ${url || 'Domain'}\n\n` + evidence.join('\n');
        navigator.clipboard.writeText(text);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Website Evidence</h3>
                        {url && <p className="text-xs text-gray-500 truncate max-w-sm">{url}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={copyEvidence}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-md hover:bg-gray-200 transition"
                            title="Copy Evidence"
                        >
                            <span className="sr-only">Copy</span>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        </button>
                        <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition">
                            <X size={20} />
                        </button>
                    </div>
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
                    <span>{lastChecked ? `Analysis date: ${new Date(lastChecked).toLocaleDateString()}` : 'Analysis pending'}</span>
                    <button className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-700 font-medium">
                        <RefreshCw size={12} /> Refresh
                    </button>
                </div>
            </div>
        </div>
    );
}
