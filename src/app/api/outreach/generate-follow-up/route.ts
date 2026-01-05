export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { outreachGenerator } from '@/lib/services/outreach-generator';

export async function POST(req: NextRequest) {
    try {
        const { originalSubject, companyName, followUpCount } = await req.json();
        const draft = outreachGenerator.generateFollowUp(originalSubject, companyName, followUpCount);
        return NextResponse.json({ draft });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
