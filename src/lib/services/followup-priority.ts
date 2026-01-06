/**
 * Follow-Up Priority Calculator
 * Calculates priority scores for ordering the follow-up queue
 */

import { getOverdueBusinessDays } from '@/lib/utils/business-days';

interface PriorityInput {
    // Lead scoring (from priorityCalculator)
    opportunityScore?: number;      // 0-100 (Need + Ability + Confidence)

    // Financial Activity
    financialActivityScore?: number; // 0-100

    // Website staleness
    stalenessScore?: number;        // 0-100

    // Follow-up timing
    dueAt: Date;
    now?: Date;
}

interface PriorityResult {
    score: number;          // 0-100
    reasonSummary: string;  // Human-readable explanation
    isOverdue: boolean;
    overdueDays: number;
}

/**
 * Calculate follow-up priority score
 * 
 * Weights:
 * - Opportunity Score: 50%
 * - Financial Activity: 20%
 * - Website Staleness: 20%
 * - Overdue Days: 10%
 * 
 * Overdue items always rank above non-overdue items
 */
export function calculateFollowUpPriority(input: PriorityInput): PriorityResult {
    const now = input.now || new Date();
    const isOverdue = input.dueAt < now;
    const overdueDays = getOverdueBusinessDays(input.dueAt, now);

    // Normalize inputs (default to 0)
    const opportunityScore = input.opportunityScore || 0;
    const financialScore = input.financialActivityScore || 0;
    const stalenessScore = input.stalenessScore || 0;

    // Calculate weighted score components
    const opportunityComponent = opportunityScore * 0.50;
    const financialComponent = financialScore * 0.20;
    const stalenessComponent = stalenessScore * 0.20;

    // Overdue bonus: up to 10 points based on days overdue (capped at 10 days)
    const overdueBonus = Math.min(overdueDays, 10) * 1.0;

    // Base score
    let score = opportunityComponent + financialComponent + stalenessComponent + overdueBonus;

    // Overdue boost: add 20 points to ensure overdue items rank higher
    if (isOverdue) {
        score += 20;
    }

    // Cap at 100
    score = Math.min(100, Math.round(score));

    // Generate reason summary
    const reasons: string[] = [];

    // Opportunity band
    if (opportunityScore >= 60) {
        reasons.push('High opportunity');
    } else if (opportunityScore >= 35) {
        reasons.push('Medium opportunity');
    } else {
        reasons.push('Low opportunity');
    }

    // Overdue status
    if (isOverdue) {
        reasons.push(`overdue ${overdueDays} day${overdueDays !== 1 ? 's' : ''}`);
    }

    // Financial strength
    if (financialScore >= 60) {
        reasons.push('strong financials');
    }

    const reasonSummary = reasons.join(', ');

    return {
        score,
        reasonSummary: reasonSummary.charAt(0).toUpperCase() + reasonSummary.slice(1),
        isOverdue,
        overdueDays
    };
}

/**
 * Get priority band from score
 */
export function getPriorityBand(score: number): 'HIGH' | 'MEDIUM' | 'LOW' {
    if (score >= 60) return 'HIGH';
    if (score >= 35) return 'MEDIUM';
    return 'LOW';
}

export const followUpPriority = {
    calculate: calculateFollowUpPriority,
    getBand: getPriorityBand
};
