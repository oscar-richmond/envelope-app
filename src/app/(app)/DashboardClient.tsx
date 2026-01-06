'use client';

import { useState } from 'react';
import Link from 'next/link';
import LeadTable from '@/components/LeadTable';
import AddLeadModal from '@/components/AddLeadModal';

export default function DashboardClient({ leads }: { leads: any[] }) {
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <div className="p-8">
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Lead Board</h1>
                    <p className="text-gray-500 mt-1">Manage and analyze your prospecting pipeline.</p>
                </div>
                <div className="flex gap-3">
                    <a href="/api/export" className="bg-white border text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition flex items-center gap-2">
                        Export CSV
                    </a>
                    <Link href="/import" className="bg-white border text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition">
                        Import Leads
                    </Link>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition"
                    >
                        Add Manually
                    </button>
                </div>
            </header>

            {leads.length > 0 ? (
                <LeadTable initialLeads={leads} />
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16 text-center text-gray-500">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No leads yet</h3>
                    <p className="mb-6">Import a list or add a company manually to get started.</p>
                    <div className="flex justify-center gap-4">
                        <Link href="/import" className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700">
                            Import Leads
                        </Link>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
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
