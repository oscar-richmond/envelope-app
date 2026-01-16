/**
 * Website Health Utilities
 * 
 * Single source of truth for website health display logic.
 * Determines scan state and provides consistent display values.
 * 
 * Supports dual-schema operation:
 * - FF_NEW_WEBSITE_HEALTH=false: Uses legacy fields (stalenessScore, lastAnalysedAt)
 * - FF_NEW_WEBSITE_HEALTH=true: Uses new canonical fields (websiteHealthStatus, websiteHealthScore)
 */

import { getWebsiteHealthLabel, type WebsiteHealthLabel } from './websiteHealth';
import { FEATURE_FLAGS } from '../featureFlags';

export type WebsiteHealthStatus = 'idle' | 'scanning' | 'success' | 'failed';

export interface WebsiteHealthInput {
    // Legacy fields (for rollback compatibility)
    stalenessScore?: number | null;
    lastAnalysedAt?: Date | string | null;
    lastAnalyzedAt?: Date | string | null; // Alternative spelling
    stalenessConfidence?: string | null;
    scoreReasons?: string | null;

    // New canonical fields (used when FF_NEW_WEBSITE_HEALTH=true)
    websiteHealthStatus?: string | null;
    websiteHealthScore?: number | null;
    websiteHealthScannedAt?: Date | string | null;
    websiteHealthError?: string | null;

    // Common fields
    websiteUrl?: string | null;
}

export interface WebsiteHealthDisplay {
    score: number | null;
    label: string;
    status: WebsiteHealthStatus;
    isScanned: boolean;
    showScanButton: boolean;
    showScore: boolean;
    showRetry: boolean;
    tone: WebsiteHealthLabel['tone'];
    color: WebsiteHealthLabel['color'];
    confidence?: string;
    reasons?: string[];
    error?: string;
}

/**
 * Determine if a company has been scanned for website health
 * 
 * With new schema: Check websiteHealthStatus === 'success'
 * With old schema: Check if stalenessScore exists OR lastAnalysedAt exists
 * 
 * FIXED: Legacy mode now treats stalenessScore presence as scanned,
 * not just lastAnalysedAt. This prevents score=0 from showing "Not Scanned".
 */
export function isWebsiteScanned(data: WebsiteHealthInput): boolean {
    if (FEATURE_FLAGS.USE_NEW_WEBSITE_HEALTH_SCHEMA) {
        return data.websiteHealthStatus === 'success';
    }

    // Legacy: Check if score exists (even if 0) OR timestamp exists
    // This fixes the bug where score=0 with no timestamp showed "Not Scanned"
    const hasScore = data.stalenessScore !== null && data.stalenessScore !== undefined;
    const analysedAt = data.lastAnalysedAt || data.lastAnalyzedAt;
    const hasTimestamp = analysedAt !== null && analysedAt !== undefined;

    return hasScore || hasTimestamp;
}

/**
 * Determine the scan status from available data
 * 
 * AUTHORITY RULE (when FF_NEW_WEBSITE_HEALTH=true):
 * - New fields are ALWAYS authoritative
 * - Never choose legacy data because its scannedAt is newer
 * - If new status exists (even idle/scanning/error), use new
 * - Only fall back to legacy when the flag is false
 */
export function getWebsiteHealthStatus(data: WebsiteHealthInput): WebsiteHealthStatus {
    if (FEATURE_FLAGS.USE_NEW_WEBSITE_HEALTH_SCHEMA) {
        // AUTHORITY: New schema is always authoritative when FF=true
        // If websiteHealthStatus exists (any value including null), use new schema
        // Only status values: idle, scanning, success, failed
        const newStatus = data.websiteHealthStatus;

        if (newStatus === 'success' || newStatus === 'scanning' || newStatus === 'failed') {
            return newStatus as WebsiteHealthStatus;
        }

        // If status is 'idle' or null/undefined, treat as idle
        // NEVER fall back to legacy - new schema is authoritative
        return 'idle';
    }

    // Legacy mode (FF=false): infer from lastAnalysedAt
    if (isWebsiteScanned(data)) {
        return 'success';
    }
    return 'idle';
}

