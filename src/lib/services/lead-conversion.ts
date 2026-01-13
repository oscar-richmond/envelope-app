/**
 * Phase 6: Lead Conversion Pipeline
 * Prospect → Enrich → Contacts → Verify → Score → Action
 */

// ============================================
// TYPES
// ============================================

export type PipelineStatus = 'queued' | 'running' | 'done' | 'failed';

export type PipelineStep =
    | 'website_match'
    | 'financial_review'
    | 'discovery'
    | 'verification'
    | 'scoring';

export interface StepResult {
    status: 'pending' | 'running' | 'done' | 'failed' | 'skipped';
    startedAt?: string;
    finishedAt?: string;
    data?: Record<string, unknown>;
    error?: string;
}

export interface LeadConversionJob {
    id: string;
    prospectId: string;
    companyName: string;
    domain: string;
    status: PipelineStatus;
    steps: Record<PipelineStep, StepResult>;
    opportunityScore?: OpportunityScore;
    recommendedAction?: RecommendedAction;
    startedAt: string;
    finishedAt?: string;
    error?: string;
}

export interface OpportunityScore {
    total: number;
    need: number;
    ability: number;
    confidence: number;
    breakdown: {
        websiteStaleness?: number;
        designAge?: number;
        financialActivity?: number;
        contactVerified?: boolean;
        dataCompleteness?: number;
    };
}

export interface RecommendedAction {
    type: 'compose' | 'add_pipeline' | 'needs_review' | 'needs_contact';
    label: string;
    target?: string; // e.g., "CEO" or best contact name
    reason: string[];
}

// ============================================
// OPPORTUNITY SCORING
// ============================================

export function calculateOpportunityScore(
    websiteData: {
        lastUpdated?: string;
        hasModernDesign?: boolean;
        mobileResponsive?: boolean;
    },
    financialData: {
        isActive?: boolean;
        hasRecentFilings?: boolean;
        estimatedRevenue?: string;
    },
    contactData: {
        hasVerifiedContact?: boolean;
        bestContactName?: string;
        bestContactRole?: string;
        totalContacts?: number;
    }
): OpportunityScore {
    let need = 0;
    let ability = 0;
    let confidence = 0;

    const breakdown: OpportunityScore['breakdown'] = {};

    // NEED (0-40): Website staleness and design age
    if (websiteData.lastUpdated) {
        const daysSinceUpdate = daysSince(websiteData.lastUpdated);
        if (daysSinceUpdate > 365 * 2) need += 20; // Very stale
        else if (daysSinceUpdate > 365) need += 15;
        else if (daysSinceUpdate > 180) need += 10;
        else need += 5;
        breakdown.websiteStaleness = daysSinceUpdate;
    } else {
        need += 10; // Unknown = moderate need
    }

    if (!websiteData.hasModernDesign) {
        need += 15;
        breakdown.designAge = 1;
    }

    if (!websiteData.mobileResponsive) {
        need += 5;
    }

    need = Math.min(need, 40);

    // ABILITY (0-35): Financial activity
    if (financialData.isActive) {
        ability += 15;
    }

    if (financialData.hasRecentFilings) {
        ability += 10;
        breakdown.financialActivity = 1;
    }

    if (financialData.estimatedRevenue) {
        const rev = financialData.estimatedRevenue.toLowerCase();
        if (rev.includes('million') || rev.includes('£1m') || rev.includes('$1m')) {
            ability += 10;
        } else {
            ability += 5;
        }
    } else {
        ability += 5; // Unknown = assume some ability
    }

    ability = Math.min(ability, 35);

    // CONFIDENCE (0-25): Contact and data completeness
    if (contactData.hasVerifiedContact) {
        confidence += 15;
        breakdown.contactVerified = true;
    } else if (contactData.totalContacts && contactData.totalContacts > 0) {
        confidence += 8;
    }

    const dataPoints = [
        !!websiteData.lastUpdated,
        !!financialData.isActive,
        !!contactData.totalContacts,
        !!contactData.bestContactName,
    ].filter(Boolean).length;

    confidence += Math.min(dataPoints * 2.5, 10);
    breakdown.dataCompleteness = dataPoints / 4;

    confidence = Math.min(confidence, 25);

    return {
        total: Math.round(need + ability + confidence),
        need: Math.round(need),
        ability: Math.round(ability),
        confidence: Math.round(confidence),
        breakdown,
    };
}

function daysSince(dateStr: string): number {
    try {
        const date = new Date(dateStr);
        const now = new Date();
        return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    } catch {
        return 365; // Default to 1 year if invalid
    }
}

// ============================================
// RECOMMENDED ACTION
// ============================================

export function determineAction(
    score: OpportunityScore,
    contactData: {
        hasVerifiedContact?: boolean;
        bestContactName?: string;
        bestContactRole?: string;
    }
): RecommendedAction {
    const reasons: string[] = [];

    if (score.need >= 25) reasons.push('High need identified');
    if (score.ability >= 20) reasons.push('Strong financial indicators');
    if (score.confidence >= 15) reasons.push('Verified contact available');

    // Score 70+: Ready to compose
    if (score.total >= 70 && contactData.hasVerifiedContact) {
        return {
            type: 'compose',
            label: `Compose to ${contactData.bestContactRole || contactData.bestContactName || 'Contact'}`,
            target: contactData.bestContactName,
            reason: reasons.length > 0 ? reasons : ['High opportunity score'],
        };
    }

    // Score 50-69: Add to pipeline
    if (score.total >= 50) {
        if (!contactData.hasVerifiedContact) {
            return {
                type: 'needs_contact',
                label: 'Needs contact verification',
                reason: ['Good opportunity but no verified contact'],
            };
        }

        return {
            type: 'add_pipeline',
            label: 'Add to pipeline',
            reason: reasons.length > 0 ? reasons : ['Moderate opportunity'],
        };
    }

    // Score <50: Needs review
    return {
        type: 'needs_review',
        label: 'Needs review',
        reason: ['Low opportunity score - manual review recommended'],
    };
}

// ============================================
// CREATE EMPTY JOB
// ============================================

export function createJob(
    prospectId: string,
    companyName: string,
    domain: string
): LeadConversionJob {
    const emptyStep: StepResult = { status: 'pending' };

    return {
        id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        prospectId,
        companyName,
        domain,
        status: 'queued',
        steps: {
            website_match: { ...emptyStep },
            financial_review: { ...emptyStep },
            discovery: { ...emptyStep },
            verification: { ...emptyStep },
            scoring: { ...emptyStep },
        },
        startedAt: new Date().toISOString(),
    };
}

export function updateStep(
    job: LeadConversionJob,
    step: PipelineStep,
    update: Partial<StepResult>
): LeadConversionJob {
    return {
        ...job,
        steps: {
            ...job.steps,
            [step]: {
                ...job.steps[step],
                ...update,
            },
        },
    };
}

export function completeJob(
    job: LeadConversionJob,
    score: OpportunityScore,
    action: RecommendedAction
): LeadConversionJob {
    return {
        ...job,
        status: 'done',
        opportunityScore: score,
        recommendedAction: action,
        finishedAt: new Date().toISOString(),
    };
}

export function failJob(job: LeadConversionJob, error: string): LeadConversionJob {
    return {
        ...job,
        status: 'failed',
        error,
        finishedAt: new Date().toISOString(),
    };
}
