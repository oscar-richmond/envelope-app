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
    const leadId = parseInt(id);

    try {
        const lead = await prisma.lead.findUnique({
            where: { id: leadId },
            include: {
                companyProspect: true,
                sentEmails: {
                    orderBy: { sentAt: 'desc' },
                    take: 1
                },
                contacts: {
                    orderBy: { confidence: 'desc' }
                }
            }
        });

        if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

        // Synthesize data for frontend
        const outreachStatus = lead.emailStatus;
        const lastSentEmail = lead.sentEmails[0] || null;

        // Website Signals (parse JSON if present)
        let websiteSignals = [];
        if (lead.companyProspect?.signals) {
            try {
                const parsed = JSON.parse(lead.companyProspect.signals);
                if (Array.isArray(parsed) || typeof parsed === 'object') websiteSignals = parsed;
            } catch (e) {
                // ignore
            }
        }

        // Financial Signals (parse JSON if present)
        let financialSignals: any = []; // Change type to any to support object
        if (lead.companyProspect?.financialSignals) {
            try {
                const parsed = JSON.parse(lead.companyProspect.financialSignals);
                if (Array.isArray(parsed) || typeof parsed === 'object') financialSignals = parsed;
            } catch (e) {
                // ignore
            }
        }

        return NextResponse.json({
            leadId: lead.id,
            companyName: lead.companyName,
            websiteUrl: lead.websiteUrl,
            // Industry and location with fallbacks from prospect
            industry: lead.industry || lead.companyProspect?.industry || null,
            location: lead.location || lead.companyProspect?.registeredLocation || null,
            companyProspect: lead.companyProspect,
            sentEmails: lead.sentEmails,
            contacts: lead.contacts,
            kpis: {
                opportunityScore: lead.stalenessScore, // Using staleness as proxy for now
                financialScore: lead.companyProspect?.financialActivityScore || 0,
                financialBand: lead.companyProspect?.financialActivityBand || 'Unknown',
                websiteScore: lead.companyProspect?.stalenessScore || 0, // Fallback
            },
            websiteSignals,
            financialSignals,
            outreach: {
                status: outreachStatus,
                lastContact: lastSentEmail ? lastSentEmail.sentAt : null,
                lastSubject: lastSentEmail ? lastSentEmail.subject : null
            }
        });

    } catch (error) {
        console.error('Company Overview Error:', error);
        return NextResponse.json({ error: 'Failed to fetch overview' }, { status: 500 });
    }
}
