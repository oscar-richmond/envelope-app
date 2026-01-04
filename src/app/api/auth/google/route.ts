export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { gmailService } from '@/lib/services/gmail';

export async function GET() {
    const url = gmailService.getAuthUrl();
    return NextResponse.redirect(url);
}
