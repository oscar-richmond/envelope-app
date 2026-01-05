export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    try {
        const id = parseInt(params.id);
        console.log(`[API] Fetching recipients for Lead ID: ${id}`);
        if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

        const lead = await prisma.lead.findUnique({
            where: { id },
            include: {
                contacts: true,
                companyProspect: {
                    include: {
                        discoveredEmails: true
                    }
                }
            }
        });

        console.log(`[API] Found Lead: ${lead?.id}, ProspectID: ${lead?.companyProspectId}`);
        if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

        const recipients: any[] = [];
        const seenEmails = new Set<string>();

        // 1. Contacts (High Priority)
        if (lead.contacts) {
            for (const c of lead.contacts) {
                if (c.email) {
                    recipients.push({
                        email: c.email,
                        name: c.firstName ? `${c.firstName} ${c.lastName || ''}`.trim() : null,
                        role: c.title || c.roleCategory,
                        source: 'CONTACT',
                        confidence: 'HIGH', // Contacts are usually manually vetted or high qual
                        id: `contact-${c.id}`
                    });
                    seenEmails.add(c.email.toLowerCase());
                }
            }
        }

        // 2. Discovered Emails
        if (lead.companyProspect?.discoveredEmails) {
            for (const e of lead.companyProspect.discoveredEmails) {
                if (!seenEmails.has(e.email.toLowerCase())) {
                    recipients.push({
                        email: e.email,
                        name: null,
                        role: e.type, // Sales, Support, General
                        source: 'WEBSITE',
                        confidence: e.confidence,
                        sendabilityStatus: e.sendabilityStatus,
                        sourceUrl: e.sourceUrl,
                        id: `web-${e.id}`
                    });
                    seenEmails.add(e.email.toLowerCase());
                }
            }
        }

        // 3. Sorting
        // Order: Contacts > Personal Web > Sales Web > General Web > Support Web
        const typePriority: Record<string, number> = {
            'CONTACT': 5,
            'PERSONAL': 4,
            'SALES': 3,
            'GENERAL': 2,
            'SUPPORT': 1
        };

        recipients.sort((a, b) => {
            const scoreA = typePriority[a.source === 'CONTACT' ? 'CONTACT' : a.role] || 1;
            const scoreB = typePriority[b.source === 'CONTACT' ? 'CONTACT' : b.role] || 1;
            return scoreB - scoreA;
        });

        return NextResponse.json({ recipients });

    } catch (e: any) {
        console.error("Failed to fetch recipients", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
