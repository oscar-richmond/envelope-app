export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { gmailService } from '@/lib/services/gmail';

export async function GET(req: any) {
    // Strategy: Priority Cascade
    // 1. Explicit Env Var (The "Nuclear Option" - overrides everything)
    let redirectUri = process.env.GOOGLE_REDIRECT_URI;

    // SAFETY CHECK: If we are in production, but the env var says "localhost", IGNORE IT.
    // This prevents the common mistake of deploying with dev env vars.
    if (process.env.NODE_ENV === 'production' && redirectUri?.includes('localhost')) {
        console.warn("WARN: Ignoring GOOGLE_REDIRECT_URI (localhost) in production. Falling back to dynamic origin.");
        redirectUri = undefined;
    }

    // 2. Client-Side Origin Injection (If no env var)
    if (!redirectUri) {
        const { searchParams } = new URL(req.url);
        const origin = searchParams.get('origin');

        if (origin) {
            // Client told us EXACTLY where it is (e.g. "https://my-app.vercel.app")
            // We trust this for the redirect base.
            redirectUri = `${origin}/api/auth/google/callback`;
        } else {
            // 3. Fallback Server-Side Detection
            const host = req.headers.get('host');
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
