export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { outreachGenerator } from '@/lib/services/outreach-generator';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/follow-ups/[id]/variants
 * Get follow-up content for a specific tone variant
 * 
 * Query params:
 * - tone: 'polite' | 'assertive' | 'ultra-soft'
 * - regenerate: 'true' to get varied phrasing
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const queueId = parseInt(id);

        const { searchParams } = new URL(req.url);
        const tone = searchParams.get('tone') || 'polite';
        const regenerate = searchParams.get('regenerate') === 'true';

        // Get queue item with related data
        const queueItem = await prisma.followUpQueueItem.findUnique({
            where: { id: queueId },
            include: {
                sentEmail: {
                    include: {
                        lead: {
                            include: {
                                companyProspect: true
                            }
                        }
                    }
                }
            }
        });

        if (!queueItem) {
            return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });
        }

        const { sentEmail } = queueItem;
        const prospect = sentEmail.lead.companyProspect;

        // Get canonical company name
        const companyName = prospect
            ? outreachGenerator.getCanonicalName(prospect)
            : sentEmail.lead.companyName;

        // Extract first name from recipient
        const firstName = extractFirstName(queueItem.recipientEmail);

        // Generate all variants
        const variants = outreachGenerator.generateFollowUpVariants(
            sentEmail.subject,
            companyName,
            firstName,
            queueItem.followUpNumber,
            regenerate
        );

        // Return requested variant
        let body = variants.polite;
        if (tone === 'assertive') body = variants.assertive;
        if (tone === 'ultra-soft') body = variants.ultraSoft;

        return NextResponse.json({
            success: true,
            body,
            subject: variants.subject,
            tone,
            regenerated: regenerate
        });

    } catch (e: any) {
        console.error('Variants fetch error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

function extractFirstName(email: string): string | null {
    // Try to extract name from email before @
    const localPart = email.split('@')[0];
    if (!localPart) return null;

    // Split by common separators
    const parts = localPart.split(/[._-]/);
    const firstName = parts[0];

    // Only use if it looks like a name (2+ chars, alphabetic)
    if (firstName && firstName.length >= 2 && /^[a-zA-Z]+$/.test(firstName)) {
        return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
    }

    return null;
}
