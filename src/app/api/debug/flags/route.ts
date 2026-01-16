// Debug endpoint to check feature flag values at runtime
import { NextResponse } from 'next/server';
import { FEATURE_FLAGS, getAllFeatureFlags } from '@/lib/featureFlags';
import { auth } from '@/auth';

export async function GET(request: Request) {
    try {
        // Auth check - admin only
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get all evaluated feature flags
        const flags = getAllFeatureFlags();

        // Get raw env var values
        const envVars = {
            FF_NEW_WEBSITE_HEALTH: process.env.FF_NEW_WEBSITE_HEALTH || '(not set)',
            NEXT_PUBLIC_DEBUG_HEALTH: process.env.NEXT_PUBLIC_DEBUG_HEALTH || '(not set)',
        };

        // Runtime info
        const runtime = {
            nodeEnv: process.env.NODE_ENV,
            vercelEnv: process.env.VERCEL_ENV || '(not running on Vercel)',
            isProduction: process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production',
        };

        return NextResponse.json({
            flags,
            envVars,
            runtime,
            evaluation: {
                USE_NEW_WEBSITE_HEALTH_SCHEMA: FEATURE_FLAGS.USE_NEW_WEBSITE_HEALTH_SCHEMA,
                explanation: FEATURE_FLAGS.USE_NEW_WEBSITE_HEALTH_SCHEMA
                    ? '✅ Using NEW schema (websiteHealthStatus/Score/ScannedAt)'
                    : '⚠️ Using LEGACY schema (stalenessScore/lastAnalysedAt)',
            },
            instructions: {
                toEnable: 'Set FF_NEW_WEBSITE_HEALTH=true in Vercel → Settings → Environment Variables',
                toDebug: 'Visit /api/debug/website-health?companyId=319 for detailed health check',
            },
        });
    } catch (error: any) {
        return NextResponse.json(
            {
                error: 'Failed to get flags',
                details: error.message,
            },
            { status: 500 }
        );
    }
}
