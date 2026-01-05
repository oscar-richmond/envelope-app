export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { gmailService } from '@/lib/services/gmail';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code');
        const state = searchParams.get('state'); // Retrieve the encoded redirect URI

        if (!code) return NextResponse.json({ error: 'No code provided' }, { status: 400 });

        let redirectUri = process.env.GOOGLE_REDIRECT_URI;

        // HARD OVERRIDE FOR VERCEL (Consistency Check)
        const host = request.headers.get('host') || "";
        if (host.includes('vercel.app')) {
            redirectUri = `https://${host}/api/auth/google/callback`;
            console.log("Callback: Vercel detected. Forcing redirect URI to:", redirectUri);
        }
        // If no env var/override, try to recover from state
        else if (!redirectUri && state) {
            try {
                redirectUri = Buffer.from(state, 'base64').toString('ascii');
                console.log("Recovered redirect URI from state:", redirectUri);
            } catch (e) {
                console.warn("Failed to decode state:", e);
            }
        }

        // Final Fallback if everything fails
        if (!redirectUri) {
            const host = request.headers.get('host');
            redirectUri = `https://${host}/api/auth/google/callback`;
        }

        const email = await gmailService.handleCallback(code, redirectUri);

        // Redirect back to settings with success
        return NextResponse.redirect(new URL('/settings?connected=' + email, request.url));
    } catch (error) {
        console.error('OAuth callback failed:', error);
        return NextResponse.redirect(new URL('/settings?error=oauth_failed', request.url));
    }
}
