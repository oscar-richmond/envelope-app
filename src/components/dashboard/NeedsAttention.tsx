'use client';

import Link from 'next/link';
import { ChevronRight, AlertCircle, Clock, PenTool } from 'lucide-react';

interface NeedsAttentionProps {
    stats: any;
    activity: any;
    loading: boolean;
}

export default function NeedsAttention({ stats, activity, loading }: NeedsAttentionProps) {
    if (loading) return <div className="h-64 animate-pulse bg-gray-100 rounded-xl" />;

    // Construct priority list from raw stats/activity
    // In a real app, this would come from a tailored API, but we'll synthesize it for UI consistency
    const items = [];

    // 1. Action Needed
    if (stats?.actionNeeded > 0) {
        items.push({
            id: 'action',
            title: `${stats.actionNeeded} Replies Need Action`,
            status: 'Action Needed',
            statusColor: 'bg-amber-100 text-amber-700',
            icon: <AlertCircle size={16} className="text-amber-600" />,
            link: '/outreach/sent?filter=ACTION_NEEDED',
            cta: 'View Inbox'
        });
    }

    // 2. Follow-ups Due
    if (stats?.followUpsDue > 0) {
        items.push({
            id: 'followup',
            title: `${stats.followUpsDue} Follow-ups Due`,
            status: 'Due Now',
            statusColor: 'bg-rose-100 text-rose-700',
            icon: <Clock size={16} className="text-rose-600" />,
            link: '/outreach/follow-ups',
            cta: 'Start Session'
        });
    }

    // 3. Drafts
    if (stats?.draftsWaiting > 0) {
        items.push({
            id: 'drafts',
            title: `${stats.draftsWaiting} Drafts Waiting`,
            status: 'Draft',
            statusColor: 'bg-gray-100 text-gray-600',
            icon: <PenTool size={16} className="text-gray-500" />,
            link: '/leads', // Or wherever filtered drafts live
            cta: 'Review'
        });
    }

    if (items.length === 0) {
        return (
            <div className="card h-full p-6 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mb-3">
                    <AlertCircle size={24} className="text-green-500" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">All clear!</h3>
                <p className="text-sm text-gray-500">No urgent actions requiring your attention.</p>
            </div>
        );
    }

    return (
        <div className="card h-full flex flex-col">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 rounded-t-xl">
                <h3 className="font-semibold text-gray-900">Needs Attention</h3>
                <span className="text-xs font-medium bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">
                    {items.length} Priority
                </span>
            </div>
            <div className="divide-y divide-gray-50">
                {items.map((item) => (
                    <div key={item.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.statusColor.split(' ')[0]}`}>
                                {item.icon}
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-900">{item.title}</p>
                                <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${item.statusColor}`}>
                                    {item.status}
                                </span>
                            </div>
                        </div>
                        <Link href={item.link} className="btn btn-secondary text-xs h-8 px-3">
                            {item.cta}
                        </Link>
                    </div>
                ))}
            </div>
        </div>
    );
}
