export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { outreachGenerator } from '@/lib/services/outreach-generator';

export async function POST(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;

    try {
        const id = parseInt(params.id);

        // 1. Fetch Prospect with Lead
        const prospect = await prisma.companyProspect.findUnique({
            where: { id },
            include: { leads: true }
        });

        if (!prospect) {
            return NextResponse.json({ error: "Prospect not found" }, { status: 404 });
        }

        // 2. Generate Draft Content
        // (We pass potential existing lead, though generator currently mostly uses prospect data)
        const lead = prospect.leads[0] || null;
        const draftContent = outreachGenerator.generateDraft(prospect, lead);

        if (!draftContent) {
            return NextResponse.json({
                error: "Outreach not recommended for this prospect (Low Score or Dormant)"
            }, { status: 400 });
        }

        // 3. Ensure Lead Exists
        // If no lead exists for this prospect, create one now to store the draft.
        let targetLead = lead;
        if (!targetLead) {
            targetLead = await prisma.lead.create({
                data: {
                    companyName: prospect.companyName,
                    websiteUrl: prospect.websiteUrl || `http://placeholder-${prospect.companyNumber}.com`, // Fallback
                    industry: prospect.industry,
                    location: prospect.registeredLocation,
                    companyProspectId: prospect.id,
                    emailStatus: "DRAFTED"
                }
            });
        }

        // 4. Update Lead with Draft
        const updatedLead = await prisma.lead.update({
            where: { id: targetLead.id },
            data: {
                subjectLine1: draftContent.subject,
                emailDraft: draftContent.body,
                emailStatus: "DRAFTED"
            }
        });

        // 5. Store Draft Version (History)
        await prisma.emailDraft.create({
            data: {
                leadId: updatedLead.id,
                version: 1, // Simple versioning for now
                subjectLine1: draftContent.subject,
                subjectLine2: "",
                body: draftContent.body
            }
        });

        return NextResponse.json({
            draft: draftContent,
            leadId: updatedLead.id
        });

    } catch (error) {
        console.error("Draft generation failed", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
