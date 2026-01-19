/**
 * Feature Flags
 * 
 * Simple feature flag system using environment variables.
 * All flags should be prefixed with FF_ in the .env file.
 * 
 * Usage:
 *   import { FEATURE_FLAGS } from '@/lib/featureFlags';
 *   if (FEATURE_FLAGS.USE_NEW_WEBSITE_HEALTH_SCHEMA) { ... }
 */

export const FEATURE_FLAGS = {
    /**
     * Website Health Schema Migration
     * 
     * When true: Use new canonical fields (websiteHealthStatus, websiteHealthScore)
     * When false: Use legacy fields (stalenessScore, lastAnalysedAt)
     * 
     * DEFAULTS TO TRUE - backfill is complete and verified.
     * Can be rolled back by explicitly setting FF_NEW_WEBSITE_HEALTH=false in Vercel.
     * 
     * Supports both server (FF_NEW_WEBSITE_HEALTH) and client (NEXT_PUBLIC_FF_NEW_WEBSITE_HEALTH) env vars.
     */
    USE_NEW_WEBSITE_HEALTH_SCHEMA: process.env.FF_NEW_WEBSITE_HEALTH !== 'false' &&
        (typeof window === 'undefined' || process.env.NEXT_PUBLIC_FF_NEW_WEBSITE_HEALTH !== 'false'),
} as const;

/**
 * Check if a feature flag is enabled
 * (Type-safe wrapper for external access)
 */
export function isFeatureEnabled(flag: keyof typeof FEATURE_FLAGS): boolean {
    return FEATURE_FLAGS[flag];
}

/**
 * Get all feature flag values (for debugging)
 */
export function getAllFeatureFlags(): Record<string, boolean> {
    return { ...FEATURE_FLAGS };
}
