export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PUT(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    try {
        const id = parseInt(params.id);
        const { roleTitle, name } = await req.json();

        if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

        // Update ProspectEmail with Manual Override
        const updated = await prisma.prospectEmail.update({
            where: { id },
            data: {
                roleTitle: roleTitle,
                name: name,
                roleSource: 'manual',
                roleConfidence: 'HIGH'
            }
        });

        return NextResponse.json({ success: true, email: updated });
    } catch (e: any) {
        console.error("Failed to update email role", e);
        return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }
}
