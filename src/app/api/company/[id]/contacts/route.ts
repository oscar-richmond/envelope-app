import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const leadId = parseInt(id);

    try {
        // In a real implementation, this would call an external enrichment service (Clearbit, Apollo, etc.)
        // For now, we simulate discovery by "finding" contacts if none exist, or returning existing ones.

        const lead = await prisma.lead.findUnique({
            where: { id: leadId },
            include: { contacts: true }
        });

        if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

        // Simulator: If no contacts, create some mock ones to demonstrate the "Find" flow
        if (lead.contacts.length === 0) {
            // Mock Data
            const newContacts = [
                {
                    firstName: 'Sarah',
                    lastName: 'Jenkins',
                    title: 'Marketing Director',
                    email: `sarah@${new URL(lead.websiteUrl).hostname.replace('www.', '')}`,
                    confidence: 85,
                    roleCategory: 'DECISION_MAKER',
                    isPrimary: true,
                    source: 'simulation'
                },
                {
                    firstName: 'Mike',
                    lastName: 'Ross',
                    title: 'CEO',
                    email: `mike@${new URL(lead.websiteUrl).hostname.replace('www.', '')}`,
                    confidence: 60,
                    roleCategory: 'DECISION_MAKER',
                    isPrimary: false,
                    source: 'simulation'
                }
            ];

            // Save to DB
            for (const c of newContacts) {
                await prisma.contact.create({
                    data: {
                        leadId: lead.id,
                        ...c
                    }
                });
            }
        }

        // Return updated list
        const updatedContacts = await prisma.contact.findMany({
            where: { leadId: lead.id },
            orderBy: { confidence: 'desc' }
        });

        return NextResponse.json({ contacts: updatedContacts });

    } catch (error) {
        console.error('Contact Discovery Error:', error);
        return NextResponse.json({ error: 'Failed to discover contacts' }, { status: 500 });
    }
}
