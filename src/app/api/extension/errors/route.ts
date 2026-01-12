export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

interface ErrorPayload {
    errorType: string;
    pageType: 'linkedin_profile' | 'linkedin_company' | 'website' | 'unknown';
    failedSelectors?: string[];
    parsingConfidence?: number;
    timestamp: number;
    extensionVersion?: string;
}

// In-memory buffer for recent errors (for rate limiting)
const recentErrors: Map<string, number> = new Map();
const ERROR_RATE_LIMIT_MS = 60000; // 1 error per type per minute

// POST /api/extension/errors - Log parsing errors (anonymised)
export async function POST(request: Request) {
    try {
        const body: ErrorPayload = await request.json();

        // Validate required fields
        if (!body.errorType || !body.pageType) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Rate limit by error type
        const errorKey = `${body.errorType}-${body.pageType}`;
        const lastSeen = recentErrors.get(errorKey);
        const now = Date.now();

        if (lastSeen && now - lastSeen < ERROR_RATE_LIMIT_MS) {
            // Silently accept but don't log (rate limited)
            return NextResponse.json({ success: true, rateLimited: true });
        }

        recentErrors.set(errorKey, now);

        // Clean up old entries
        for (const [key, timestamp] of recentErrors.entries()) {
            if (now - timestamp > ERROR_RATE_LIMIT_MS * 10) {
                recentErrors.delete(key);
            }
        }

        // Log to console (in production, this would go to a monitoring service)
        console.log('[Extension Error]', {
            errorType: body.errorType,
            pageType: body.pageType,
            failedSelectors: body.failedSelectors?.slice(0, 5), // Limit selectors logged
            parsingConfidence: body.parsingConfidence,
            extensionVersion: body.extensionVersion,
            timestamp: new Date(body.timestamp).toISOString()
        });

        // TODO: In production, send to monitoring service (e.g., Sentry, LogRocket)
        // await sendToMonitoring({...});

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('[Extension Errors API Error]', error);
        return NextResponse.json(
            { error: 'Failed to log error' },
            { status: 500 }
        );
    }
}
