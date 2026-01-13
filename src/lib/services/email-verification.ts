/**
 * Phase 5: Email Verification Provider
 * Enhanced with Bouncer/ZeroBounce + catch-all detection
 */

import dns from 'dns';
import { promisify } from 'util';

const resolveMx = promisify(dns.resolveMx);

// ============================================
// TYPES
// ============================================

export interface VerificationResult {
    email: string;
    status: 'valid' | 'invalid' | 'risky' | 'unknown';
    isCatchAll: boolean;
    isRoleAccount: boolean;
    score?: number | null;
    provider: string;
    checkedAt: string;
    reason?: string;
    cached?: boolean;
}

// ============================================
// CACHE (30 days)
// ============================================

const verificationCache = new Map<string, { result: VerificationResult; expiresAt: number }>();
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function getCachedVerification(email: string): VerificationResult | null {
    const cached = verificationCache.get(email.toLowerCase());
    if (!cached) return null;
    if (Date.now() > cached.expiresAt) {
        verificationCache.delete(email.toLowerCase());
        return null;
    }
    return { ...cached.result, cached: true };
}

function setCachedVerification(email: string, result: VerificationResult): void {
    verificationCache.set(email.toLowerCase(), {
        result,
        expiresAt: Date.now() + CACHE_TTL_MS,
    });
}

// ============================================
// ROLE DETECTION
// ============================================

const HIGH_RISK_ROLES = ['noreply', 'do-not-reply', 'no-reply', 'bounce', 'admin', 'postmaster', 'abuse', 'webmaster'];
const ROLE_ACCOUNTS = ['support', 'billing', 'sales', 'info', 'contact', 'help', 'jobs', 'careers', 'marketing', 'press', 'media', 'hello', 'hr', 'accounts'];

function isRoleEmail(email: string): boolean {
    const local = email.split('@')[0].toLowerCase();
    return ROLE_ACCOUNTS.includes(local) || HIGH_RISK_ROLES.includes(local);
}

// ============================================
// BOUNCER PROVIDER
// ============================================

async function verifyWithBouncer(email: string): Promise<VerificationResult> {
    const apiKey = process.env.BOUNCER_API_KEY;
    if (!apiKey) throw new Error('BOUNCER_API_KEY not configured');

    const response = await fetch('https://api.usebouncer.com/v1/email/verify', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
        },
        body: JSON.stringify({ email }),
        signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
        throw new Error(`Bouncer API error: ${response.status}`);
    }

    const data = await response.json();

    let status: VerificationResult['status'] = 'unknown';
    if (data.status === 'deliverable') status = 'valid';
    else if (data.status === 'undeliverable') status = 'invalid';
    else if (data.status === 'risky') status = 'risky';

    return {
        email,
        status,
        isCatchAll: data.reason === 'accepted_email' || data.dns?.type === 'catchall',
        isRoleAccount: data.account?.role === true || isRoleEmail(email),
        score: data.score,
        provider: 'bouncer',
        checkedAt: new Date().toISOString(),
        reason: data.reason,
    };
}

// ============================================
// ZEROBOUNCE PROVIDER
// ============================================

