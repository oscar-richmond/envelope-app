import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const prospectId = parseInt(id);

    try {
        // First check if this prospect already has a lead
        const existingLead = await prisma.lead.findFirst({
            where: { companyProspectId: prospectId },
            select: { id: true }
        });

        if (existingLead) {
            // Redirect to lead API response format
            return NextResponse.json({ redirectToLead: existingLead.id });
        }

        // Get the prospect data
        const prospect = await prisma.companyProspect.findUnique({
            where: { id: prospectId }
        });

        if (!prospect) return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });

        // Website Signals (parse JSON if present)
        let websiteSignals: string[] = [];
        if (prospect.signals) {
            try {
                const parsed = JSON.parse(prospect.signals);
                if (Array.isArray(parsed)) websiteSignals = parsed;
            } catch (e) {
                // ignore
            }
        }

        // Financial Signals (parse JSON if present)
        let financialSignals: any = [];
        if (prospect.financialSignals) {
            try {
                const parsed = JSON.parse(prospect.financialSignals);
                if (Array.isArray(parsed) || typeof parsed === 'object') financialSignals = parsed;
            } catch (e) {
                // ignore
            }
        }

        // Return similar structure to lead overview
        return NextResponse.json({
            prospectId: prospect.id,
            companyProspectId: prospect.id, // For report modals
            leadId: null, // Not a lead yet
            companyName: prospect.companyName,
            companyNumber: prospect.companyNumber,
            websiteUrl: prospect.websiteUrl,
            industry: prospect.sicCodes?.[0] || null,
            location: prospect.registeredLocation,
            companyStatus: prospect.status,
            companyProspect: prospect,
            sentEmails: [], // No emails for prospects
            contacts: [], // Will fetch separately if needed
            kpis: {
                opportunityScore: prospect.contactPriorityScore || prospect.stalenessScore || 0,
                opportunityBand: prospect.contactPriorityBand || 'Unknown',
                financialScore: prospect.financialActivityScore,
                financialBand: prospect.financialActivityBand || 'Unknown',
                websiteScore: prospect.stalenessScore,
                websiteMatchConfidence: prospect.websiteConfidence || 'LOW'
            },
            websiteSignals,
            financialSignals,
            outreach: {
                status: 'NOT_STARTED',
                lastContact: null,
                lastSubject: null,
                emailsSent: 0
            },
            isProspect: true // Flag to indicate this is a prospect, not a lead
        });

    } catch (error) {
        console.error('Prospect Overview Error:', error);
        return NextResponse.json({ error: 'Failed to fetch overview' }, { status: 500 });
    }
}
