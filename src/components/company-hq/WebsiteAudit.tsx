'use client';

import { hqStyles } from './SharedStyles';
import { CheckCircle, AlertTriangle, Monitor, Shield, Zap } from 'lucide-react';

interface WebsiteAuditProps {
    signals: string[]; // For simplicity, we assume generic string signals for now
    websiteUrl: string;
    onViewEvidence?: () => void;
}

export default function WebsiteAudit({ signals, websiteUrl, onViewEvidence }: WebsiteAuditProps) {
    // Mock categorization for now since signals are raw strings/JSON
    // In a real app, signals would be objects with 'category'
    const designSignals = signals.filter(s => s.toLowerCase().includes('design') || s.toLowerCase().includes('mobile') || s.toLowerCase().includes('viewport'));
    const trustSignals = signals.filter(s => s.toLowerCase().includes('trust') || s.toLowerCase().includes('ssl') || s.toLowerCase().includes('social'));
    const techSignals = signals.filter(s => s.toLowerCase().includes('tech') || s.toLowerCase().includes('generator') || s.toLowerCase().includes('sitemap'));

    return (
        <div className={hqStyles.card}>
            <div className={hqStyles.cardHeader}>
                <div className="flex items-center gap-2">
                    <Monitor size={18} className="text-gray-400" />
                    <h3 className={hqStyles.cardTitle}>Website Review</h3>
                </div>
                {onViewEvidence && (
                    <button
                        onClick={onViewEvidence}
                        className="text-xs text-indigo-600 font-medium hover:underline"
                    >
                        View Evidence
                    </button>
                )}
            </div>
            <div className={hqStyles.cardBody}>
                <div className="space-y-6">
                    {/* Design / UX */}
                    <div>
                        <h4 className="text-xs font-semibold text-gray-900 mb-2 flex items-center gap-1.5">
                            <Monitor size={14} className="text-indigo-500" /> Design & UX
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {designSignals.length > 0 ? designSignals.map((s, i) => (
                                <span key={i} className="px-2 py-1 bg-gray-50 text-gray-700 text-xs rounded border border-gray-100">{s}</span>
                            )) : <span className="text-xs text-gray-400 italic">No specific signals detected.</span>}
                        </div>
                    </div>

                    {/* Trust */}
                    <div>
                        <h4 className="text-xs font-semibold text-gray-900 mb-2 flex items-center gap-1.5">
                            <Shield size={14} className="text-green-500" /> Trust Signals
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {trustSignals.length > 0 ? trustSignals.map((s, i) => (
                                <span key={i} className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded border border-green-100">{s}</span>
                            )) : <span className="text-xs text-gray-400 italic">No trust signals found.</span>}
                        </div>
                    </div>

                    {/* Tech */}
                    <div>
                        <h4 className="text-xs font-semibold text-gray-900 mb-2 flex items-center gap-1.5">
                            <Zap size={14} className="text-amber-500" /> Technical
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {techSignals.length > 0 ? techSignals.map((s, i) => (
                                <span key={i} className="px-2 py-1 bg-amber-50 text-amber-700 text-xs rounded border border-amber-100">{s}</span>
                            )) : <span className="text-xs text-gray-400 italic">Basic technical check passed.</span>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
