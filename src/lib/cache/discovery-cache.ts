/**
 * Domain Results Caching
 * Cache email discovery results for 24h
 */

// In-memory cache (for serverless, use Redis/KV in production)
const cache = new Map<string, CacheEntry>();

interface CacheEntry {
    data: CachedDiscoveryResult;
    expiresAt: number;
}

export interface CachedDiscoveryResult {
    emails: Array<{
        email: string;
        name: string | null;
        role: string | null;
        confidence: string;
        sources: Array<{ url: string; title: string; type: string }>;
        isGeneric: boolean;
    }>;
    patterns: Array<{
        pattern: string;
        verified: boolean;
        matches: number;
    }>;
    stats: {
        pagesCrawled: number;
        publicResultsFetched: number;
        pdfsParsed: number;
    };
    cachedAt: string;
}

// ============================================
// CACHE CONFIG
// ============================================

const DOMAIN_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CH_OFFICERS_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const PATTERN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ============================================
// CACHE OPERATIONS
// ============================================

function getCacheKey(domain: string, type: string = 'discovery'): string {
    return `${type}:${domain.toLowerCase()}`;
}

export function getCached(domain: string, type: string = 'discovery'): CachedDiscoveryResult | null {
    const key = getCacheKey(domain, type);
    const entry = cache.get(key);

    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
        cache.delete(key);
        return null;
    }

    return entry.data;
}

export function setCache(domain: string, data: CachedDiscoveryResult, type: string = 'discovery'): void {
    const key = getCacheKey(domain, type);
    const ttl = type === 'officers' ? CH_OFFICERS_TTL_MS :
        type === 'pattern' ? PATTERN_TTL_MS : DOMAIN_CACHE_TTL_MS;

    cache.set(key, {
        data,
        expiresAt: Date.now() + ttl,
    });
}

export function isCached(domain: string, type: string = 'discovery'): boolean {
    return getCached(domain, type) !== null;
}

export function clearCache(domain?: string): void {
    if (domain) {
        const patterns = ['discovery', 'officers', 'pattern'];
        patterns.forEach(type => cache.delete(getCacheKey(domain, type)));
    } else {
        cache.clear();
    }
}

export function getCacheStats(): { size: number; entries: string[] } {
    return {
        size: cache.size,
        entries: Array.from(cache.keys()),
    };
}

// ============================================
// CACHE WRAPPER
// ============================================

export async function withCache<T>(
    domain: string,
    type: string,
    fetcher: () => Promise<T>
): Promise<{ data: T; fromCache: boolean }> {
    const cached = getCached(domain, type);

    if (cached) {
        console.log(`[Cache] HIT: ${type}:${domain}`);
        return { data: cached as T, fromCache: true };
    }

    console.log(`[Cache] MISS: ${type}:${domain}`);
    const data = await fetcher();

    // Only cache successful results
    if (data && typeof data === 'object') {
        setCache(domain, { ...(data as object), cachedAt: new Date().toISOString() } as CachedDiscoveryResult, type);
    }

    return { data, fromCache: false };
}
