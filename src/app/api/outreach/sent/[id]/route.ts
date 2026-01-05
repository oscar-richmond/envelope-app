export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PATCH(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    try {
        const id = parseInt(params.id);
        const { action } = await req.json();

        let updateData: any = {};

        if (action === 'SNOOZE') {
            const nextDate = new Date();
            nextDate.setDate(nextDate.getDate() + 3); // Snooze 3 days
            updateData = {
                status: 'SENT', // Back to waiting
                nextFollowUpAt: nextDate
            };
        } else if (action === 'CLOSED') {
            updateData = { status: 'CLOSED' };
        } else if (action === 'REPLIED') {
            updateData = { status: 'REPLIED', replyDetectedAt: new Date() };
        }

        const updated = await prisma.sentEmail.update({
            where: { id },
            data: updateData
        });

        return NextResponse.json({ success: true, updated });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
