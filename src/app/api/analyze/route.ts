export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { analyzeUrl } from '@/lib/services/analyzer';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const { leadId } = await request.json();

        const lead = await prisma.lead.findUnique({
            where: { id: leadId }
        });

        if (!lead) {
            return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
        }

        // Run Analysis
        const result = await analyzeUrl(lead.websiteUrl);

        // Update DB
        const updatedLead = await prisma.lead.update({
            where: { id: leadId },
            data: {
                stalenessScore: result.stalenessScore,
                scoreConfidence: result.scoreConfidence,
                scoreReasons: JSON.stringify(result.scoreReasons),
                lastAnalyzedAt: new Date(),
                copyrightYear: result.copyrightYear,
                metaViewport: result.metaViewport,
                generatorTag: result.generatorTag,
                hasSitemap: result.hasSitemap,
                sitemapLastMod: result.sitemapLastMod,
                blogLastPost: result.blogLastPost
            }
        });

        return NextResponse.json(updatedLead);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
    }
}
