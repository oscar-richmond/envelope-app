'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ExternalLink, ChevronRight, Trash2, Search, Building2, Plus } from 'lucide-react';
import StatusBadge from './StatusBadge';
import CompanyNameLink from './ui/CompanyNameLink';
import AddLeadModal from '@/components/modals/AddLeadModal';

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
    const [leads, setLeads] = useState<Lead[]>(initialLeads);
    const [filter, setFilter] = useState('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // Keyboard shortcut 'n'
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() === 'n' &&
                !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
                e.preventDefault();
                setIsAddModalOpen(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const filteredLeads = leads.filter(lead =>
        lead.companyName.toLowerCase().includes(filter.toLowerCase()) ||
        (lead.industry && lead.industry.toLowerCase().includes(filter.toLowerCase()))
    );

    const handleLeadAdded = (newLead: any) => {
        // Optimistically add to top
        // Parse date fields if needed although Table uses simple format?
        // Lead interface has string dates above. Prisma returns objects (or string if JSON'd).
        // Let's assume API returns JSON so dates are strings.
        const formattedLead: Lead = {
            id: newLead.id,
            companyName: newLead.companyName,
            websiteUrl: newLead.websiteUrl,
            industry: newLead.industry,
            location: newLead.location,
            stalenessScore: 0,
            emailStatus: 'NEW',
            lastAnalyzedAt: null
        };
        setLeads([formattedLead, ...leads]);
    };

    return (
        <div className="space-y-4">
            {/* Filter Bar */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Filter by company or industry..."
                            className="input !pl-11 w-64"
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="text-sm font-medium text-gray-500">
                        <span className="text-gray-900 font-bold">{filteredLeads.length}</span> active leads
                    </div>
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="btn btn-primary shadow-sm"
                    >
                        <Plus size={16} /> Add Manual
                    </button>
                </div>
            </div>

            {/* Carded Table */}
            <div className="card table-container">
                <table className="table">
                    <thead>
                        <tr>
                            <th className="w-[30%] pl-6">Company</th>
                            <th className="w-[15%]">Industry</th>
                            <th className="w-[15%]">Location</th>
                            <th className="w-[10%]">Score</th>
                            <th className="w-[15%]">Status</th>
                            <th className="w-[15%] text-right pr-6"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {filteredLeads.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-16 text-center text-gray-400">
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center">
                                            <Search className="text-gray-300" size={24} />
                                        </div>
                                        <span className="text-sm">No leads found matching your filter.</span>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            filteredLeads.map((lead) => (
                                <tr key={lead.id} className="hover:bg-gray-50/80 transition-colors group">
                                    <td className="pl-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 shrink-0">
                                                <Building2 size={18} />
                                            </div>
                                            <div>
                                                <CompanyNameLink leadId={lead.id} companyName={lead.companyName} className="text-sm mb-0.5" />
                                                <a
                                                    href={lead.websiteUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs text-gray-400 hover:text-indigo-600 flex items-center gap-1 transition-colors"
                                                >
                                                    {new URL(lead.websiteUrl).hostname}
                                                    <ExternalLink size={10} />
                                                </a>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-4">
                                        <span className="text-sm text-gray-600">{lead.industry || '-'}</span>
                                    </td>
                                    <td className="py-4">
                                        <span className="text-sm text-gray-600">{lead.location || '-'}</span>
                                    </td>
                                    <td className="py-4">
                                        <div className="flex items-center gap-1.5">
                                            <span className={`text-sm font-bold font-mono ${lead.stalenessScore > 50 ? 'text-rose-600' : 'text-emerald-600'
                                                }`}>
                                                {lead.stalenessScore}
                                            </span>
                                            <span className="text-xs text-gray-400">/100</span>
                                        </div>
                                    </td>
                                    <td className="py-4">
                                        <StatusBadge status={lead.emailStatus} />
                                    </td>
                                    <td className="pr-6 py-4 text-right">
                                        <div className="flex justify-end items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Link
                                                href={`/leads/${lead.id}`}
                                                className="btn btn-ghost px-2 py-2 text-gray-400 hover:text-indigo-600"
                                            >
                                                <ChevronRight size={18} />
                                            </Link>
                                            <button
                                                onClick={async (e) => {
                                                    e.preventDefault();
                                                    if (!confirm('Delete this lead?')) return;
                                                    await fetch(`/api/leads/${lead.id}`, { method: 'DELETE' });
                                                    // Remove from state instead of reload
                                                    setLeads(current => current.filter(l => l.id !== lead.id));
                                                }}
                                                className="btn btn-ghost px-2 py-2 text-gray-400 hover:text-rose-600"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <AddLeadModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSuccess={handleLeadAdded}
            />
        </div>
    );
}
