export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { gmailService } from '@/lib/services/gmail';

export async function GET(req: any) {
    // Strategy: Priority Cascade
    // 1. Explicit Env Var
    let redirectUri = process.env.GOOGLE_REDIRECT_URI;

    // 2. HARD OVERRIDE FOR VERCEL
    const host = req.headers.get('host') || "";
    if (host.includes('vercel.app')) {
        // If we are on Vercel, we MUST use the Vercel URL with HTTPS.
        // This generally fixes all "Access blocked" or "Site can't be reached" issues
        // by ignoring any misconfigured env vars or http/https confusion.
        redirectUri = `https://${host}/api/auth/google/callback`;
        console.log("Vercel detected. Forcing redirect URI to:", redirectUri);
    }
    // 3. Client-Side Origin Injection (Only if NOT on Vercel and no env var)
    else if (!redirectUri) {
        const { searchParams } = new URL(req.url);
        const origin = searchParams.get('origin');

        if (origin) {
            redirectUri = `${origin}/api/auth/google/callback`;
        } else {
            // 4. Fallback Server-Side Detection
            let protocol = req.headers.get('x-forwarded-proto');
            if (!protocol && process.env.NODE_ENV === 'production') protocol = 'https';
            if (!protocol) protocol = 'http';
            redirectUri = `${protocol}://${host}/api/auth/google/callback`;
        }
    }

    // 4. Encode this URI into the 'state' param so we can retrieve it in the callback
    // This allows the callback to know EXACTLY what URI was used to start the flow.
    const state = Buffer.from(redirectUri).toString('base64');

    console.log("Auth Start: Using dynamic redirect:", redirectUri);

    const url = gmailService.getAuthUrl(redirectUri, state);
    return NextResponse.redirect(url);
}
