import { NextResponse } from 'next/server';
import { websiteMatcher } from '@/lib/providers';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
    try {
        const { prospectIds } = await request.json(); // Expect array of IDs

        if (!Array.isArray(prospectIds) || prospectIds.length === 0) {
            return NextResponse.json({ error: "Invalid prospect IDs" }, { status: 400 });
        }

        const results = [];

        // Sequential processing to respect rate limits (basic)
        for (const id of prospectIds) {
            const prospect = await prisma.companyProspect.findUnique({ where: { id } });

            if (!prospect) continue;

            // Skip if recently matched (unless forced - add force flag later if needed)
            if (prospect.websiteLastMatchedAt) {
                const daysSince = (Date.now() - new Date(prospect.websiteLastMatchedAt).getTime()) / (1000 * 3600 * 24);
                if (daysSince < 7 && prospect.websiteUrl) {
                    results.push({ id, status: 'SKIPPED', url: prospect.websiteUrl });
                    continue;
                }
            }

            const match = await websiteMatcher.match(prospect.companyName, prospect.registeredLocation || 'UK', prospect.industry || undefined);

            console.log(`[Match Debug] ID: ${id} | Name: ${prospect.companyName} | URL: ${match.url} | Confidence: ${match.confidence} | Reason: ${(match.evidence as any)?.failureReason}`);

            // Update DB
            await prisma.companyProspect.update({
                where: { id },
                data: {
                    websiteUrl: match.url || prospect.websiteUrl, // Don't overwrite existing URL with null if we fail, unless we want to clear it? Keeping existing is safer unless we are sure.
                    websiteConfidence: match.confidence,
                    websiteDiscoveryMethod: 'google_places',
                    websiteMatchEvidence: JSON.stringify(match.evidence),
                    websiteLastMatchedAt: new Date(),
                    // Update status filter? Not strictly needed for logic, but UI uses it.
                }
            });

            results.push({ id, status: 'MATCHED', match });

            // Sleep 200ms to be nice to rate limits
            await new Promise(r => setTimeout(r, 200));
        }

        return NextResponse.json({ results });

    } catch (error: any) {
        console.error("Website matching failed:", error);
        return NextResponse.json({
            error: 'Matching failed',
            details: error.message,
            stack: error.stack,
            name: error.name
        }, { status: 500 });
    }
}
