export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

/**
 * GET /api/leads/[id]
 * 
 * Fetch a single lead with all related data for the conversation modal
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const leadId = parseInt(id);

        if (isNaN(leadId)) {
            return NextResponse.json({ error: 'Invalid lead ID' }, { status: 400 });
        }

        console.log(`[Leads GET] Fetching lead ${leadId}`);

        const lead = await prisma.lead.findUnique({
            where: { id: leadId },
            include: {
                companyProspect: {
                    select: {
                        id: true,
                        companyName: true,
                        websiteUrl: true,
                        websiteDomain: true,
                        manualContacts: true,
                        enrichmentData: true
                    }
                }
            }
        });

        if (!lead) {
            return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
        }

        // Parse contacts from prospect
        let contacts: any[] = [];
        const prospect = lead.companyProspect;

        if (prospect) {
            // Parse manual contacts
            try {
                if (prospect.manualContacts) {
                    const data = typeof prospect.manualContacts === 'string'
                        ? JSON.parse(prospect.manualContacts)
                        : prospect.manualContacts;
                    if (Array.isArray(data)) {
                        contacts.push(...data.map(c => ({
                            ...c,
                            source: 'manual'
                        })));
                    }
                }
            } catch (e) { }

            // Parse scanned contacts
            try {
                if (prospect.enrichmentData) {
                    const data = typeof prospect.enrichmentData === 'string'
                        ? JSON.parse(prospect.enrichmentData)
                        : prospect.enrichmentData;

                    const scanned = [
                        ...(data.bestContacts || []),
                        ...(data.moreContacts || []),
                        ...(data.contacts || [])
                    ];

                    for (const c of scanned) {
                        if (c.email && !contacts.some(x => x.email?.toLowerCase() === c.email?.toLowerCase())) {
                            contacts.push(c);
                        }
                    }
                }
            } catch (e) { }
        }

        // Build response
        const response = {
            id: lead.id,
            companyName: lead.companyName,
            companyProspectId: lead.companyProspectId,
            websiteUrl: lead.websiteUrl || prospect?.websiteUrl,
            emailDraft: lead.emailDraft,
            emailDraftHtml: lead.emailDraftHtml,
            subjectLine1: lead.subjectLine1,
            status: lead.status,
            createdAt: lead.createdAt,
            contacts: contacts.slice(0, 10), // Limit for modal
            prospect: prospect ? {
                id: prospect.id,
                companyName: prospect.companyName,
                websiteUrl: prospect.websiteUrl,
                websiteDomain: prospect.websiteDomain
            } : null
        };

        console.log(`[Leads GET] Returning lead ${leadId} with ${contacts.length} contacts`);

        return NextResponse.json(response);

    } catch (error: any) {
        console.error('[Leads GET] Error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to fetch lead'
        }, { status: 500 });
    }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const leadId = parseInt(id);
        const body = await request.json();

        // Allow updating emailDraft, status, etc.
        const updatedLead = await prisma.lead.update({
            where: { id: leadId },
            data: body
        });

        return NextResponse.json(updatedLead);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }
}

// DELETE: Soft-remove a lead (archive, not hard delete)
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const leadId = parseInt(id);

        if (isNaN(leadId)) {
            return NextResponse.json({ error: 'Invalid lead ID' }, { status: 400 });
        }

        // Verify the lead exists
        const lead = await prisma.lead.findUnique({
            where: { id: leadId }
        });

        if (!lead) {
            return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
        }

        // Soft-delete by setting archivedAt
        const archivedLead = await prisma.lead.update({
            where: { id: leadId },
            data: { archivedAt: new Date() }
        });

        return NextResponse.json({
            success: true,
            lead: archivedLead,
            undoUntil: Date.now() + 10000 // 10 seconds for undo
        });
    } catch (e: any) {
        console.error('Delete lead error:', e);
        return NextResponse.json({
            error: 'Failed to remove lead',
            details: e.message
        }, { status: 500 });
    }
}
