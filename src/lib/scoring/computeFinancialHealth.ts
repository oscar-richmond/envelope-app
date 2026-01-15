/**
 * Financial Health Scoring Engine
 * 
 * Computes financial health score from Companies House data.
 * Score = BASE_SCORE (50) + Σ(factor.points), clamped 0-100
 */

import { Factor, ReportResult, computeScoreFromFactors } from './types';

const BASE_SCORE = 50;

export interface FinancialScanInput {
    companyStatus?: string;
    accountsOverdue?: boolean;
    hasRecentAccounts?: boolean;
    daysSinceFiledAccounts?: number;
    hasConfirmationStatement?: boolean;
    companyAge?: number; // in years
    sicCodes?: string[];
    accountCategory?: string; // 'MICRO', 'SMALL', 'MEDIUM', 'LARGE', etc.
}

/**
 * Compute financial health from Companies House data
 * 
 * All factors are determined from actual data - no fabrication
 */
export function computeFinancialHealth(input: FinancialScanInput): ReportResult {
    const factors: Factor[] = [];

    // Factor: Company Status
    if (input.companyStatus) {
        const status = input.companyStatus.toLowerCase();
        if (status === 'active') {
            factors.push({
                id: 'status_active',
                label: 'Company is active',
                points: 15,
                polarity: 'positive',
                description: 'Listed as active on Companies House'
            });
        } else if (status.includes('dissolved') || status.includes('liquidation')) {
            factors.push({
                id: 'status_dissolved',
                label: 'Company is dissolved or in liquidation',
                points: -40,
                polarity: 'negative',
                description: `Status: ${input.companyStatus}`
            });
        } else if (status.includes('dormant')) {
            factors.push({
                id: 'status_dormant',
                label: 'Company is dormant',
                points: -10,
                polarity: 'negative',
                description: 'Company marked as dormant'
            });
        }
    }

    // Factor: Filing Health
    if (input.accountsOverdue === true) {
        factors.push({
            id: 'accounts_overdue',
            label: 'Accounts are overdue',
            points: -20,
            polarity: 'negative',
            description: 'Accounts filing deadline has passed'
        });
    } else if (input.hasRecentAccounts === true) {
        factors.push({
            id: 'accounts_current',
            label: 'Accounts filed and current',
            points: 15,
            polarity: 'positive',
            description: 'Recent accounts on file'
        });
    }

    // Factor: Confirmation Statement
    if (input.hasConfirmationStatement === true) {
        factors.push({
            id: 'confirmation_ok',
            label: 'Confirmation statement filed',
            points: 10,
            polarity: 'positive',
            description: 'Annual confirmation on file'
        });
    }

    // Factor: Company Age
    if (input.companyAge !== undefined) {
        if (input.companyAge >= 5) {
            factors.push({
                id: 'established',
                label: 'Established company',
                points: 10,
                polarity: 'positive',
                description: `Operating for ${input.companyAge}+ years`
            });
        } else if (input.companyAge < 1) {
            factors.push({
                id: 'new_company',
                label: 'Newly incorporated',
                points: -5,
                polarity: 'negative',
                description: 'Less than 1 year old'
            });
        }
    }

    // Factor: Company Size
    if (input.accountCategory) {
        const category = input.accountCategory.toUpperCase();
        if (category === 'LARGE' || category === 'MEDIUM') {
            factors.push({
                id: 'size_large',
                label: `${category} company`,
                points: 5,
                polarity: 'positive',
                description: 'Larger company with more oversight'
            });
        }
    }

    // Compute score from factors
    const score = computeScoreFromFactors(BASE_SCORE, factors);

    // Determine band label
    let statusLabel = 'Medium';
    if (score >= 70) statusLabel = 'Strong';
    else if (score < 40) statusLabel = 'Weak';

    // Determine confidence based on how much data we have
    let confidence: 'high' | 'medium' | 'low' = 'high';
    if (factors.length <= 1) confidence = 'low';
    else if (factors.length <= 2) confidence = 'medium';

    return {
        score,
        statusLabel,
        factors,
        computedAt: new Date().toISOString(),
        confidence,
        baseScore: BASE_SCORE
    };
}

/**
 * Create a "not scanned" report result
 */
export function createUnscannedFinancialReport(): ReportResult {
    return {
        score: null,
        statusLabel: 'Not Scanned',
        factors: [],
        computedAt: new Date().toISOString(),
        confidence: 'low',
        baseScore: BASE_SCORE
    };
}

/**
 * Create a failed scan report result
 */
export function createFailedFinancialReport(reason: string): ReportResult {
    return {
        score: null,
        statusLabel: 'Sync Failed',
        factors: [{
            id: 'sync_failed',
            label: 'Could not retrieve financial data',
            points: 0,
            polarity: 'negative',
            description: reason
        }],
        computedAt: new Date().toISOString(),
        confidence: 'low',
        baseScore: BASE_SCORE
    };
}
