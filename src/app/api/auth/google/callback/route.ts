export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { gmailService } from '@/lib/services/gmail';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code');

        if (!code) return NextResponse.json({ error: 'No code provided' }, { status: 400 });

        const email = await gmailService.handleCallback(code);

        // Redirect back to settings with success
        return NextResponse.redirect(new URL('/settings?connected=' + email, request.url));
    } catch (error) {
        console.error('OAuth callback failed:', error);
        return NextResponse.redirect(new URL('/settings?error=oauth_failed', request.url));
    }
}
