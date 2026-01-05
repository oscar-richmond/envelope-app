export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
    try {
        // Configuration
        const settings = await prisma.settings.findFirst();
        const delayDays = settings?.followUpDelayDays || 4;

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - delayDays);

        // Find items that are SENT (waiting) and older than cutoff
        const overdue = await prisma.sentEmail.updateMany({
            where: {
                status: 'SENT',
                sentAt: { lte: cutoffDate }
            },
            data: {
                status: 'FOLLOW_UP_DUE',
                nextFollowUpAt: new Date() // Due now
            }
        });

        return NextResponse.json({
            success: true,
            flagged: overdue.count,
            cutoff: cutoffDate.toISOString()
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
