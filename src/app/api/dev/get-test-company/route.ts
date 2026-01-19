import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // Find a company with a website
        const company = await prisma.companyProspect.findFirst({
            where: {
                websiteUrl: { not: null },
                NOT: { websiteUrl: '' }
            },
            take: 1,
            skip: Math.floor(Math.random() * 10) // mild randomization
        });

        if (!company) {
            return NextResponse.json({ error: 'No test companies found' }, { status: 404 });
        }

        return NextResponse.json(company);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    }
}
