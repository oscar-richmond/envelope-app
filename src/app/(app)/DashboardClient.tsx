'use client';

import { useState } from 'react';
import Link from 'next/link';
import LeadTable from '@/components/LeadTable';
import AddLeadModal from '@/components/AddLeadModal';
import { StatsCard, StatsGrid } from '@/components/ui/StatsCard';
import { Building2, CheckCircle, AlertCircle, PenTool } from 'lucide-react';

export default function DashboardClient({ leads }: { leads: any[] }) {
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <div className="p-8">
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="page-title">Lead Board</h1>
                    <p className="page-description">Manage and analyze your prospecting pipeline.</p>
                </div>
                <div className="flex gap-3">
                    <a href="/api/export" className="btn btn-secondary">
                        Export CSV
                    </a>
                    <Link href="/import" className="btn btn-secondary">
                        Import Leads
                    </Link>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="btn btn-primary"
                    >
                        Add Manually
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

            {leads.length > 0 ? (
                <LeadTable initialLeads={leads} />
            ) : (
                <div className="card p-16 text-center text-gray-500">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No leads yet</h3>
                    <p className="mb-6">Import a list or add a company manually to get started.</p>
                    <div className="flex justify-center gap-4">
                        <Link href="/import" className="btn btn-primary">
                            Import Leads
                        </Link>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="btn btn-secondary"
                        >
                            Add Manual Lead
                        </button>
                    </div>
                </div>
            )}

            <AddLeadModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </div>
    );
}
