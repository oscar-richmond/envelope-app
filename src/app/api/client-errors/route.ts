import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const body = await req.json();

        // In a real production app, you would send this to Sentry, LogRocket, Datadog, etc.
        // For now, we log to stdout so it appears in Vercel logs.
        console.error('[CLIENT_ERROR_REPORT]', JSON.stringify(body, null, 2));

        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: 'Failed to process error report' }, { status: 500 });
    }
}
