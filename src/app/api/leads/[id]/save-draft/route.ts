export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;

    try {
        const id = parseInt(params.id);
        const { subject, body, bodyHtml, status, version } = await req.json();

        if (!id) {
            return NextResponse.json({ error: "Missing Lead ID" }, { status: 400 });
        }

        // Sanitize HTML if present - Note: DOMPurify is client-side usually, for server use 'isomorphic-dompurify'
        let cleanHtml = bodyHtml;
        if (bodyHtml) {
            const DOMPurify = require('isomorphic-dompurify');
            cleanHtml = DOMPurify.sanitize(bodyHtml, {
                ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'ul', 'ol', 'li', 'blockquote'],
                ALLOWED_ATTR: ['href', 'target', 'rel']
            });
        }

        const data: any = {
            subjectLine1: subject,
            emailDraft: body,
            emailDraftHtml: cleanHtml,
            lastDraftSavedAt: new Date(),
        };

        if (status) {
            data.emailStatus = status;
            if (status === 'APPROVED') {
                data.approvedAt = new Date();
            }
        }

        const lead = await prisma.lead.update({
            where: { id },
            data
        });

        // Optional: Save version history if explicitly requested or on major status change
        // For now, we just update the lead.

        return NextResponse.json({ success: true, lead });

    } catch (error) {
        console.error("Save draft failed", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
