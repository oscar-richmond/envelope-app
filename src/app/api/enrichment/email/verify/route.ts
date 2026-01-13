export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { verifyEmail } from '@/lib/services/email-suggestions';

function getHeaders(requestId: string) {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
        'X-Request-Id': requestId,
    };
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: getHeaders('opt') });
}

export async function POST(request: Request) {
    const requestId = `ver_${Date.now()}`;
    const headers = getHeaders(requestId);

    try {
        const body = await request.json();
        const { email } = body;

        if (!email) {
            return NextResponse.json({
                success: false,
                error: 'email required'
            }, { status: 400, headers });
        }

        const result = await verifyEmail(email);

        return NextResponse.json({
            success: true,
            requestId,
            ...result
        }, { headers });

    } catch (error: any) {
        console.error('[Verify] Error:', error);
        return NextResponse.json({
            success: false,
            error: 'Verification failed'
        }, { status: 500, headers });
    }
}
