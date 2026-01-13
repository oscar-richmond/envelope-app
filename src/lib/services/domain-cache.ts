/**
 * Domain Cache Service
 * 30-day caching with learning and feedback loop
 */

// ============================================
// TYPES
// ============================================

export interface CachedContact {
    email: string;
    firstName: string | null;
    lastName: string | null;
    fullName: string | null;
    role: string | null;
    type: 'person' | 'generic';
    confidence: number;
    verificationStatus: 'valid' | 'invalid' | 'risky' | 'unknown' | 'pending';
    isCatchAll: boolean;
    sources: string[];
    score: number;
    feedbackScore: number;
    lastVerifiedAt: string | null;
    bounceCount: number;
    replyCount: number;
}

export interface DomainCacheEntry {
    domain: string;
    contacts: CachedContact[];
    pattern: string | null;
    lastScannedAt: string;
    scanVersion: number;
    expiresAt: number;
    stats: {
        hunterCount: number;
        crawlCount: number;
        verifiedCount: number;
        totalContacts: number;
    };
    providerCostEstimate: number;
}

export interface ContactFeedback {
    email: string;
    domain: string;
    event: 'bounce' | 'reply' | 'open' | 'click' | 'unsubscribe';
    timestamp: string;
}

// ============================================
// CONSTANTS
// ============================================

const DEFAULT_CACHE_TTL_DAYS = 30;
const STALE_THRESHOLD_DAYS = 7;

const FEEDBACK_ADJUSTMENTS = {
    bounce: -20,
    reply: 25,
    open: 5,
    click: 10,
    unsubscribe: -15,
};

const COST_ESTIMATES = {
    hunterPerEmail: 0.01,
    verifyPerEmail: 0.003,
    crawlPerDomain: 0,
};

// ============================================
// IN-MEMORY CACHE (Replace with DB in production)
// ============================================

const domainCache = new Map<string, DomainCacheEntry>();
const feedbackLog: ContactFeedback[] = [];

// ============================================
// CACHE OPERATIONS
// ============================================

export function getCachedDomain(domain: string): DomainCacheEntry | null {
    const key = domain.toLowerCase();
    const entry = domainCache.get(key);

    if (!entry) return null;

    // Check if expired
    if (Date.now() > entry.expiresAt) {
        console.log(`[DomainCache] Cache expired for ${domain}`);
        return null;
    }

    return entry;
}

export function setCachedDomain(
    domain: string,
    contacts: CachedContact[],
    pattern: string | null,
    stats: DomainCacheEntry['stats']
): DomainCacheEntry {
    const key = domain.toLowerCase();
    const existingEntry = domainCache.get(key);

    const entry: DomainCacheEntry = {
        domain: key,
        contacts,
        pattern,
        lastScannedAt: new Date().toISOString(),
        scanVersion: (existingEntry?.scanVersion || 0) + 1,
        expiresAt: Date.now() + (DEFAULT_CACHE_TTL_DAYS * 24 * 60 * 60 * 1000),
        stats,
        providerCostEstimate: calculateCost(stats),
    };

    domainCache.set(key, entry);
    console.log(`[DomainCache] Cached ${contacts.length} contacts for ${domain}`);

    return entry;
}

export function invalidateCache(domain: string): void {
    const key = domain.toLowerCase();
    domainCache.delete(key);
    console.log(`[DomainCache] Invalidated cache for ${domain}`);
}

export function isCacheStale(entry: DomainCacheEntry): boolean {
    const scannedAt = new Date(entry.lastScannedAt).getTime();
    const staleThreshold = STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
    return Date.now() - scannedAt > staleThreshold;
}

