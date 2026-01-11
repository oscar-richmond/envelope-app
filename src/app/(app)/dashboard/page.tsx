'use client';

import { useEffect, useState } from 'react';
import DashboardKPIs from '@/components/dashboard/DashboardKPIs';
import NeedsAttention from '@/components/dashboard/NeedsAttention';
import QuickActions from '@/components/dashboard/QuickActions';
import RecentActivity from '@/components/dashboard/RecentActivity';
import { PageHeader } from '@/components/ui/PageHeader';
import { DateRangeSelect } from '@/components/ui/DateRangeSelect';

export default function DashboardPage() {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<any>(null);
    const [activity, setActivity] = useState<{ outbound: any[], replies: any[] }>({ outbound: [], replies: [] });
    const [dateRange, setDateRange] = useState('14');

    useEffect(() => {
        async function loadData() {
            setLoading(true);
            try {
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
            <div
                className="p-8 max-w-[1600px] mx-auto text-center py-20"
                style={{
                    background: 'var(--bg-card)',
                    borderRadius: 'var(--radius-card)',
                    margin: '2rem auto'
                }}
            >
                <h2
                    className="text-lg font-semibold mb-2"
                    style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
                >
                    Unable to load dashboard
                </h2>
                <p style={{ color: 'var(--text-secondary)' }} className="mb-4">
                    We couldn't fetch your latest stats.
                </p>
                <button
                    onClick={() => window.location.reload()}
                    className="btn btn-primary"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 w-full max-w-[1600px] mx-auto">
            <PageHeader
                title="Dashboard"
                subtitle="Overview of outreach, replies, and next actions"
                actions={
                    <DateRangeSelect
                        value={dateRange}
                        onChange={setDateRange}
                    />
                }
            />

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

