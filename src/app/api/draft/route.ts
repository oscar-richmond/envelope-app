import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { draftEmail } from '@/lib/services/drafter';

export async function POST(request: Request) {
    try {
        const { leadId } = await request.json();

        const lead = await prisma.lead.findUnique({
            where: { id: leadId }
        });

        if (!lead) {
            return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
        }

        // Run Drafting
        const result = await draftEmail(lead);

        // Update DB
        const updatedLead = await prisma.lead.update({
            where: { id: leadId },
            data: {
                emailDraft: result.emailBody,
                subjectLine1: result.subjectLine1,
                subjectLine2: result.subjectLine2,
                emailStatus: 'DRAFTED'
            }
        });

        return NextResponse.json(updatedLead);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Drafting failed' }, { status: 500 });
    }
}
