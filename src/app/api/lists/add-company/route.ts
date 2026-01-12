export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

// Helper to validate auth
async function validateAuth(request: Request): Promise<string | null> {
    // First try session auth
    const session = await auth();
    if (session?.user?.email) {
        return session.user.email;
    }

    // If no session, try extension token
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        try {
            const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
            if (decoded.exp && decoded.exp > Date.now() && decoded.email) {
                return decoded.email;
            }
        } catch (e) {
            // Invalid token format
        }
    }

    return null;
}

// POST /api/lists/add-company - Add a company to a list
export async function POST(request: Request) {
    try {
        const userEmail = await validateAuth(request);
        if (!userEmail) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { listId, prospectId } = await request.json();

        if (!listId || !prospectId) {
            return NextResponse.json(
                { error: 'listId and prospectId are required' },
                { status: 400 }
            );
        }

        // Verify list exists
        const list = await prisma.list.findUnique({
            where: { id: listId }
        });

        if (!list) {
            return NextResponse.json({ error: 'List not found' }, { status: 404 });
        }

        // Verify prospect exists
        const prospect = await prisma.companyProspect.findUnique({
            where: { id: prospectId }
        });

        if (!prospect) {
            return NextResponse.json({ error: 'Company not found' }, { status: 404 });
        }

        // Add to list (upsert to handle duplicates gracefully)
        const listCompany = await prisma.listCompany.upsert({
            where: {
                listId_prospectId: {
                    listId,
                    prospectId
                }
            },
            update: {
                addedAt: new Date()
            },
            create: {
                listId,
                prospectId
            }
        });

        // Update list's updatedAt to move it to recent
        await prisma.list.update({
            where: { id: listId },
            data: { updatedAt: new Date() }
        });

        return NextResponse.json({
            success: true,
            listCompanyId: listCompany.id,
            listName: list.name,
            message: `Added to ${list.name}`
        });

    } catch (error: any) {
        console.error('[Lists Add Company Error]', error);
        return NextResponse.json(
            { error: 'Failed to add company to list', details: error.message },
            { status: 500 }
        );
    }
}
