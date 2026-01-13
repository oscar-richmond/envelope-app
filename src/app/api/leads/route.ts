export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
    try {
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

        // Map leads to include computed fields
        const enrichedLeads = leads.map(lead => {
            const prospect = lead.companyProspect;

            // Financial score from CompanyProspect
            const financialScore = prospect?.financialActivityScore ?? 0;

            // Website score (staleness) from Lead or CompanyProspect
            const stalenessScore = lead.stalenessScore ?? prospect?.stalenessScore ?? 0;

            // Priority score calculation
            const priorityScore = calculatePriorityScore(lead, prospect);

            // Last scanned dates
            const websiteLastScanned = lead.lastAnalyzedAt || prospect?.lastAnalysedAt || null;
            const financialLastScanned = prospect?.financialLastCheckedAt || null;

            return {
                ...lead,
                financialScore,
                stalenessScore,
                priorityScore,
                websiteLastScanned,
                financialLastScanned,
                websiteScanStatus: getAnalysisStatus(websiteLastScanned),
                financialScanStatus: getAnalysisStatus(financialLastScanned),
                // Fallback for website
                websiteUrl: lead.websiteUrl || prospect?.websiteUrl,
                domain: prospect?.websiteDomain,
            };
        });

        return NextResponse.json(enrichedLeads);
    } catch (error) {
        console.error('[Leads API] Error:', error);
        return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
    }
}

// Calculate priority score from various factors
function calculatePriorityScore(lead: any, prospect: any): number {
    let score = 0;

    // Financial strength (0-40 points)
    const finScore = prospect?.financialActivityScore ?? 0;
    score += Math.floor(finScore * 0.4);

    // Website freshness (0-30 points) - inverse of staleness
    const stale = lead.stalenessScore ?? prospect?.stalenessScore ?? 50;
    score += Math.floor((100 - stale) * 0.3);

    // Contact availability (0-20 points)
    const hasContacts = prospect?.contactPriorityScore ?? 0;
    score += Math.floor(hasContacts * 0.2);

    // Recent activity bonus (0-10 points)
    if (lead.lastActivityAt) {
        const daysSinceActivity = (Date.now() - new Date(lead.lastActivityAt).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceActivity < 7) score += 10;
        else if (daysSinceActivity < 30) score += 5;
    }

    return Math.min(100, Math.max(0, score));
}

// Get analysis status based on last scanned date
function getAnalysisStatus(lastScanned: Date | null): 'missing' | 'stale' | 'fresh' | 'pending' {
    if (!lastScanned) return 'missing';

    const daysSince = (Date.now() - new Date(lastScanned).getTime()) / (1000 * 60 * 60 * 24);

    if (daysSince > 30) return 'stale';
    if (daysSince > 7) return 'pending';
    return 'fresh';
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { companyName, websiteUrl, industry, location } = body;

        // Basic validations
        if (!companyName || !websiteUrl) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const lead = await prisma.lead.create({
            data: {
                companyName,
                websiteUrl,
                industry,
                location,
                companyProspectId: body.companyProspectId, // Link!
                emailStatus: 'NEW'
            },
        });

        return NextResponse.json(lead, { status: 201 });
    } catch (error) {
        // Handle unique constraint on websiteUrl
        if ((error as any).code === 'P2002') {
            return NextResponse.json({ error: 'Lead with this website already exists' }, { status: 409 });
        }
        return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 });
    }
}
