import DashboardClient from './DashboardClient';

// Revalidate every 0 seconds (dynamic) or use dynamic = 'force-dynamic'
export const dynamic = 'force-dynamic';

// Fetch leads from API to ensure consistent data shape
async function fetchLeads() {
  // Use absolute URL for server-side fetch
  const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

  try {
    const res = await fetch(`${baseUrl}/api/leads`, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!res.ok) {
      console.error('[LeadsPage] Failed to fetch leads:', res.status);
      return [];
    }

    return res.json();
  } catch (error) {
    console.error('[LeadsPage] Error fetching leads:', error);
    return [];
  }
}

export default async function Dashboard() {
  const leads = await fetchLeads();

  return <DashboardClient leads={leads} />;
}
