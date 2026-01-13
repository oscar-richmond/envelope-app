/**
 * Email Pattern Inference Service
 * 
 * Detects email patterns from verified/manual contacts
 * and generates suggested emails for name-only contacts
 */

// Supported email patterns
export const SUPPORTED_PATTERNS = [
    'first',           // john@domain.com
    'first.last',      // john.doe@domain.com
    'f.last',          // j.doe@domain.com
    'flast',           // jdoe@domain.com
    'firstl',          // johnd@domain.com
    'first_last',      // john_doe@domain.com
    'firstlast',       // johndoe@domain.com
    'last.first',      // doe.john@domain.com
    'last',            // doe@domain.com
    'f_last',          // j_doe@domain.com
] as const;

export type PatternKey = typeof SUPPORTED_PATTERNS[number];

// Free email providers to ignore
const FREE_EMAIL_PROVIDERS = [
    'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk',
    'hotmail.com', 'hotmail.co.uk', 'outlook.com', 'live.com',
    'aol.com', 'icloud.com', 'me.com', 'mail.com', 'protonmail.com',
    'gmx.com', 'zoho.com', 'yandex.com', 'msn.com'
];

export interface EmailPattern {
    patternKey: PatternKey;
    domain: string;
    confidence: number;
    evidenceCount: number;
    evidenceEmails: string[];
    isPrimary: boolean;
}

export interface SuggestedEmail {
    email: string;
    confidence: number;
    patternKey: PatternKey;
    generated: boolean;
}

export interface PatternInferenceResult {
    success: boolean;
    domain: string | null;
    patterns: EmailPattern[];
    primaryPattern: EmailPattern | null;
    evidenceCount: number;
}

/**
 * Normalize a name for pattern matching
 */
function normalizeName(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^a-z]/g, ''); // Remove non-letters
}

/**
 * Extract domain from email
 */
function extractDomain(email: string): string | null {
    const parts = email.toLowerCase().trim().split('@');
    if (parts.length !== 2) return null;
    return parts[1];
}

/**
 * Check if domain is a free email provider
 */
function isFreeEmailProvider(domain: string): boolean {
    return FREE_EMAIL_PROVIDERS.includes(domain.toLowerCase());
}

/**
 * Try to match email against a pattern given first/last name
 */
function matchesPattern(
    localPart: string,
    firstName: string,
    lastName: string,
    pattern: PatternKey
): boolean {
    const first = normalizeName(firstName);
    const last = normalizeName(lastName);
    const local = localPart.toLowerCase().replace(/[^a-z0-9._-]/g, '');

    if (!first) return false;

    switch (pattern) {
        case 'first':
            return local === first;
        case 'first.last':
            return local === `${first}.${last}`;
        case 'f.last':
            return local === `${first[0]}.${last}`;
        case 'flast':
            return local === `${first[0]}${last}`;
        case 'firstl':
            return local === `${first}${last[0] || ''}`;
        case 'first_last':
            return local === `${first}_${last}`;
        case 'firstlast':
            return local === `${first}${last}`;
        case 'last.first':
            return local === `${last}.${first}`;
        case 'last':
            return local === last;
        case 'f_last':
            return local === `${first[0]}_${last}`;
        default:
            return false;
    }
}

/**
 * Generate email using pattern
 */
export function generateEmailFromPattern(
    firstName: string,
    lastName: string,
    domain: string,
    pattern: PatternKey
): string | null {
    const first = normalizeName(firstName);
    const last = normalizeName(lastName);

    if (!first) return null;

    let local: string;

    switch (pattern) {
        case 'first':
            local = first;
            break;
        case 'first.last':
            if (!last) return null;
            local = `${first}.${last}`;
            break;
        case 'f.last':
            if (!last) return null;
            local = `${first[0]}.${last}`;
            break;
        case 'flast':
            if (!last) return null;
            local = `${first[0]}${last}`;
            break;
        case 'firstl':
            if (!last) return null;
            local = `${first}${last[0]}`;
            break;
        case 'first_last':
            if (!last) return null;
            local = `${first}_${last}`;
            break;
        case 'firstlast':
            if (!last) return null;
            local = `${first}${last}`;
            break;
        case 'last.first':
            if (!last) return null;
            local = `${last}.${first}`;
            break;
        case 'last':
            if (!last) return null;
            local = last;
            break;
        case 'f_last':
            if (!last) return null;
            local = `${first[0]}_${last}`;
            break;
        default:
            return null;
    }

    return `${local}@${domain}`;
}

/**
 * Check if pattern requires last name
 */
export function patternRequiresLastName(pattern: PatternKey): boolean {
    return pattern !== 'first';
}

/**
 * Infer email pattern from contacts
 */
