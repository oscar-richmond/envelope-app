/**
 * Phase 4: Email Suggestion Service
 * Generate suggested emails for directors based on verified patterns
 */

import { CompanyOfficer } from './companies-house';

// ============================================
// TYPES
// ============================================

export interface EmailPattern {
    type: 'first.last' | 'first' | 'f.last' | 'firstlast' | 'f_last' | 'last' | 'unknown';
    confidence: 'verified' | 'likely' | 'weak';
    evidenceCount: number;
    evidenceEmails: string[];
    domain: string;
}

export interface SuggestedContact {
    officerId: string;
    name: string;
    firstName: string;
    lastName: string;
    role: string;
    emailSuggested: string;
    patternType: string;
    confidence: 'verified' | 'likely' | 'weak';
    verificationStatus: 'pending' | 'valid' | 'invalid' | 'unknown';
    source: 'companies_house';
}

export interface SuggestionResult {
    suggestedContacts: SuggestedContact[];
    pattern: EmailPattern | null;
    canSuggest: boolean;
    reason?: string;
}

// ============================================
// PATTERN DETECTION (from found emails)
// ============================================

export function detectPattern(foundEmails: Array<{ email: string; name?: string | null }>, domain: string): EmailPattern | null {
    // Filter to person emails with names
    const personEmails = foundEmails.filter(e => {
        const [local] = e.email.split('@');
        // Exclude generic prefixes
        const genericPrefixes = ['info', 'contact', 'hello', 'support', 'sales', 'hr', 'admin'];
        return e.name && !genericPrefixes.includes(local.toLowerCase());
    });

    if (personEmails.length === 0) {
        return null;
    }

    // Count pattern matches
    const patternCounts: Record<string, { count: number; emails: string[] }> = {};

    for (const { email, name } of personEmails) {
        if (!name) continue;

        const pattern = inferPatternFromEmail(email, name, domain);
        if (pattern) {
            if (!patternCounts[pattern]) {
                patternCounts[pattern] = { count: 0, emails: [] };
            }
            patternCounts[pattern].count++;
            patternCounts[pattern].emails.push(email);
        }
    }

    // Find best pattern
    let bestPattern: string | null = null;
    let bestCount = 0;
    let bestEmails: string[] = [];

    for (const [pattern, data] of Object.entries(patternCounts)) {
        if (data.count > bestCount) {
            bestPattern = pattern;
            bestCount = data.count;
            bestEmails = data.emails;
        }
    }

    if (!bestPattern) return null;

    const confidence: 'verified' | 'likely' | 'weak' =
        bestCount >= 2 ? 'verified' :
            bestCount === 1 ? 'likely' : 'weak';

    return {
        type: bestPattern as EmailPattern['type'],
        confidence,
        evidenceCount: bestCount,
        evidenceEmails: bestEmails.slice(0, 5),
        domain
    };
}

function inferPatternFromEmail(email: string, name: string, domain: string): string | null {
    const [local] = email.split('@');
    const nameParts = name.toLowerCase().trim().split(/\s+/);

    if (nameParts.length < 1) return null;

    const first = nameParts[0];
    const last = nameParts[nameParts.length - 1] || first;
    const fInitial = first[0];

    const localLower = local.toLowerCase();

    if (localLower === `${first}.${last}`) return 'first.last';
    if (localLower === first) return 'first';
    if (localLower === `${fInitial}.${last}`) return 'f.last';
    if (localLower === `${fInitial}${last}`) return 'f.last';
    if (localLower === `${first}${last}`) return 'firstlast';
    if (localLower === `${first}_${last}`) return 'f_last';
    if (localLower === last) return 'last';

    return null;
}

// ============================================
// EMAIL GENERATION
// ============================================

function generateEmailFromPattern(
    firstName: string,
    lastName: string,
    patternType: string,
    domain: string
): string {
    const first = firstName.toLowerCase().replace(/[^a-z]/g, '');
    const last = lastName.toLowerCase().replace(/[^a-z]/g, '');
    const fInitial = first[0] || '';

    switch (patternType) {
        case 'first.last':
            return `${first}.${last}@${domain}`;
        case 'first':
            return `${first}@${domain}`;
        case 'f.last':
            return `${fInitial}.${last}@${domain}`;
        case 'firstlast':
            return `${first}${last}@${domain}`;
        case 'f_last':
            return `${first}_${last}@${domain}`;
        case 'last':
            return `${last}@${domain}`;
        default:
            return `${first}.${last}@${domain}`;
    }
}

