export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { emailDiscovery } from '@/lib/services/email-discovery';

export async function POST(req: NextRequest) {
    try {
        console.log("Starting email re-classification...");
        const prospects = await prisma.companyProspect.findMany({
            include: { discoveredEmails: true }
        });

        let updatedCount = 0;

        for (const p of prospects) {
            if (!p.websiteUrl || p.discoveredEmails.length === 0) continue;

            let companyDomain = '';
            try {
                companyDomain = new URL(p.websiteUrl.startsWith('http') ? p.websiteUrl : 'https://' + p.websiteUrl).hostname.replace(/^www\./, '');
            } catch (e) { continue; }

            for (const emailRecord of p.discoveredEmails) {
                const newType = emailDiscovery.classify(emailRecord.email, companyDomain);

                if (newType !== emailRecord.type) {
                    await prisma.prospectEmail.update({
                        where: { id: emailRecord.id },
                        data: { type: newType }
                    });
                    updatedCount++;
                }
            }
        }

        console.log(`Re-classification complete. Updated ${updatedCount} emails.`);
        return NextResponse.json({ success: true, updatedCount });

    } catch (error: any) {
        console.error("Re-classification failed", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
