import prisma from '@/lib/prisma';
import DashboardClient from './DashboardClient';

// Revalidate every 0 seconds (dynamic) or use dynamic = 'force-dynamic'
export const dynamic = 'force-dynamic';

// Helper: Get analysis status based on last scanned date
function getAnalysisStatus(lastScanned: Date | null): 'missing' | 'stale' | 'fresh' | 'pending' {
  if (!lastScanned) return 'missing';
  const daysSince = (Date.now() - new Date(lastScanned).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince > 30) return 'stale';
  if (daysSince > 7) return 'pending';
  return 'fresh';
}

// Helper: Calculate priority score
function calculatePriorityScore(lead: any, prospect: any): number {
  let score = 0;
  const finScore = prospect?.financialActivityScore ?? 0;
  score += Math.floor(finScore * 0.4);
  const stale = lead.stalenessScore ?? prospect?.stalenessScore ?? 50;
  score += Math.floor((100 - stale) * 0.3);
  const hasContacts = prospect?.contactPriorityScore ?? 0;
  score += Math.floor(hasContacts * 0.2);
  return Math.min(100, Math.max(0, score));
}

export default async function Dashboard() {
  const leads = await prisma.lead.findMany({
    where: { archivedAt: null },
    orderBy: { createdAt: 'desc' },
    include: {
      companyProspect: true,
      sentEmails: {
        orderBy: { sentAt: 'desc' },
        take: 1
      }
    }
  });

  // Enrich leads with computed fields (same logic as /api/leads)
  const enrichedLeads = leads.map(lead => {
    const prospect = lead.companyProspect;

    // Parse persisted webHealthData JSON if available
    let webHealthPersisted: { score: number | null; label: string | null; lastScannedAt: string | null } | null = null;
    if (prospect?.webHealthData) {
      try {
        const parsed = JSON.parse(prospect.webHealthData);
        webHealthPersisted = {
          score: parsed.score ?? null,
          label: parsed.label ?? null,
          lastScannedAt: parsed.lastScannedAt ?? null
        };
      } catch (e) { /* ignore */ }
    }

    // Parse persisted finHealthData JSON if available
    let finHealthPersisted: { score: number | null; band: string | null; lastSyncedAt: string | null } | null = null;
    if (prospect?.finHealthData) {
      try {
        const parsed = JSON.parse(prospect.finHealthData);
        finHealthPersisted = {
          score: parsed.score ?? null,
          band: parsed.band ?? null,
          lastSyncedAt: parsed.lastSyncedAt ?? null
        };
      } catch (e) { /* ignore */ }
    }

    // Compute scores with fallbacks
    const financialScore = finHealthPersisted?.score ?? prospect?.financialActivityScore ?? null;
    const financialBand = finHealthPersisted?.band ?? (financialScore !== null
      ? (financialScore > 75 ? 'Strong' : financialScore > 50 ? 'Medium' : 'Low')
      : null);

    // Compute scores using canonical fields first
    const canonicalWebHealthScore = prospect?.websiteHealthScore ?? null;
    const canonicalWebHealthLabel = prospect?.websiteHealthLabel ?? null;

    const stalenessScore = canonicalWebHealthScore ?? webHealthPersisted?.score ?? lead.stalenessScore ?? prospect?.stalenessScore ?? null;
    const stalenessLabel = canonicalWebHealthLabel ?? webHealthPersisted?.label ?? (stalenessScore !== null
      ? (stalenessScore >= 60 ? 'Outdated' : stalenessScore >= 30 ? 'Aging' : 'Fresh')
      : null);

    const priorityScore = (financialScore !== null || stalenessScore !== null)
      ? calculatePriorityScore(lead, prospect)
      : null;
    const priorityBand = priorityScore !== null
      ? (priorityScore > 70 ? 'High' : priorityScore > 40 ? 'Medium' : 'Low')
      : null;

    const websiteLastScanned = webHealthPersisted?.lastScannedAt
      ? new Date(webHealthPersisted.lastScannedAt)
      : lead.lastAnalyzedAt || prospect?.lastAnalysedAt || null;
    const financialLastScanned = finHealthPersisted?.lastSyncedAt
      ? new Date(finHealthPersisted.lastSyncedAt)
      : prospect?.financialLastCheckedAt || null;

    // Signals contract
    const signals = {
      leadOpp: { score: priorityScore, label: priorityBand, updatedAt: websiteLastScanned },
      webHealth: { score: stalenessScore, label: stalenessLabel, updatedAt: websiteLastScanned },
      finHealth: { score: financialScore, label: financialBand, updatedAt: financialLastScanned }
    };

    return {
      ...lead,
      signals,
      financialScore,
      stalenessScore,
      priorityScore,
      financialBand,
      stalenessLabel,
      priorityBand,
      websiteLastScanned,
      financialLastScanned,
      websiteScanStatus: getAnalysisStatus(websiteLastScanned),
      financialScanStatus: getAnalysisStatus(financialLastScanned),
      websiteUrl: lead.websiteUrl || prospect?.websiteUrl,
      domain: prospect?.websiteDomain,
      industry: lead.industry || prospect?.industry || null,
      location: lead.location || prospect?.registeredLocation || null,
    };
  });

  return <DashboardClient leads={enrichedLeads} />;
}
