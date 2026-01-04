'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ExternalLink, ChevronRight, Trash2 } from 'lucide-react';
import StatusBadge from './StatusBadge';

type Lead = {
    id: number;
    companyName: string;
    websiteUrl: string;
    industry: string | null;
    location: string | null;
    stalenessScore: number;
    emailStatus: string;
    lastAnalyzedAt: string | null;
};

export default function LeadTable({ initialLeads }: { initialLeads: Lead[] }) {
    const [filter, setFilter] = useState('');

    const filteredLeads = initialLeads.filter(lead =>
        lead.companyName.toLowerCase().includes(filter.toLowerCase()) ||
        (lead.industry && lead.industry.toLowerCase().includes(filter.toLowerCase()))
    );

    return (
        <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                <input
                    type="text"
                    placeholder="Filter by company or industry..."
                    className="px-4 py-2 border rounded-md w-64 text-sm"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                />
                <span className="text-sm text-gray-500">{filteredLeads.length} leads</span>
            </div>

            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Industry</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {filteredLeads.map((lead) => (
                        <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="font-medium text-gray-900">{lead.companyName}</div>
                                <div className="text-sm text-gray-500 flex items-center gap-1">
                                    <a href={lead.websiteUrl} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 flex items-center gap-1">
                                        {new URL(lead.websiteUrl).hostname} <ExternalLink size={12} />
                                    </a>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lead.industry || '-'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lead.location || '-'}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className={`text-sm font-bold ${lead.stalenessScore > 50 ? 'text-red-600' : 'text-green-600'}`}>
                                    {lead.stalenessScore}/100
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <StatusBadge status={lead.emailStatus} />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex justify-end gap-2">
                                    <Link href={`/leads/${lead.id}`} className="text-gray-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50 transition">
                                        <ChevronRight size={18} />
                                    </Link>
                                    <button
                                        onClick={async (e) => {
                                            e.preventDefault();
                                            if (!confirm('Delete this lead?')) return;
                                            await fetch(`/api/leads/${lead.id}`, { method: 'DELETE' });
                                            window.location.reload();
                                        }}
                                        className="text-gray-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}

                    {filteredLeads.length === 0 && (
                        <tr>
                            <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                No leads found matching your filter.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
