/**
 * Website Health Utilities
 * 
 * Single source of truth for website health display logic.
 * Determines scan state and provides consistent display values.
 */

import { getWebsiteHealthLabel, type WebsiteHealthLabel } from './websiteHealth';

export type WebsiteHealthStatus = 'idle' | 'scanning' | 'success' | 'failed';

export interface WebsiteHealthInput {
    stalenessScore?: number | null;
    lastAnalysedAt?: Date | string | null;
    lastAnalyzedAt?: Date | string | null; // Alternative spelling
    websiteUrl?: string | null;
    websiteHealthStatus?: string | null;
    stalenessConfidence?: string | null;
    scoreReasons?: string | null;
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
}

/**
 * Determine if a company has been scanned for website health
 * Uses lastAnalysedAt as the authoritative indicator
 */
export function isWebsiteScanned(data: WebsiteHealthInput): boolean {
    const analysedAt = data.lastAnalysedAt || data.lastAnalyzedAt;
    return analysedAt !== null && analysedAt !== undefined;
}

/**
 * Determine the scan status from available data
 */
export function getWebsiteHealthStatus(data: WebsiteHealthInput): WebsiteHealthStatus {
    // If explicit status provided, use it
    if (data.websiteHealthStatus) {
        return data.websiteHealthStatus as WebsiteHealthStatus;
    }

    // Otherwise infer from lastAnalysedAt
    if (isWebsiteScanned(data)) {
        return 'success';
    }

    return 'idle';
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
 * @param data - Company/prospect data with staleness fields
 * @returns Unified display data with proper state handling
 */
export function getWebsiteHealthDisplay(data: WebsiteHealthInput): WebsiteHealthDisplay {
    const status = getWebsiteHealthStatus(data);
    const isScanned = status === 'success';
    const hasWebsite = !!(data.websiteUrl && data.websiteUrl !== 'Unknown' && data.websiteUrl !== 'N/A');

    // If not scanned, don't show a score (avoid 0/100 defaults)
    if (!isScanned) {
        return {
            score: null,
            label: hasWebsite ? 'Not Scanned' : 'No Website',
            status,
            isScanned: false,
            showScanButton: hasWebsite && status === 'idle',
            showScore: false,
            showRetry: status === 'failed',
            tone: 'neutral',
            color: 'gray'
        };
    }

    // Scanned - use actual score
    const score = data.stalenessScore ?? null;
    const healthLabel = getWebsiteHealthLabel(score);

    // Parse reasons if available
    let reasons: string[] | undefined;
    if (data.scoreReasons) {
        try {
            reasons = JSON.parse(data.scoreReasons);
        } catch (e) {
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
 * Returns the score if scanned, or "-" / "—" if not
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

    const scores = scannedItems.map(i => i.stalenessScore).filter((s): s is number => s !== null && s !== undefined);

    if (scores.length >= 3 && scores.every(s => s === 0)) {
        console.warn(`[${label}] Suspicious: all ${scores.length} scanned scores are exactly 0`);
    }
    if (scores.length >= 3 && scores.every(s => s === 100)) {
        console.warn(`[${label}] Suspicious: all ${scores.length} scanned scores are exactly 100`);
    }
}