// ============================================
// GENERATE SUGGESTIONS
// ============================================

export function generateSuggestions(
    officers: CompanyOfficer[],
    pattern: EmailPattern | null,
    domain: string,
    maxCount = 4
): SuggestionResult {
    // Only generate if we have a verified or likely pattern
    if (!pattern) {
        return {
            suggestedContacts: [],
            pattern: null,
            canSuggest: false,
            reason: 'No email pattern detected for this domain'
        };
    }

    if (pattern.confidence === 'weak') {
        return {
            suggestedContacts: [],
            pattern,
            canSuggest: false,
            reason: 'Pattern confidence too low (need 2+ verified emails)'
        };
    }

    // Filter to active officers
    const activeOfficers = officers.filter(o => o.isActive);

    if (activeOfficers.length === 0) {
        return {
            suggestedContacts: [],
            pattern,
            canSuggest: false,
            reason: 'No active officers found'
        };
    }

    // Generate suggestions
    const suggestions: SuggestedContact[] = [];

    for (const officer of activeOfficers.slice(0, maxCount)) {
        const emailSuggested = generateEmailFromPattern(
            officer.firstName,
            officer.lastName,
            pattern.type,
            domain
        );

        // Skip if missing valid name parts
        if (!officer.firstName || !officer.lastName || emailSuggested.startsWith('.')) {
            continue;
        }

        suggestions.push({
            officerId: `ch_${officer.firstName}_${officer.lastName}`.toLowerCase().replace(/\s/g, '_'),
            name: officer.fullName,
            firstName: officer.firstName,
            lastName: officer.lastName,
            role: officer.role,
            emailSuggested,
            patternType: pattern.type,
            confidence: pattern.confidence,
            verificationStatus: 'pending',
            source: 'companies_house'
        });
    }

    return {
        suggestedContacts: suggestions,
        pattern,
        canSuggest: true
    };
}

// ============================================
// EMAIL VERIFICATION (Hunter or MX)
// ============================================

export interface VerificationResult {
    email: string;
    status: 'valid' | 'invalid' | 'risky' | 'unknown';
    provider: string;
    checkedAt: string;
    details?: string;
}

export async function verifyEmail(email: string): Promise<VerificationResult> {
    const hunterKey = process.env.HUNTER_API_KEY;

    // Try Hunter first
    if (hunterKey) {
        try {
            const params = new URLSearchParams({
                email,
                api_key: hunterKey
            });

            const response = await fetch(`https://api.hunter.io/v2/email-verifier?${params}`, {
                signal: AbortSignal.timeout(10000)
            });

            if (response.ok) {
                const data = await response.json();
                const result = data.data?.result || 'unknown';

                return {
                    email,
                    status: result === 'deliverable' ? 'valid' :
                        result === 'undeliverable' ? 'invalid' :
                            result === 'risky' ? 'risky' : 'unknown',
                    provider: 'hunter',
                    checkedAt: new Date().toISOString(),
                    details: data.data?.score ? `Score: ${data.data.score}` : undefined
                };
            }
        } catch (err: any) {
            console.log('[EmailVerify] Hunter error:', err.message);
        }
    }

    // Fallback: MX check
    try {
        const [, domainPart] = email.split('@');

        // Use DNS-over-HTTPS to check MX
        const response = await fetch(`https://dns.google/resolve?name=${domainPart}&type=MX`, {
            signal: AbortSignal.timeout(5000)
        });

        if (response.ok) {
            const data = await response.json();
            const hasMx = data.Answer && data.Answer.length > 0;

            return {
                email,
                status: hasMx ? 'unknown' : 'invalid',
                provider: 'mx_check',
                checkedAt: new Date().toISOString(),
                details: hasMx ? `Domain has MX records` : 'No MX records found'
            };
        }
    } catch { }

    return {
        email,
        status: 'unknown',
        provider: 'none',
        checkedAt: new Date().toISOString()
    };
}
