/**
 * Scoring Engine Library
 * 
 * Single source of truth for website and financial health scoring.
 * Score is ALWAYS computed from factors: score = BASE_SCORE + Σ(factor.points)
 */

export * from './types';
export * from './computeWebsiteReview';
export * from './computeFinancialHealth';
