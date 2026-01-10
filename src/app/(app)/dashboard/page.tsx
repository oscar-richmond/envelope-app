'use client';

import { useEffect, useState } from 'react';
import DashboardKPIs from '@/components/dashboard/DashboardKPIs';
import NeedsAttention from '@/components/dashboard/NeedsAttention';
import QuickActions from '@/components/dashboard/QuickActions';
import RecentActivity from '@/components/dashboard/RecentActivity';
import { Calendar } from 'lucide-react';

export default function DashboardPage() {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<any>(null);
    const [activity, setActivity] = useState<{ outbound: any[], replies: any[] }>({ outbound: [], replies: [] });

    useEffect(() => {
        async function loadData() {
            setLoading(true);
            try {
                // Parallel fetch
                const [statsRes, activityRes] = await Promise.all([
                    fetch('/api/dashboard/stats'),
                    fetch('/api/dashboard/activity')
                ]);

                if (statsRes.ok) {
                    setStats(await statsRes.json());
                } else {
                    console.error('Stats API failed', statsRes.status);
                }

                if (activityRes.ok) {
                    setActivity(await activityRes.json());
                }

            } catch (e) {
                console.error('Dashboard load failed:', e);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, []);

    if (!loading && !stats) {
        return (
            <div className="p-8 max-w-7xl mx-auto text-center py-20">
                <h2 className="text-lg font-semibold text-gray-900">Unable to load dashboard</h2>
                <p className="text-gray-500 mb-4">We couldn't fetch your latest stats.</p>
                <button onClick={() => window.location.reload()} className="btn btn-primary">Retry</button>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header */}
            <header className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                    <p className="text-gray-500 text-sm mt-1">Overview of outreach, replies, and next actions</p>
                </div>
                <button className="btn btn-secondary text-xs">
                    <Calendar size={14} />
                    Last 14 Days
                </button>
            </header>

            {/* Row 1: KPIs */}
            <DashboardKPIs stats={stats} loading={loading} />

            {/* Row 2: Action Queue & Utilities */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <NeedsAttention stats={stats} activity={activity} loading={loading} />
                </div>
                <div>
                    <QuickActions />
                </div>
            </div>

            {/* Row 3: Recent Activity */}
            <RecentActivity
                outbound={activity.outbound}
                replies={activity.replies}
                loading={loading}
            />
        </div>
    );
}
