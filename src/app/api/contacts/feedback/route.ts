export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { recordFeedback, getContactFeedback, ContactFeedback } from '@/lib/services/domain-cache';

/**
 * Contact Feedback Endpoint
 * Records bounce/reply events for learning
 */

function getHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json',
    };
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: getHeaders() });
}

// GET - Get feedback history for an email
export async function GET(request: Request) {
    const headers = getHeaders();
    const url = new URL(request.url);
    const email = url.searchParams.get('email');

    if (!email) {
        return NextResponse.json({
            success: false,
            error: 'email query param required',
        }, { status: 400, headers });
    }

    const feedback = getContactFeedback(email);

    return NextResponse.json({
        success: true,
        email,
        feedback,
        summary: {
            bounces: feedback.filter(f => f.event === 'bounce').length,
            replies: feedback.filter(f => f.event === 'reply').length,
            opens: feedback.filter(f => f.event === 'open').length,
            clicks: feedback.filter(f => f.event === 'click').length,
        },
    }, { headers });
}

// POST - Record feedback
export async function POST(request: Request) {
    const headers = getHeaders();

    try {
        const body = await request.json();
        const { email, domain, event } = body;

        if (!email || !domain || !event) {
            return NextResponse.json({
                success: false,
                error: 'email, domain, and event required',
            }, { status: 400, headers });
        }

        const validEvents = ['bounce', 'reply', 'open', 'click', 'unsubscribe'];
        if (!validEvents.includes(event)) {
            return NextResponse.json({
                success: false,
                error: `Invalid event. Must be one of: ${validEvents.join(', ')}`,
            }, { status: 400, headers });
        }

        const feedback: ContactFeedback = {
            email,
            domain,
            event,
            timestamp: new Date().toISOString(),
        };

        recordFeedback(feedback);

        return NextResponse.json({
            success: true,
            message: `Recorded ${event} for ${email}`,
            feedback,
        }, { headers });

    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message,
        }, { status: 500, headers });
    }
}
