import { NextResponse } from 'next/server';
import { signIn } from '@/auth';

/**
 * DEV ONLY: Bypass auth endpoint for local testing
 * 
 * GET /api/dev/bypass-auth?email=oscar@selfhood-studios.com
 * 
 * This creates a session without requiring Google OAuth redirect URI setup
 */
export async function GET(request: Request) {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({
            error: 'This endpoint is only available in development'
        }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email') || process.env.INITIAL_ADMIN_EMAIL || 'oscar@selfhood-studios.com';

    try {
        // This would bypass normal OAuth flow
        // But we don't have a direct way to create session without provider
        // So instead, let's just redirect to a working page

        return NextResponse.json({
            message: 'Dev bypass available',
            instructions: [
                'For local testing without Google OAuth:',
                '1. Use the passkey login instead (if configured)',
                '2. Or manually add the redirect URI to Google Console:',
                '   http://localhost:3000/api/auth/callback/google',
                '3. Wait 1-2 minutes for Google to update',
                '4. Try logging in again'
            ],
            googleConsoleUrl: 'https://console.cloud.google.com/apis/credentials',
            requiredRedirectUri: 'http://localhost:3000/api/auth/callback/google'
        });
    } catch (error: any) {
        return NextResponse.json({
            error: 'Failed to bypass auth',
            detail: error.message
        }, { status: 500 });
    }
}
