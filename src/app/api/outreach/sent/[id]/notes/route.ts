export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

type RouteParams = { params: Promise<{ id: string }> };

// Soft character limit for notes
const MAX_NOTES_LENGTH = 800;

/**
 * GET /api/outreach/sent/[id]/notes
 * Get notes for a conversation
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const emailId = parseInt(id);

        const email = await prisma.sentEmail.findUnique({
            where: { id: emailId },
            select: {
                id: true,
                notesText: true,
                notesUpdatedAt: true
            }
        });

        if (!email) {
            return NextResponse.json({ error: 'Email not found' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            notes: email.notesText || '',
            updatedAt: email.notesUpdatedAt,
            hasNotes: !!email.notesText && email.notesText.length > 0
        });

    } catch (e: any) {
        console.error('Get notes error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

/**
 * PATCH /api/outreach/sent/[id]/notes
 * Update notes for a conversation (autosave)
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const emailId = parseInt(id);
        const body = await req.json();
        let { notes } = body;

        // Validate
        if (typeof notes !== 'string') {
            return NextResponse.json({ error: 'Notes must be a string' }, { status: 400 });
        }

        // Soft limit (trim if too long, but don't reject)
        if (notes.length > MAX_NOTES_LENGTH) {
            notes = notes.substring(0, MAX_NOTES_LENGTH);
        }

        // Update
        await prisma.sentEmail.update({
            where: { id: emailId },
            data: {
                notesText: notes || null,
                notesUpdatedAt: new Date()
            }
        });

        return NextResponse.json({
            success: true,
            notes,
            updatedAt: new Date()
        });

    } catch (e: any) {
        console.error('Update notes error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
