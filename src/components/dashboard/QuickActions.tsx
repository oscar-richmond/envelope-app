'use client';

import Link from 'next/link';
import { Search, RefreshCw, PlusCircle, UserPlus, List } from 'lucide-react';

export default function QuickActions() {
    return (
        <div className="card h-full p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
                <Link href="/prospects" className="btn btn-secondary h-auto py-3 flex-col gap-2 items-center justify-center text-center">
                    <Search size={20} className="text-indigo-600" />
                    <span className="text-xs font-medium">Find Prospects</span>
                </Link>
                <Link href="/outreach" className="btn btn-secondary h-auto py-3 flex-col gap-2 items-center justify-center text-center">
                    <List size={20} className="text-blue-600" />
                    <span className="text-xs font-medium">Review Queue</span>
                </Link>
                <Link href="/import" className="btn btn-secondary h-auto py-3 flex-col gap-2 items-center justify-center text-center">
                    <PlusCircle size={20} className="text-gray-600" />
                    <span className="text-xs font-medium">Import Leads</span>
                </Link>
                {/* Visual Placeholder for sync trigger (would normally be a button logic) */}
                <Link href="/outreach/sent" className="btn btn-secondary h-auto py-3 flex-col gap-2 items-center justify-center text-center">
                    <RefreshCw size={20} className="text-green-600" />
                    <span className="text-xs font-medium">Sync Replies</span>
                </Link>
            </div>
            <p className="mt-4 text-xs text-center text-gray-400 italic">
                “Best results come from sending 10–20 personalised emails per day.”
            </p>
        </div>
    );
}
