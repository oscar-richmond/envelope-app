export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { emailDiscovery } from '@/lib/services/email-discovery';

export async function POST(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;

    try {
        const id = parseInt(params.id);
        if (!id) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

        const prospect = await prisma.companyProspect.findUnique({
            where: { id }
        });

        if (!prospect || !prospect.websiteUrl) {
            return NextResponse.json({ error: "Prospect not found or missing website" }, { status: 404 });
        }

        // 1. Run Discovery
        const emails = await emailDiscovery.discoverEmails(prospect.websiteUrl);

        if (!prisma.prospectEmail) {
            console.error("Prisma Client missing ProspectEmail model. Run 'npx prisma generate'.");
            throw new Error("Internal Server Error: Database model missing");
        }

        // 2. Store Results (Avoid Duplicates)
        const saved: any[] = [];
        for (const e of emails) {
            const exists = await prisma.prospectEmail.findFirst({
                where: { companyProspectId: id, email: e.email }
            });

            if (!exists) {
                const rec = await prisma.prospectEmail.create({
                    data: {
                        companyProspectId: id,
                        email: e.email,
                        type: e.type,
                        confidence: e.confidence,
                        sourceUrl: e.sourceUrl,
                        contextSnippet: e.contextSnippet
                    }
                });
                saved.push(rec);
            } else {
                saved.push(exists);
            }
        }

        return NextResponse.json({ success: true, count: saved.length, emails: saved });

    } catch (e: any) {
        console.error("Email discovery failed", e);
        return NextResponse.json({ error: e.message || "Discovery failed" }, { status: 500 });
    }
}
