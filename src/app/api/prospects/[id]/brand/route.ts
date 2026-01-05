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
        const { brandName } = await req.json();

        if (!id) {
            return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
        }

        // Logic: specific field for override
        const data: any = {
            brandNameOverrideUpdatedAt: new Date()
        };

        if (brandName && typeof brandName === 'string' && brandName.trim().length > 0) {
            data.brandNameOverride = brandName.trim();
        } else {
            // Reset if empty or null
            data.brandNameOverride = null;
        }

        const updated = await prisma.companyProspect.update({
            where: { id },
            data
        });

        return NextResponse.json({ success: true, prospect: updated });
    } catch (e: any) {
        console.error("Failed to update brand name", e);
        return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }
}
