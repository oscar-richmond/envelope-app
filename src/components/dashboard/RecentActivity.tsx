'use client';

import Link from 'next/link';
import { ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';

interface RecentActivityProps {
    outbound: any[];
    replies: any[];
    loading: boolean;
}

export default function RecentActivity({ outbound, replies, loading }: RecentActivityProps) {
    if (loading) return <div className="h-40 animate-pulse bg-gray-100 rounded-xl mt-6" />;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
            {/* Recent Outbound */}
            <div className="card">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <ArrowUpRight size={16} className="text-gray-400" />
                        <h3 className="font-semibold text-gray-900 text-sm">Recent Outbound</h3>
                    </div>
                </div>
                <div className="divide-y divide-gray-50">
                    {outbound.length === 0 ? (
                        <p className="p-4 text-sm text-gray-400 text-center">No recent emails sent.</p>
                    ) : (
                        outbound.map((item) => (
                            <div key={item.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                <div>
                                    <p className="text-sm font-medium text-gray-900">{item.lead.companyName}</p>
                                    <p className="text-xs text-gray-500">{new Date(item.sentAt).toLocaleDateString()}</p>
                                </div>
                                <StatusBadge status={item.status} />
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Recent Replies */}
            <div className="card">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <ArrowDownLeft size={16} className="text-indigo-500" />
                        <h3 className="font-semibold text-gray-900 text-sm">Recent Replies</h3>
                    </div>
                </div>
                <div className="divide-y divide-gray-50">
                    {replies.length === 0 ? (
                        <p className="p-4 text-sm text-gray-400 text-center">No replies yet.</p>
                    ) : (
                        replies.map((item) => (
                            <div key={item.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                <div>
                                    <p className="text-sm font-medium text-gray-900">{item.lead.companyName}</p>
                                    <p className="text-xs text-gray-500">{item.subject}</p>
                                </div>
                                <Link
                                    href={`/outreach/sent?thread=${item.id}`} // Assuming logic will handle this param later
                                    className="btn btn-ghost text-xs px-2 h-7"
                                >
                                    View
                                </Link>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
