/**
 * Phase 5: Contact Scoring Model
 * Scores contacts for best recipient selection
 */

import type { VerificationResult } from './email-verification';

// ============================================
// TYPES
// ============================================

export interface ContactForScoring {
    email: string;
    name?: string | null;
    role?: string | null;
    confidence?: string;
    source?: string;
    evidence?: {
        pageType?: string;
        type?: string;
    };
    isSuggested?: boolean;
    verification?: VerificationResult | null;
}

export interface ScoredContact extends ContactForScoring {
    score: number;
    scoreBreakdown: {
        role: number;
        emailQuality: number;
        evidence: number;
    };
    isBestContact: boolean;
    deliverability: 'high' | 'medium' | 'low' | 'catch-all' | 'unknown';
}

// ============================================
// ROLE SCORING (0-40)
// ============================================

const ROLE_SCORES: Record<string, number> = {
    // Top decision makers
    'founder': 40, 'ceo': 40, 'co-founder': 40, 'managing director': 40,
    'head of marketing': 38, 'cmo': 38, 'marketing director': 38, 'head of growth': 38,
    'partnerships': 35, 'head of partnerships': 35, 'business development': 35, 'bd': 35,
    'operations': 25, 'operations manager': 25, 'coo': 25,
    'it': 20, 'cto': 20, 'tech': 20,
    'director': 22, 'manager': 18,
    'sales': 15, 'sales director': 20,
    // Generic
    'contact': 10, 'general': 10, 'info': 8,
};

function scoreRole(role: string | null | undefined): number {
    if (!role) return 8; // Unknown

    const lower = role.toLowerCase();

    // Check for exact matches first
    for (const [pattern, score] of Object.entries(ROLE_SCORES)) {
        if (lower === pattern || lower.includes(pattern)) {
            return score;
        }
    }

    return 8; // Unknown role
}

// ============================================
// EMAIL QUALITY SCORING (0-40)
// ============================================

function scoreEmailQuality(
    email: string,
    verification: VerificationResult | null | undefined,
    isSuggested: boolean
): number {
    const isRoleAccount = isGenericEmail(email);

    if (!verification) {
        // Not verified
        if (isSuggested) return 10; // Suggested, not verified
        if (isRoleAccount) return 20; // Generic but found
        return 25; // Personal but not verified
    }

    // Verified
    if (verification.status === 'valid') {
        if (isRoleAccount) return 25; // Valid role account
        return 40; // Valid personal email - best!
    }

    if (verification.status === 'risky') {
        return 8;
    }

    if (verification.status === 'invalid') {
        return 0;
    }

    // Unknown
    if (verification.isCatchAll) {
        return 12; // Catch-all, can't confirm
    }

    return 15; // Unknown status
}

function isGenericEmail(email: string): boolean {
    const generic = ['info', 'contact', 'hello', 'support', 'sales', 'marketing', 'hr', 'admin', 'team', 'hi'];
    const local = email.split('@')[0].toLowerCase();
    return generic.includes(local);
}

// ============================================
// EVIDENCE SCORING (0-20)
// ============================================

function scoreEvidence(
    confidence: string | undefined,
    evidence: { pageType?: string; type?: string } | undefined,
    isSuggested: boolean
): number {
    if (isSuggested) return 10; // Suggested from pattern

    const pageType = evidence?.pageType?.toLowerCase() || evidence?.type?.toLowerCase() || '';

    if (pageType.includes('team') || pageType.includes('leadership') || pageType.includes('about')) {
        return 20;
    }

    if (pageType.includes('contact')) {
        return 15;
    }

    if (pageType.includes('pdf')) {
        return 15;
    }

    if (pageType.includes('directory') || pageType.includes('public')) {
        return 12;
    }

    // Based on confidence
    if (confidence === 'verified' || confidence === 'high') {
        return 18;
    }

    if (confidence === 'likely' || confidence === 'medium') {
        return 12;
    }

    return 8; // Low evidence
}

// ============================================
// DELIVERABILITY CLASSIFICATION
// ============================================

function classifyDeliverability(
    verification: VerificationResult | null | undefined
): 'high' | 'medium' | 'low' | 'catch-all' | 'unknown' {
    if (!verification) return 'unknown';

    if (verification.isCatchAll) return 'catch-all';
    if (verification.status === 'valid') return 'high';
    if (verification.status === 'risky') return 'medium';
    if (verification.status === 'invalid') return 'low';

    return 'unknown';
}

// ============================================
// MAIN SCORING FUNCTION
// ============================================

export function scoreContact(contact: ContactForScoring): ScoredContact {
    const roleScore = scoreRole(contact.role);
    const emailScore = scoreEmailQuality(
        contact.email,
        contact.verification,
        contact.isSuggested || false
    );
    const evidenceScore = scoreEvidence(
        contact.confidence,
        contact.evidence,
        contact.isSuggested || false
    );

    const totalScore = roleScore + emailScore + evidenceScore;

    return {
        ...contact,
        score: totalScore,
        scoreBreakdown: {
            role: roleScore,
            emailQuality: emailScore,
            evidence: evidenceScore,
        },
        isBestContact: false, // Will be set after sorting
        deliverability: classifyDeliverability(contact.verification),
    };
}

export function scoreAndRankContacts(contacts: ContactForScoring[]): ScoredContact[] {
    // Score all contacts
    const scored = contacts.map(c => scoreContact(c));

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Mark best contact
    if (scored.length > 0) {
        scored[0].isBestContact = true;
    }

    return scored;
}

// ============================================
// BEST CONTACT SELECTION
// ============================================

export interface ContactRoutingResult {
    bestContact: ScoredContact | null;
    bestEmail: string | null;
    routingReason: string[];
    fallbackContact: ScoredContact | null;
}

export function selectBestContact(
    contacts: ContactForScoring[],
    preferSafeGeneric = false
): ContactRoutingResult {
    const scored = scoreAndRankContacts(contacts);

    if (scored.length === 0) {
        return {
            bestContact: null,
            bestEmail: null,
            routingReason: ['No contacts available'],
            fallbackContact: null,
        };
    }

    const best = scored[0];
    const reasons: string[] = [];

    // Build reason
    if (best.role) reasons.push(best.role);
    if (best.deliverability === 'high') reasons.push('Verified email');
    else if (best.deliverability === 'catch-all') reasons.push('Catch-all domain');
    if (best.scoreBreakdown.evidence >= 15) reasons.push('Found on site');

    // Check if we should prefer a safe generic
    let fallback: ScoredContact | null = null;

    if (preferSafeGeneric && best.deliverability !== 'high') {
        // Look for a verified generic email
        const safeGeneric = scored.find(c =>
            isGenericEmail(c.email) && c.deliverability === 'high'
        );

        if (safeGeneric) {
            fallback = best;
            return {
                bestContact: safeGeneric,
                bestEmail: safeGeneric.email,
                routingReason: ['Safe generic (verified)', ...reasons],
                fallbackContact: fallback,
            };
        }
    }

    return {
        bestContact: best,
        bestEmail: best.email,
        routingReason: reasons.length > 0 ? reasons : ['Top scored contact'],
        fallbackContact: scored.length > 1 ? scored[1] : null,
    };
}
