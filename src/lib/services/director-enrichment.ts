/**
 * Director Email Enrichment Service
 * Generates and verifies emails for Companies House directors
 */

import { fetchOfficers, selectDecisionMakers, CompanyOfficer, isCompaniesHouseEnabled } from './companies-house';
import { hunterDomainSearch } from './hunter-domain-search';
import { verifyEmail } from './email-verification';

// ============================================
// TYPES
// ============================================

export interface EnrichedDirector {
    name: string;
    fullName: string;
    firstName: string;
    lastName: string;
    role: string;
    appointedOn: string | null;
    isActive: boolean;
    email: string | null;
    emailStatus: 'verified' | 'risky' | 'inferred' | 'invalid' | 'none';
    verification?: {
        status: 'valid' | 'invalid' | 'risky' | 'unknown';
        reason?: string;
        isCatchAll: boolean;
        verifiedAt: string;
    };
    candidateEmails?: string[];
}

export interface DirectorEnrichmentResult {
    directors: EnrichedDirector[];
    pattern: string | null;
    companyNumber: string;
    companyName: string;
    domain: string;
    stats: {
        directorsFound: number;
        emailsGenerated: number;
        emailsVerified: number;
        validEmails: number;
    };
}

export interface DirectorEnrichmentOptions {
    verifyCount?: number;
    inferPattern?: boolean;
    useHunter?: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const EMAIL_PATTERNS = [
    '{first}.{last}',      // john.smith@
    '{first}',             // john@
    '{f}.{last}',          // j.smith@
    '{first}{last}',       // johnsmith@
    '{f}{last}',           // jsmith@
    '{first}_{last}',      // john_smith@
    '{first}{l}',          // johns@
    '{last}.{first}',      // smith.john@
];

const ROLE_PRIORITY: Record<string, number> = {
    'managing director': 1,
    'chief executive officer': 1,
    'ceo': 1,
    'founder': 1,
    'director': 2,
    'finance director': 2,
    'sales director': 2,
    'marketing director': 2,
    'non-executive director': 3,
    'company secretary': 4,
    'secretary': 4,
};

// ============================================
// PATTERN HELPERS
// ============================================

function generateEmailFromPattern(
    firstName: string,
    lastName: string,
    pattern: string,
    domain: string
): string {
    const first = firstName.toLowerCase().replace(/[^a-z]/g, '');
    const last = lastName.toLowerCase().replace(/[^a-z]/g, '');

    if (!first || !last) return '';

    const local = pattern
        .replace(/{first}/g, first)
        .replace(/{last}/g, last)
        .replace(/{f}/g, first[0])
        .replace(/{l}/g, last[0]);

    return `${local}@${domain}`;
}

function inferPatternFromEmails(emails: { email: string; firstName?: string; lastName?: string }[]): string | null {
    // Try to find consistent pattern from existing emails
    const patternVotes: Record<string, number> = {};

    for (const { email, firstName, lastName } of emails) {
        if (!firstName || !lastName) continue;

        const [local, domain] = email.split('@');
        if (!local || !domain) continue;

        const first = firstName.toLowerCase();
        const last = lastName.toLowerCase();

        // Check which patterns match
        for (const pattern of EMAIL_PATTERNS) {
            const expected = pattern
                .replace(/{first}/g, first)
                .replace(/{last}/g, last)
                .replace(/{f}/g, first[0])
                .replace(/{l}/g, last[0]);

            if (local === expected) {
                patternVotes[pattern] = (patternVotes[pattern] || 0) + 1;
            }
        }
    }

    // Return most voted pattern
    const sorted = Object.entries(patternVotes).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] || null;
}

// ============================================
// MAIN SERVICE
// ============================================

