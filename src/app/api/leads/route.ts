import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
    try {
        const leads = await prisma.lead.findMany({
            orderBy: { createdAt: 'desc' },
        });
        return NextResponse.json(leads);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { companyName, websiteUrl, industry, location } = body;

        // Basic validations
        if (!companyName || !websiteUrl) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const lead = await prisma.lead.create({
            data: {
                companyName,
                websiteUrl,
                industry,
                location,
                companyProspectId: body.companyProspectId, // Link!
                emailStatus: 'NEW'
            },
        });

        return NextResponse.json(lead, { status: 201 });
    } catch (error) {
        // Handle unique constraint on websiteUrl
        if ((error as any).code === 'P2002') {
            return NextResponse.json({ error: 'Lead with this website already exists' }, { status: 409 });
        }
        return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 });
    }
}
