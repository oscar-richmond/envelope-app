export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { emailDiscovery } from '@/lib/services/email-discovery';

export async function POST(req: NextRequest) {
    try {
        // Find emails with no name
        const emails = await prisma.prospectEmail.findMany({
            where: {
                name: null
            },
            take: 100 // Batch size
        });

        const results = [];
        for (const e of emails) {
            const derived = emailDiscovery.deriveNameFromEmail(e.email);
            if (derived) {
                await prisma.prospectEmail.update({
                    where: { id: e.id },
                    data: { name: derived }
                });
                results.push({ email: e.email, derived });
            }
        }

        return NextResponse.json({
            success: true,
            processed: emails.length,
            updated: results.length,
            updates: results
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
