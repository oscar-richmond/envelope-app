export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { verifyEmail, getConfiguredProvider, VerificationResult } from '@/lib/services/email-verification';

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
        const { email, companyId, contactId } = body;

        if (!email) {
            return NextResponse.json({
                success: false,
                error: 'email required'
            }, { status: 400, headers });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json({
                success: false,
                error: 'Invalid email format'
            }, { status: 400, headers });
        }

        const result = await verifyEmail(email);

        return NextResponse.json({
            success: true,
            requestId,
            ...result,
            provider: getConfiguredProvider(),
        }, { headers });

    } catch (error: any) {
        console.error('[Verify] Error:', error);
        return NextResponse.json({
            success: false,
            error: 'Verification failed',
            message: error.message
        }, { status: 500, headers });
    }
}
