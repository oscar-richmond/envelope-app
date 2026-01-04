export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

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
// DELETE: Remove a lead
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const leadId = parseInt(id);

        await prisma.lead.delete({
            where: { id: leadId }
        });

        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }
}
