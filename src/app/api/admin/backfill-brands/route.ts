export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { emailDiscovery } from '@/lib/services/email-discovery';

export async function POST(req: NextRequest) {
    try {
        // 1. Find prospects needing update (missing confidence score means old data)
        const prospects = await prisma.companyProspect.findMany({
            where: {
                websiteUrl: { not: null },
                websiteBrandNameConfidence: null
            },
            take: 20 // Batch size limit for Vercel functions
        });

        const results = [];
        for (const p of prospects) {
            if (!p.websiteUrl) continue;
            try {
                // Run scan purely for brand name
                const { brandName, brandNameSource, brandNameConfidence, websiteDomain } = await emailDiscovery.discoverEmails(p.websiteUrl);

                if (brandName || websiteDomain) {
                    await prisma.companyProspect.update({
                        where: { id: p.id },
                        data: {
                            websiteBrandName: brandName,
                            websiteBrandNameSource: brandNameSource,
                            websiteBrandNameConfidence: brandNameConfidence,
                            websiteDomain: websiteDomain
                        }
                    });
                    results.push({ id: p.id, name: brandName, status: 'UPDATED' });
                } else {
                    results.push({ id: p.id, status: 'NO_DATA' });
                }
            } catch (e: any) {
                console.error(`Backfill failed for ${p.id}`, e);
                results.push({ id: p.id, error: e.message });
            }
        }

        return NextResponse.json({
            success: true,
            processed: prospects.length,
            details: results,
            remaining: await prisma.companyProspect.count({ where: { websiteUrl: { not: null }, websiteBrandNameConfidence: null } })
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
