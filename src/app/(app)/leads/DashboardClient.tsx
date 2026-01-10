'use client';

import { useState } from 'react';
import Link from 'next/link';
import { StatsCard, StatsGrid } from '@/components/ui/StatsCard';
import { Building2, CheckCircle, AlertCircle, PenTool, Search } from 'lucide-react';
import { ResultsListContainer, ResultsListHeader, ResultsListEmptyState } from '@/components/ui/ResultsList';
import LeadResultRowCard from '@/components/leads/LeadResultRowCard';
import AddLeadModal from '@/components/AddLeadModal';

export default function DashboardClient({ leads }: { leads: any[] }) {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [sort, setSort] = useState('date');
    const [filter, setFilter] = useState('');

    const filteredLeads = leads
        .filter(l => l.companyName.toLowerCase().includes(filter.toLowerCase()))
        .sort((a, b) => {
            // Basic Client Sort
            if (sort === 'date') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            if (sort === 'priority') return (b.priorityScore || 0) - (a.priorityScore || 0);
            if (sort === 'health') return (b.stalenessScore || 0) - (a.stalenessScore || 0);
            return 0;
        });

    const handleDelete = async (id: number) => {
        if (!confirm('Delete this lead?')) return;
        await fetch(`/api/leads/${id}`, { method: 'DELETE' });
        // Ideally router.refresh() or local mutation
        window.location.reload();
    };

    return (
        <div className="p-8 max-w-[1600px] mx-auto">
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Lead Board</h1>
                    <p className="text-gray-500 mt-1">Manage and analyze your prospecting pipeline.</p>
                </div>
                <div className="flex gap-3">
                    <div className="relative">
                        <input
                            className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-64 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                            placeholder="Filter companies..."
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-gray-900 text-white hover:bg-black px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-all"
                    >
                        Add Lead
                    </button>
                </div>
            </header>

            {/* Overview Stats (Home) */}
            <div className="mb-8">
                <StatsGrid>
                    <StatsCard
                        label="Total Leads"
                        value={leads.length}
                        color="indigo"
                        icon={<Building2 size={20} />}
                    />
                    <StatsCard
                        label="Analyzed"
                        value={leads.filter(l => l.lastAnalyzedAt).length}
                        color="green"
                        icon={<CheckCircle size={20} />}
                    />
                    <StatsCard
                        label="High Priority"
                        value={leads.filter(l => l.stalenessScore > 70).length}
                        color="rose"
                        icon={<AlertCircle size={20} />}
                    />
                    <StatsCard
                        label="Drafted"
                        value={leads.filter(l => l.emailStatus === 'DRAFTED').length}
                        color="amber"
                        icon={<PenTool size={20} />}
                    />
                </StatsGrid>
            </div>

            <ResultsListContainer>
                <ResultsListHeader
                    columns={[
                        { label: 'Company & Status', sortable: true, sortKey: 'name' },
                        { label: 'Signals (Score)', sortable: true, sortKey: 'priority' },
                        { label: 'Actions (Control)' }
                    ]}
                    currentSort={sort}
                    onSort={setSort}
                    totalCount={filteredLeads.length}
                />

                {filteredLeads.length > 0 ? (
                    filteredLeads.map((lead, i) => (
                        <LeadResultRowCard
                            key={lead.id}
                            index={i}
                            lead={lead}
                            onCompose={() => { }} // Future
                            onDelete={() => handleDelete(lead.id)}
                        />
                    ))
                ) : (
                    <ResultsListEmptyState
                        title="No leads found"
                        description="Try adjusting your filters or add a new lead manually."
                        action={
                            <button onClick={() => setIsModalOpen(true)} className="text-indigo-600 font-medium text-sm hover:underline">
                                Add Manual Lead
                            </button>
                        }
                    />
                )}
            </ResultsListContainer>

            <AddLeadModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </div>
    );
}