/**
 * Get the raw score value
 * 
 * With new schema: Use websiteHealthScore (null = not scanned)
 * With old schema: Use stalenessScore only if scanned
 */
function getScoreValue(data: WebsiteHealthInput): number | null {
    if (FEATURE_FLAGS.USE_NEW_WEBSITE_HEALTH_SCHEMA) {
        return data.websiteHealthScore ?? null;
    }

    // Legacy: only return score if actually scanned
    if (isWebsiteScanned(data)) {
        return data.stalenessScore ?? null;
    }
    return null;
}

/**
 * Get unified website health display data
 * 
 * This function should be used EVERYWHERE website health is displayed:
 * - Prospect Search rows
 * - Lead Board rows
 * - Company Overview popup
 * - Full Company Profile
 * 
 * @param data - Company/prospect data with health fields
 * @returns Unified display data with proper state handling
 */
export function getWebsiteHealthDisplay(data: WebsiteHealthInput): WebsiteHealthDisplay {
    const status = getWebsiteHealthStatus(data);
    const isScanned = status === 'success';
    const hasWebsite = !!(data.websiteUrl && data.websiteUrl !== 'Unknown' && data.websiteUrl !== 'N/A');

    // Handle error state
    if (status === 'failed') {
        return {
            score: null,
            label: 'Scan Failed',
            status: 'failed',
            isScanned: false,
            showScanButton: false,
            showScore: false,
            showRetry: true,
            tone: 'negative',
            color: 'red',
            error: data.websiteHealthError || undefined
        };
    }

    // Handle scanning state
    if (status === 'scanning') {
        return {
            score: null,
            label: 'Scanning...',
            status: 'scanning',
            isScanned: false,
            showScanButton: false,
            showScore: false,
            showRetry: false,
            tone: 'neutral',
            color: 'gray'
        };
    }

    // Handle not scanned state (idle)
    if (!isScanned) {
        return {
            score: null,
            label: hasWebsite ? 'Not Scanned' : 'No Website',
            status: 'idle',
            isScanned: false,
            showScanButton: hasWebsite,
            showScore: false,
            showRetry: false,
            tone: 'neutral',
            color: 'gray'
        };
    }

    // Scanned - use actual score
    const score = getScoreValue(data);
    const healthLabel = getWebsiteHealthLabel(score);

    // Parse reasons if available
    let reasons: string[] | undefined;
    if (data.scoreReasons) {
        try {
            reasons = JSON.parse(data.scoreReasons);
        } catch {
            // Ignore parse errors
        }
    }

    return {
        score,
        label: healthLabel.label,
        status: 'success',
        isScanned: true,
        showScanButton: false,
        showScore: true,
        showRetry: false,
        tone: healthLabel.tone,
        color: healthLabel.color,
        confidence: data.stalenessConfidence || undefined,
        reasons
    };
}

/**
 * Get a simple score display string
 * Returns the score if scanned, or "—" if not
 */
export function getScoreDisplay(data: WebsiteHealthInput): string | number {
    const display = getWebsiteHealthDisplay(data);
    if (display.showScore && display.score !== null) {
        return display.score;
    }
    return '—';
}

/**
 * Debug helper - warns if all scores in a list are suspicious (all 0 or all 100)
 */
export function warnIfSuspiciousScores(items: WebsiteHealthInput[], label: string = 'WebsiteHealth'): void {
    const scannedItems = items.filter(i => isWebsiteScanned(i));
    if (scannedItems.length < 3) return;

    const scores = scannedItems.map(i => getScoreValue(i)).filter((s): s is number => s !== null && s !== undefined);

    if (scores.length >= 3 && scores.every(s => s === 0)) {
        console.warn(`[${label}] Suspicious: all ${scores.length} scanned scores are exactly 0`);
    }
    if (scores.length >= 3 && scores.every(s => s === 100)) {
        console.warn(`[${label}] Suspicious: all ${scores.length} scanned scores are exactly 100`);
    }
}

/**
 * Get which schema is currently active (for debugging)
 */
export function getActiveSchema(): 'legacy' | 'new' {
    return FEATURE_FLAGS.USE_NEW_WEBSITE_HEALTH_SCHEMA ? 'new' : 'legacy';
}
