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
     * Set to 'true' after backfill is complete and verified.
     * Can be instantly rolled back by setting to 'false'.
     */
    USE_NEW_WEBSITE_HEALTH_SCHEMA: process.env.FF_NEW_WEBSITE_HEALTH === 'true',
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
