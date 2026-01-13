export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { auth } from '@/auth';

/**
 * Extension Session Verification API
 * Returns authenticated status + user info for extension to verify session
 * 
 * This is the SINGLE SOURCE OF TRUTH for extension auth state
 */

function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
        'Content-Type': 'application/json',
    };
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: corsHeaders()
    });
}

export async function GET() {
    const headers = corsHeaders();

    try {
        const session = await auth();

        if (session?.user) {
            console.log('[ExtensionSession] Authenticated:', session.user.email);

            return NextResponse.json({
                authenticated: true,
                user: {
                    id: session.user.id,
                    email: session.user.email,
                    name: session.user.name,
                    // @ts-ignore
                    accessStatus: session.user.accessStatus,
                },
                timestamp: new Date().toISOString(),
            }, { headers });
        }

        console.log('[ExtensionSession] Not authenticated');

        return NextResponse.json({
            authenticated: false,
            user: null,
            timestamp: new Date().toISOString(),
        }, { headers });

    } catch (error: any) {
        console.error('[ExtensionSession] Error:', error);

        return NextResponse.json({
            authenticated: false,
            user: null,
            error: 'Session check failed',
            timestamp: new Date().toISOString(),
        }, { headers });
    }
}