export function getCacheAge(entry: DomainCacheEntry): { days: number; hours: number } {
    const scannedAt = new Date(entry.lastScannedAt).getTime();
    const ageMs = Date.now() - scannedAt;
    const days = Math.floor(ageMs / (24 * 60 * 60 * 1000));
    const hours = Math.floor((ageMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    return { days, hours };
}

// ============================================
// FEEDBACK LOOP
// ============================================

export function recordFeedback(feedback: ContactFeedback): void {
    feedbackLog.push(feedback);

    const adjustment = FEEDBACK_ADJUSTMENTS[feedback.event] || 0;

    // Update cached contact if exists
    const entry = domainCache.get(feedback.domain.toLowerCase());
    if (entry) {
        const contact = entry.contacts.find(c => c.email === feedback.email);
        if (contact) {
            contact.feedbackScore += adjustment;
            contact.score += adjustment;

            if (feedback.event === 'bounce') {
                contact.bounceCount++;
                if (contact.bounceCount >= 2) {
                    contact.verificationStatus = 'invalid';
                    contact.confidence = Math.max(0, contact.confidence - 30);
                }
            } else if (feedback.event === 'reply') {
                contact.replyCount++;
                contact.verificationStatus = 'valid';
                contact.confidence = Math.min(100, contact.confidence + 15);
            }

            // Re-sort contacts by score
            entry.contacts.sort((a, b) => b.score - a.score);
        }
    }

    console.log(`[DomainCache] Recorded ${feedback.event} for ${feedback.email} (${adjustment >= 0 ? '+' : ''}${adjustment})`);
}

export function getContactFeedback(email: string): ContactFeedback[] {
    return feedbackLog.filter(f => f.email === email);
}

// ============================================
// RESCAN STRATEGY
// ============================================

export interface RescanPlan {
    shouldRescan: boolean;
    reason: string;
    staleContacts: CachedContact[];
    unverifiedContacts: CachedContact[];
    estimatedCost: number;
}

export function planRescan(entry: DomainCacheEntry): RescanPlan {
    const staleContacts = entry.contacts.filter(c => {
        if (!c.lastVerifiedAt) return true;
        const verifiedAt = new Date(c.lastVerifiedAt).getTime();
        return Date.now() - verifiedAt > (STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);
    });

    const unverifiedContacts = entry.contacts.filter(c =>
        c.verificationStatus === 'pending' || c.verificationStatus === 'unknown'
    );

    const shouldRescan = isCacheStale(entry) || unverifiedContacts.length > 3;

    // Estimate cost
    const verifyCount = Math.min(staleContacts.length + unverifiedContacts.length, 10);
    const estimatedCost = verifyCount * COST_ESTIMATES.verifyPerEmail;

    return {
        shouldRescan,
        reason: shouldRescan
            ? `Cache is ${isCacheStale(entry) ? 'stale' : 'fresh'}, ${unverifiedContacts.length} unverified contacts`
            : 'Cache is fresh and most contacts verified',
        staleContacts,
        unverifiedContacts,
        estimatedCost,
    };
}

// ============================================
// COST ESTIMATION
// ============================================

function calculateCost(stats: DomainCacheEntry['stats']): number {
    return (
        (stats.hunterCount * COST_ESTIMATES.hunterPerEmail) +
        (stats.verifiedCount * COST_ESTIMATES.verifyPerEmail) +
        COST_ESTIMATES.crawlPerDomain
    );
}

export function estimateRescanCost(domain: string, options: {
    useHunter?: boolean;
    verifyCount?: number;
}): number {
    const { useHunter = true, verifyCount = 10 } = options;

    let cost = 0;
    if (useHunter) cost += 20 * COST_ESTIMATES.hunterPerEmail; // Estimate 20 new emails
    cost += verifyCount * COST_ESTIMATES.verifyPerEmail;

    return Math.round(cost * 100) / 100; // Round to 2 decimals
}

// ============================================
// MERGE STRATEGY
// ============================================

export function mergeContacts(
    existing: CachedContact[],
    newContacts: CachedContact[]
): CachedContact[] {
    const merged = new Map<string, CachedContact>();

    // Add existing contacts
    for (const contact of existing) {
        merged.set(contact.email, contact);
    }

    // Merge new contacts
    for (const contact of newContacts) {
        const existing = merged.get(contact.email);
        if (existing) {
            // Preserve feedback and bounce counts
            contact.feedbackScore = existing.feedbackScore;
            contact.bounceCount = existing.bounceCount;
            contact.replyCount = existing.replyCount;

            // Keep better verification
            if (existing.verificationStatus === 'valid' && contact.verificationStatus === 'pending') {
                contact.verificationStatus = existing.verificationStatus;
                contact.lastVerifiedAt = existing.lastVerifiedAt;
            }

            // Combine scores
            contact.score += existing.feedbackScore;
        }
        merged.set(contact.email, contact);
    }

    return Array.from(merged.values()).sort((a, b) => b.score - a.score);
}

// ============================================
// CACHE INFO FOR UI
// ============================================

export interface CacheInfo {
    cached: boolean;
    domain: string;
    lastScannedAt: string | null;
    ageDescription: string;
    isStale: boolean;
    contactCount: number;
    verifiedCount: number;
    rescanCostEstimate: number;
}

export function getCacheInfo(domain: string): CacheInfo {
    const entry = getCachedDomain(domain);

    if (!entry) {
        return {
            cached: false,
            domain,
            lastScannedAt: null,
            ageDescription: 'Never scanned',
            isStale: true,
            contactCount: 0,
            verifiedCount: 0,
            rescanCostEstimate: estimateRescanCost(domain, {}),
        };
    }

    const { days, hours } = getCacheAge(entry);
    let ageDescription = '';
    if (days === 0 && hours === 0) {
        ageDescription = 'Just now';
    } else if (days === 0) {
        ageDescription = `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else if (days === 1) {
        ageDescription = 'Yesterday';
    } else {
        ageDescription = `${days} days ago`;
    }

    const verifiedCount = entry.contacts.filter(c => c.verificationStatus === 'valid').length;

    return {
        cached: true,
        domain,
        lastScannedAt: entry.lastScannedAt,
        ageDescription: `Last scanned ${ageDescription}`,
        isStale: isCacheStale(entry),
        contactCount: entry.contacts.length,
        verifiedCount,
        rescanCostEstimate: estimateRescanCost(domain, { verifyCount: 5 }),
    };
}
