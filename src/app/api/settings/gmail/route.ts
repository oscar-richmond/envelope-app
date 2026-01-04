import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
    try {
        const conn = await prisma.gmailAccount.findFirst();
        if (!conn) return NextResponse.json({ connected: false });

        return NextResponse.json({
            connected: true,
            email: conn.email,
            sentToday: conn.sentToday,
            limit: conn.dailyLimit
        });
    } catch (error) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

export async function DELETE() {
    try {
        await prisma.gmailAccount.deleteMany();
        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
