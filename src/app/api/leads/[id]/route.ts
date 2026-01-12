export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

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
