import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET: List all outreach messages
export async function GET() {
    const messages = await prisma.outreachMessage.findMany({
        include: {
            lead: true,
            contact: true
        },
        orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(messages);
}

// POST: Create a new draft for a contact
export async function POST(request: Request) {
    try {
        const { leadId, contactId } = await request.json();

        // Auto-generate content (Mock logic for now, similar to Drafter)
        const contact = await prisma.contact.findUnique({ where: { id: contactId } });
        const lead = await prisma.lead.findUnique({ where: { id: leadId } });

        if (!contact || !lead) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const subject = `Question for ${lead.companyName}`;
        const body = `Hi ${contact.firstName || 'there'},\n\nI noticed ${lead.companyName} is doing great work in ${lead.industry}. I wanted to connect regarding...`;

        const message = await prisma.outreachMessage.create({
            data: {
                leadId,
                contactId,
                subject,
                body,
                status: 'DRAFT'
            }
        });

        return NextResponse.json(message);
    } catch (e) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