export async function enrichDirectorsWithEmails(
    companyNumber: string,
    domain: string,
    options: DirectorEnrichmentOptions = {}
): Promise<DirectorEnrichmentResult | null> {
    const {
        verifyCount = 3,
        inferPattern = true,
        useHunter = true,
    } = options;

    console.log(`[DirectorEnrichment] Starting for ${companyNumber}, domain: ${domain}`);

    // 1. Fetch officers from Companies House
    if (!isCompaniesHouseEnabled()) {
        console.log('[DirectorEnrichment] Companies House API not configured');
        return null;
    }

    const officersResult = await fetchOfficers(companyNumber);
    if (!officersResult) {
        console.log('[DirectorEnrichment] Failed to fetch officers');
        return null;
    }

    // 2. Select decision makers
    const decisionMakers = selectDecisionMakers(officersResult.officers, 10);
    console.log(`[DirectorEnrichment] Found ${decisionMakers.length} decision makers`);

    // 3. Get pattern
    let pattern: string | null = null;
    let hunterEmails: { email: string; firstName?: string; lastName?: string }[] = [];

    if (useHunter) {
        try {
            const hunterResult = await hunterDomainSearch(domain, { maxResults: 20 });
            pattern = hunterResult.pattern;
            hunterEmails = hunterResult.emails.map(e => ({
                email: e.email,
                firstName: e.firstName || undefined,
                lastName: e.lastName || undefined,
            }));
            console.log(`[DirectorEnrichment] Hunter pattern: ${pattern}`);
        } catch (err) {
            console.log('[DirectorEnrichment] Hunter search unavailable');
        }
    }

    // 4. Infer pattern if not found
    if (!pattern && inferPattern && hunterEmails.length > 0) {
        pattern = inferPatternFromEmails(hunterEmails);
        console.log(`[DirectorEnrichment] Inferred pattern: ${pattern}`);
    }

    // 5. Generate candidate emails for each director
    const enrichedDirectors: EnrichedDirector[] = [];
    let emailsGenerated = 0;

    for (const officer of decisionMakers) {
        const enriched: EnrichedDirector = {
            name: officer.name,
            fullName: officer.fullName,
            firstName: officer.firstName,
            lastName: officer.lastName,
            role: officer.role,
            appointedOn: officer.appointedOn,
            isActive: officer.isActive,
            email: null,
            emailStatus: 'none',
            candidateEmails: [],
        };

        // Check if Hunter already has this person's email
        const hunterMatch = hunterEmails.find(
            e => e.firstName?.toLowerCase() === officer.firstName.toLowerCase() &&
                e.lastName?.toLowerCase() === officer.lastName.toLowerCase()
        );

        if (hunterMatch) {
            enriched.email = hunterMatch.email;
            enriched.emailStatus = 'verified';
            enriched.candidateEmails = [hunterMatch.email];
        } else if (pattern) {
            // Generate email from pattern
            const email = generateEmailFromPattern(
                officer.firstName,
                officer.lastName,
                pattern,
                domain
            );

            if (email) {
                enriched.candidateEmails = [email];
                enriched.email = email;
                enriched.emailStatus = 'inferred';
                emailsGenerated++;
            }
        } else {
            // Try multiple patterns
            const candidates: string[] = [];
            for (const p of EMAIL_PATTERNS.slice(0, 3)) {
                const email = generateEmailFromPattern(
                    officer.firstName,
                    officer.lastName,
                    p,
                    domain
                );
                if (email) candidates.push(email);
            }
            enriched.candidateEmails = candidates;
            if (candidates.length > 0) {
                enriched.email = candidates[0];
                enriched.emailStatus = 'inferred';
                emailsGenerated++;
            }
        }

        enrichedDirectors.push(enriched);
    }

    // 6. Verify top N inferred emails
    let emailsVerified = 0;
    let validEmails = 0;

    const toVerify = enrichedDirectors
        .filter(d => d.emailStatus === 'inferred' && d.email)
        .slice(0, verifyCount);

    for (const director of toVerify) {
        if (!director.email) continue;

        try {
            const result = await verifyEmail(director.email);
            emailsVerified++;

            director.verification = {
                status: result.status as any,
                reason: result.reason,
                isCatchAll: result.isCatchAll || false,
                verifiedAt: new Date().toISOString(),
            };

            if (result.status === 'valid') {
                director.emailStatus = 'verified';
                validEmails++;
            } else if (result.status === 'invalid') {
                director.emailStatus = 'invalid';
                // Try next candidate if available
                if (director.candidateEmails && director.candidateEmails.length > 1) {
                    const nextEmail = director.candidateEmails[1];
                    const nextResult = await verifyEmail(nextEmail);
                    if (nextResult.status === 'valid') {
                        director.email = nextEmail;
                        director.emailStatus = 'verified';
                        director.verification = {
                            status: 'valid',
                            reason: nextResult.reason,
                            isCatchAll: nextResult.isCatchAll || false,
                            verifiedAt: new Date().toISOString(),
                        };
                        validEmails++;
                    }
                }
            } else {
                director.emailStatus = 'risky';
            }
        } catch (err) {
            console.log(`[DirectorEnrichment] Verification failed for ${director.email}`);
        }
    }

    // 7. Sort by role priority
    enrichedDirectors.sort((a, b) => {
        const aPriority = ROLE_PRIORITY[a.role.toLowerCase()] || 10;
        const bPriority = ROLE_PRIORITY[b.role.toLowerCase()] || 10;

        // Prioritize verified emails
        if (a.emailStatus === 'verified' && b.emailStatus !== 'verified') return -1;
        if (b.emailStatus === 'verified' && a.emailStatus !== 'verified') return 1;

        return aPriority - bPriority;
    });

    console.log(`[DirectorEnrichment] Complete: ${enrichedDirectors.length} directors, ${validEmails} verified emails`);

    return {
        directors: enrichedDirectors,
        pattern: pattern ? `${pattern}@${domain}` : null,
        companyNumber,
        companyName: officersResult.companyName,
        domain,
        stats: {
            directorsFound: decisionMakers.length,
            emailsGenerated,
            emailsVerified,
            validEmails,
        },
    };
}
