import prisma from '@/lib/prisma';
import DashboardClient from './DashboardClient';

// Revalidate every 0 seconds (dynamic) or use dynamic = 'force-dynamic'
export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return <DashboardClient leads={leads} />;
}