export function inferEmailPattern(
    contacts: Array<{
        email: string;
        firstName?: string;
        lastName?: string;
        fullName?: string;
        source?: string;
        verified?: boolean;
        confidence?: number;
    }>,
    preferredDomain?: string
): PatternInferenceResult {
    // Filter to contacts with email that can be used as evidence
    const evidence = contacts.filter(c => {
        if (!c.email) return false;
        const domain = extractDomain(c.email);
        if (!domain || isFreeEmailProvider(domain)) return false;

        // Must have name data
        const hasName = c.firstName || c.fullName;
        if (!hasName) return false;

        // Prefer manual or verified
        if (c.source === 'manual' || c.verified || (c.confidence ?? 0) >= 0.8) {
            return true;
        }
        return false;
    });

    if (evidence.length === 0) {
        return {
            success: false,
            domain: null,
            patterns: [],
            primaryPattern: null,
            evidenceCount: 0
        };
    }

    // Determine primary domain
    const domainCounts: Record<string, number> = {};
    for (const c of evidence) {
        const domain = extractDomain(c.email)!;
        domainCounts[domain] = (domainCounts[domain] || 0) + 1;
    }

    // Use preferred domain if provided and has evidence
    let primaryDomain = preferredDomain;
    if (!primaryDomain || !domainCounts[primaryDomain]) {
        // Use most common domain
        primaryDomain = Object.entries(domainCounts)
            .sort((a, b) => b[1] - a[1])[0][0];
    }

    // Filter evidence to primary domain only
    const domainEvidence = evidence.filter(c =>
        extractDomain(c.email) === primaryDomain
    );

    // Try to match each pattern
    const patternScores: Record<PatternKey, { matches: number; emails: string[] }> = {} as any;

    for (const pattern of SUPPORTED_PATTERNS) {
        patternScores[pattern] = { matches: 0, emails: [] };
    }

    for (const c of domainEvidence) {
        const localPart = c.email.split('@')[0];

        // Parse name
        let firstName = c.firstName || '';
        let lastName = c.lastName || '';

        if (!firstName && c.fullName) {
            const parts = c.fullName.trim().split(/\s+/);
            firstName = parts[0] || '';
            lastName = parts.slice(1).join(' ') || '';
        }

        for (const pattern of SUPPORTED_PATTERNS) {
            if (matchesPattern(localPart, firstName, lastName, pattern)) {
                patternScores[pattern].matches++;
                patternScores[pattern].emails.push(c.email);
            }
        }
    }

    // Build pattern results
    const patterns: EmailPattern[] = Object.entries(patternScores)
        .filter(([_, data]) => data.matches > 0)
        .map(([patternKey, data]) => ({
            patternKey: patternKey as PatternKey,
            domain: primaryDomain,
            confidence: Math.min(0.95, data.matches / domainEvidence.length),
            evidenceCount: data.matches,
            evidenceEmails: data.emails,
            isPrimary: false
        }))
        .sort((a, b) => b.confidence - a.confidence);

    // Mark primary
    if (patterns.length > 0) {
        patterns[0].isPrimary = true;

        // Adjust confidence based on evidence count
        if (domainEvidence.length === 1) {
            patterns[0].confidence = Math.min(patterns[0].confidence, 0.55);
        }
    }

    return {
        success: patterns.length > 0,
        domain: primaryDomain,
        patterns,
        primaryPattern: patterns[0] || null,
        evidenceCount: domainEvidence.length
    };
}

/**
 * Generate suggested emails for contacts missing email
 */
export function generateSuggestedEmails(
    contacts: Array<{
        id?: string;
        email?: string;
        firstName?: string;
        lastName?: string;
        fullName?: string;
    }>,
    pattern: EmailPattern
): Array<{
    contactId: string;
    suggestedEmails: SuggestedEmail[];
}> {
    const results: Array<{
        contactId: string;
        suggestedEmails: SuggestedEmail[];
    }> = [];

    for (const contact of contacts) {
        // Skip if already has email
        if (contact.email) continue;

        // Parse name
        let firstName = contact.firstName || '';
        let lastName = contact.lastName || '';

        if (!firstName && contact.fullName) {
            const parts = contact.fullName.trim().split(/\s+/);
            firstName = parts[0] || '';
            lastName = parts.slice(1).join(' ') || '';
        }

        if (!firstName) continue;

        // Name completeness factor
        const nameFactor = lastName ? 1.0 : 0.7;

        // Check if pattern can work with available name data
        if (patternRequiresLastName(pattern.patternKey) && !lastName) {
            // Try first-only pattern instead
            const email = generateEmailFromPattern(firstName, lastName, pattern.domain, 'first');
            if (email) {
                results.push({
                    contactId: contact.id || '',
                    suggestedEmails: [{
                        email,
                        confidence: pattern.confidence * nameFactor * 0.6, // Lower confidence for fallback
                        patternKey: 'first',
                        generated: true
                    }]
                });
            }
            continue;
        }

        // Generate email using pattern
        const email = generateEmailFromPattern(firstName, lastName, pattern.domain, pattern.patternKey);
        if (email) {
            results.push({
                contactId: contact.id || '',
                suggestedEmails: [{
                    email,
                    confidence: pattern.confidence * nameFactor,
                    patternKey: pattern.patternKey,
                    generated: true
                }]
            });
        }
    }

    return results;
}
