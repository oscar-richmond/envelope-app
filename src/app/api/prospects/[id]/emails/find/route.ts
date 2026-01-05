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
        const { emails, brandName, brandNameSource, brandNameConfidence, websiteDomain } = await emailDiscovery.discoverEmails(prospect.websiteUrl); // Destructure result

        // Save Brand Name & Metadata if found
        if (brandName || websiteDomain) {
            await prisma.companyProspect.update({
                where: { id },
                data: {
                    websiteBrandName: brandName,
                    websiteBrandNameSource: brandNameSource,
                    websiteBrandNameConfidence: brandNameConfidence,
                    websiteDomain: websiteDomain
                }
            });
        }

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
                        contextSnippet: e.contextSnippet,
                        name: e.name || null,
                        roleTitle: e.roleTitle,
                        roleConfidence: e.roleConfidence,
                        roleSource: e.roleSource
                    }
                });
                saved.push(rec);
            } else {
                // Update type AND new role fields if improved/discovered
                // We only overwrite role if the existing one is missing or if the new one is higher confidence?
                // For simplicity: If existing role is null, fill it. If exists, keep it (assume old one might be manual or better)
                // Actually if source is manual, never overwrite. But we haven't implemented manual yet.
                // Logic: Update type always. Update role if null.

                const updateData: any = {};
                if (exists.type !== e.type) updateData.type = e.type;
                if (!exists.name && e.name) updateData.name = e.name; // Enrich name if missing
                if (!exists.roleTitle && e.roleTitle) {
                    updateData.roleTitle = e.roleTitle;
                    updateData.roleSource = e.roleSource;
                    updateData.roleConfidence = e.roleConfidence;
                }

                if (Object.keys(updateData).length > 0) {
                    const updated = await prisma.prospectEmail.update({
                        where: { id: exists.id },
                        data: updateData
                    });
                    saved.push(updated);
                } else {
                    saved.push(exists);
                }
            }
        }

        return NextResponse.json({ success: true, count: saved.length, emails: saved });

    } catch (e: any) {
        console.error("Email discovery failed", e);
        return NextResponse.json({ error: e.message || "Discovery failed" }, { status: 500 });
    }
}
