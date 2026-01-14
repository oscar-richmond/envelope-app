export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

// Helper to validate auth - session OR extension token with DB verification
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
                // Verify user exists in DB and is approved
                const user = await prisma.user.findUnique({
                    where: { email: decoded.email },
                    select: { email: true, accessStatus: true }
                });

                if (user && user.accessStatus === 'approved') {
                    return user.email!;
                }
            }
        } catch (e) {
            // Invalid token format
        }
    }

    return null;
}

// GET /api/lists - Get all lists (most recent 5 + default)
export async function GET(request: Request) {
    try {
        const userEmail = await validateAuth(request);
        if (!userEmail) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get or create default "Target Accounts" list
        let defaultList = await prisma.list.findFirst({
            where: { isDefault: true }
        });

        if (!defaultList) {
            defaultList = await prisma.list.create({
                data: {
                    name: 'Target Accounts',
                    description: 'Default list for saved companies',
                    isDefault: true
                }
            });
        }

        // Get recent lists (most recently updated first)
        const lists = await prisma.list.findMany({
            orderBy: { updatedAt: 'desc' },
            take: 6, // Get 6 to ensure we have 5 non-default + the default
            include: {
                _count: {
                    select: { companies: true }
                }
            }
        });

        // Ensure default is first, then others
        const sortedLists = [
            defaultList,
            ...lists.filter(l => l.id !== defaultList!.id).slice(0, 5)
        ];

        return NextResponse.json({
            lists: sortedLists.map(list => ({
                id: list.id,
                name: list.name,
                description: list.description,
                isDefault: list.isDefault,
                companyCount: 'companies' in list ? (list as any)._count?.companies || 0 : 0
            }))
        });

    } catch (error: any) {
        console.error('[Lists GET Error]', error);
        return NextResponse.json(
            { error: 'Failed to fetch lists', details: error.message },
            { status: 500 }
        );
    }
}

// POST /api/lists - Create new list
export async function POST(request: Request) {
    try {
        const userEmail = await validateAuth(request);
        if (!userEmail) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { name, description } = await request.json();

        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return NextResponse.json({ error: 'List name is required' }, { status: 400 });
        }

        const list = await prisma.list.create({
            data: {
                name: name.trim(),
                description: description?.trim() || null
            }
        });

        return NextResponse.json({
            success: true,
            list: {
                id: list.id,
                name: list.name,
                description: list.description,
                isDefault: list.isDefault
            }
        });

    } catch (error: any) {
        console.error('[Lists POST Error]', error);
        return NextResponse.json(
            { error: 'Failed to create list', details: error.message },
            { status: 500 }
        );
    }
}
