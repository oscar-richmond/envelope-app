export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { headers, cookies } from 'next/headers';

/**
 * Auth Health Check Endpoint
 * 
 * Single source of truth for auth state.
 * Returns 200 always, never redirects.
 * Used by extension to verify session.
 */

export async function GET(request: Request) {
    const requestHeaders = await headers();
    const requestCookies = await cookies();

    // Get request origin info
    const host = requestHeaders.get('host') || 'unknown';
    const origin = requestHeaders.get('origin') || 'unknown';
    const referer = requestHeaders.get('referer') || 'unknown';
    const userAgent = requestHeaders.get('user-agent') || 'unknown';

    // Check for auth cookies (names only, not values)
    const cookieNames = requestCookies.getAll().map(c => c.name);
    const hasAuthCookies = cookieNames.some(name =>
        name.includes('next-auth') ||
        name.includes('authjs') ||
        name.includes('session')
    );

    console.log('[AuthHealth] Request from:', { host, origin, referer });
    console.log('[AuthHealth] Cookie names present:', cookieNames);
    console.log('[AuthHealth] Has auth cookies:', hasAuthCookies);

    // Build response headers
    const responseHeaders = {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Access-Control-Allow-Origin': origin !== 'unknown' ? origin : '*',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    try {
        const session = await auth();

        const hasSession = !!(session?.user);
        const user = session?.user ? {
            id: session.user.id,
            email: session.user.email,
            name: session.user.name,
            // @ts-ignore
            accessStatus: session.user.accessStatus,
        } : null;

        console.log('[AuthHealth] Session check:', {
            hasSession,
            userEmail: user?.email,
            // @ts-ignore
            accessStatus: session?.user?.accessStatus
        });

        const response = {
            ok: true,
            timestamp: new Date().toISOString(),

            // Session state
            hasSession,
            user,

            // Debug info (dev only)
            debug: {
                host,
                origin,
                referer,
                cookieNamesPresent: cookieNames,
                hasAuthCookies,
                nextAuthUrl: process.env.NEXTAUTH_URL || process.env.AUTH_URL || 'not set',
                appUrl: process.env.NEXT_PUBLIC_APP_URL || 'not set',
                nodeEnv: process.env.NODE_ENV,
            }
        };

        return NextResponse.json(response, {
            status: 200,
            headers: responseHeaders
        });

    } catch (error: any) {
        console.error('[AuthHealth] Error:', error);

        return NextResponse.json({
            ok: false,
            timestamp: new Date().toISOString(),
            hasSession: false,
            user: null,
            error: error.message,
            debug: {
                host,
                origin,
                hasAuthCookies,
            }
        }, {
            status: 200, // Always 200, never redirect
            headers: responseHeaders
        });
    }
}

export async function OPTIONS(request: Request) {
    const requestHeaders = await headers();
    const origin = requestHeaders.get('origin') || '*';

    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
    });
}
