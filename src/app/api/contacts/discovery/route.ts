export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { contactDiscoveryProvider } from '@/lib/providers';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const { leadId } = await request.json();

        const lead = await prisma.lead.findUnique({ where: { id: leadId } });
        if (!lead || !lead.websiteUrl) return NextResponse.json({ error: 'Lead invalid' }, { status: 400 });

        const domain = new URL(lead.websiteUrl).hostname;

        // Call provider
        const results = await contactDiscoveryProvider.find(domain);

        // Save to DB
        // Simple dedupe check? For MVP, just create.
        const savedContacts = await Promise.all(results.map(async (c) => {
            return prisma.contact.create({
                data: {
                    leadId: lead.id,
                    firstName: c.firstName,
                    lastName: c.lastName,
                    title: c.title,
                    email: c.email,
                    confidence: c.confidence,
                    roleCategory: c.roleCategory
                }
            });
        }));

        return NextResponse.json(savedContacts);
    } catch (error) {
        console.error("Contact discovery failed:", error);
        return NextResponse.json({ error: 'Discovery failed' }, { status: 500 });
    }
}