async function verifyWithZeroBounce(email: string): Promise<VerificationResult> {
    const apiKey = process.env.ZEROBOUNCE_API_KEY;
    if (!apiKey) throw new Error('ZEROBOUNCE_API_KEY not configured');

    const params = new URLSearchParams({ api_key: apiKey, email });
    const response = await fetch(`https://api.zerobounce.net/v2/validate?${params}`, {
        signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
        throw new Error(`ZeroBounce API error: ${response.status}`);
    }

    const data = await response.json();

    let status: VerificationResult['status'] = 'unknown';
    if (data.status === 'valid') status = 'valid';
    else if (data.status === 'invalid') status = 'invalid';
    else if (data.status === 'catch-all' || data.status === 'do_not_mail') status = 'risky';

    return {
        email,
        status,
        isCatchAll: data.status === 'catch-all',
        isRoleAccount: data.sub_status === 'role_based' || isRoleEmail(email),
        score: null,
        provider: 'zerobounce',
        checkedAt: new Date().toISOString(),
        reason: data.sub_status,
    };
}

// ============================================
// HUNTER VERIFIER
// ============================================

async function verifyWithHunter(email: string): Promise<VerificationResult> {
    const apiKey = process.env.HUNTER_API_KEY;
    if (!apiKey) throw new Error('HUNTER_API_KEY not configured');

    const params = new URLSearchParams({ email, api_key: apiKey });
    const response = await fetch(`https://api.hunter.io/v2/email-verifier?${params}`, {
        signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
        throw new Error(`Hunter API error: ${response.status}`);
    }

    const data = await response.json();
    const result = data.data?.result || 'unknown';

    let status: VerificationResult['status'] = 'unknown';
    if (result === 'deliverable') status = 'valid';
    else if (result === 'undeliverable') status = 'invalid';
    else if (result === 'risky') status = 'risky';

    return {
        email,
        status,
        isCatchAll: data.data?.accept_all === true,
        isRoleAccount: data.data?.type === 'generic' || isRoleEmail(email),
        score: data.data?.score,
        provider: 'hunter',
        checkedAt: new Date().toISOString(),
    };
}

// ============================================
// MX FALLBACK
// ============================================

async function verifyWithMX(email: string): Promise<VerificationResult> {
    const domain = email.split('@')[1];

    try {
        const mxRecords = await resolveMx(domain);
        const hasMx = mxRecords && mxRecords.length > 0;

        return {
            email,
            status: hasMx ? 'unknown' : 'invalid',
            isCatchAll: false,
            isRoleAccount: isRoleEmail(email),
            provider: 'mx_check',
            checkedAt: new Date().toISOString(),
            reason: hasMx ? 'MX records found' : 'No MX records',
        };
    } catch {
        return {
            email,
            status: 'invalid',
            isCatchAll: false,
            isRoleAccount: isRoleEmail(email),
            provider: 'mx_check',
            checkedAt: new Date().toISOString(),
            reason: 'DNS lookup failed',
        };
    }
}

// ============================================
// MAIN VERIFICATION FUNCTION
// ============================================

export async function verifyEmail(email: string): Promise<VerificationResult> {
    // Check cache first
    const cached = getCachedVerification(email);
    if (cached) {
        console.log(`[Verify] Cache hit: ${email}`);
        return cached;
    }

    console.log(`[Verify] Verifying: ${email}`);

    let result: VerificationResult;
    const provider = process.env.EMAIL_VERIFY_PROVIDER || 'auto';

    try {
        if (provider === 'bouncer' || (provider === 'auto' && process.env.BOUNCER_API_KEY)) {
            result = await verifyWithBouncer(email);
        } else if (provider === 'zerobounce' || (provider === 'auto' && process.env.ZEROBOUNCE_API_KEY)) {
            result = await verifyWithZeroBounce(email);
        } else if (provider === 'hunter' || (provider === 'auto' && process.env.HUNTER_API_KEY)) {
            result = await verifyWithHunter(email);
        } else {
            result = await verifyWithMX(email);
        }
    } catch (err: any) {
        console.error(`[Verify] Error: ${err.message}`);
        result = await verifyWithMX(email);
    }

    setCachedVerification(email, result);
    return result;
}

export function getConfiguredProvider(): string {
    if (process.env.BOUNCER_API_KEY) return 'bouncer';
    if (process.env.ZEROBOUNCE_API_KEY) return 'zerobounce';
    if (process.env.HUNTER_API_KEY) return 'hunter';
    return 'mx_check';
}

// ============================================
// LEGACY EXPORTS (backward compat)
// ============================================

export interface LegacyVerificationResult {
    syntaxValid: boolean;
    mxValid: boolean;
    roleRisk: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
    sendabilityStatus: 'GOOD' | 'CAUTION' | 'HIGH_RISK';
    details: string[];
}

export class EmailVerificationService {
    private HIGH_RISK_ROLES = HIGH_RISK_ROLES;
    private MEDIUM_RISK_ROLES = ROLE_ACCOUNTS;

    async verify(email: string): Promise<LegacyVerificationResult> {
        const result = await verifyEmail(email);

        return {
            syntaxValid: result.status !== 'invalid',
            mxValid: result.status !== 'invalid',
            roleRisk: result.isRoleAccount ? 'MEDIUM' : 'NONE',
            sendabilityStatus:
                result.status === 'valid' ? 'GOOD' :
                    result.status === 'risky' ? 'CAUTION' : 'HIGH_RISK',
            details: result.reason ? [result.reason] : [],
        };
    }
}

export const emailVerifier = new EmailVerificationService();
