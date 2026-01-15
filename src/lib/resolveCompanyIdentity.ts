import prisma from '@/lib/prisma';

/**
 * Normalize a domain string by removing protocol, www, and trailing slashes.
 * Example: "https://www.example.com/" -> "example.com"
 */
export function normalizeDomain(urlOrDomain: string | null | undefined): string | null {
    if (!urlOrDomain) return null;

    let domain = urlOrDomain.toLowerCase().trim();

    // Remove protocol
    domain = domain.replace(/^https?:\/\//, '');

    // Remove www.
    domain = domain.replace(/^www\./, '');

    // Remove trailing slashes and paths
    domain = domain.split('/')[0];

    // Remove port
    domain = domain.split(':')[0];

    // Remove query strings
    domain = domain.split('?')[0];

    return domain || null;
}

/**
 * Normalize a website URL to canonical form.
 * Example: "example.com" -> "https://example.com"
 */
export function normalizeWebsiteUrl(url: string | null | undefined): string | null {
    if (!url) return null;

    let normalized = url.trim();

    // Add protocol if missing
    if (!normalized.match(/^https?:\/\//)) {
        normalized = 'https://' + normalized;
    }

    // Remove trailing slash
    normalized = normalized.replace(/\/+$/, '');

    return normalized || null;
}

/**
 * Resolves company identity from various inputs.
 * 
 * Resolution priority:
 * 1. companyId → direct lookup
 * 2. companyNumber → lookup by Companies House number
 * 3. domain → lookup by websiteDomain field
 * 4. websiteUrl → normalize to domain, then lookup
 * 5. If nothing found + createIfMissing → create shadow record
 * 
 * @param opts.companyId - Internal CompanyProspect ID
 * @param opts.companyNumber - Companies House registration number
 * @param opts.domain - Website domain (e.g., "example.com")
 * @param opts.websiteUrl - Full website URL (will be normalized to domain)
 * @param opts.companyName - Company name for creating shadow records
 * @param opts.createIfMissing - If true, creates a shadow record if no match
 * @param opts.sourceContext - Context for logging (e.g., "leadboard", "search")
 * @returns { companyId, companyNumber, domain, websiteUrl } or null
 */
export async function resolveCompanyIdentity(opts: {
    companyId?: number | null;
    companyNumber?: string | null;
    domain?: string | null;
    websiteUrl?: string | null;
    companyName?: string | null;
    createIfMissing?: boolean;
    sourceContext?: string;
}): Promise<{
    companyId: number;
    companyNumber: string | null;
    domain: string | null;
    websiteUrl: string | null;
} | null> {
    const {
        companyId,
        companyNumber,
        domain: inputDomain,
        websiteUrl: inputUrl,
        companyName,
        createIfMissing = false,
        sourceContext = 'unknown'
    } = opts;

    console.log(`[resolveCompanyIdentity] Resolving from ${sourceContext}:`, {
        companyId,
        companyNumber,
        domain: inputDomain,
        websiteUrl: inputUrl
    });

    // 1. If companyId provided, look it up
    if (companyId && !isNaN(companyId)) {
        const company = await prisma.companyProspect.findUnique({
            where: { id: companyId },
            select: {
                id: true,
                companyNumber: true,
                websiteDomain: true,
                websiteUrl: true
            }
        });

        if (company) {
            console.log(`[resolveCompanyIdentity] Resolved by companyId: ${company.id}`);
            return {
                companyId: company.id,
                companyNumber: company.companyNumber,
                domain: company.websiteDomain || normalizeDomain(company.websiteUrl),
                websiteUrl: company.websiteUrl
            };
        }
    }

    // 2. If companyNumber provided, resolve to companyId
    if (companyNumber) {
        const company = await prisma.companyProspect.findFirst({
            where: { companyNumber },
            select: {
                id: true,
                companyNumber: true,
                websiteDomain: true,
                websiteUrl: true
            }
        });

        if (company) {
            console.log(`[resolveCompanyIdentity] Resolved by companyNumber: ${company.id}`);
            return {
                companyId: company.id,
                companyNumber: company.companyNumber,
                domain: company.websiteDomain || normalizeDomain(company.websiteUrl),
                websiteUrl: company.websiteUrl
            };
        }
    }

    // 3. If domain provided, lookup by websiteDomain
    const normalizedDomain = normalizeDomain(inputDomain) || normalizeDomain(inputUrl);
    if (normalizedDomain) {
        const company = await prisma.companyProspect.findFirst({
            where: {
                OR: [
                    { websiteDomain: normalizedDomain },
                    { websiteDomain: `www.${normalizedDomain}` },
                    { websiteUrl: { contains: normalizedDomain } }
                ]
            },
            select: {
                id: true,
                companyNumber: true,
                websiteDomain: true,
                websiteUrl: true
            }
        });

        if (company) {
            console.log(`[resolveCompanyIdentity] Resolved by domain: ${company.id}`);
            return {
                companyId: company.id,
                companyNumber: company.companyNumber,
                domain: company.websiteDomain || normalizedDomain,
                websiteUrl: company.websiteUrl
            };
        }
    }

    // 4. Optionally create a shadow record
    if (createIfMissing && (normalizedDomain || companyNumber || companyName)) {
        console.log(`[resolveCompanyIdentity] Creating shadow record for: ${companyName || normalizedDomain || companyNumber}`);

        const newCompany = await prisma.companyProspect.create({
            data: {
                companyNumber: companyNumber || null,
                companyName: companyName || normalizedDomain || `Company ${companyNumber}`,
                websiteDomain: normalizedDomain,
                websiteUrl: normalizeWebsiteUrl(inputUrl) || (normalizedDomain ? `https://${normalizedDomain}` : null),
                source: 'RESOLVER'
            },
            select: {
                id: true,
                companyNumber: true,
                websiteDomain: true,
                websiteUrl: true
            }
        });

        console.log(`[resolveCompanyIdentity] Created shadow record: ${newCompany.id}`);
        return {
            companyId: newCompany.id,
            companyNumber: newCompany.companyNumber,
            domain: newCompany.websiteDomain,
            websiteUrl: newCompany.websiteUrl
        };
    }

    // Resolution failed
    console.warn(`[resolveCompanyIdentity] Failed to resolve from ${sourceContext}:`, {
        companyId,
        companyNumber,
        domain: normalizedDomain
    });
    return null;
}

/**
 * Attempts resolution and returns structured error if failed.
 * Use this in API routes for consistent error handling.
 */
export async function resolveCompanyIdentityOrError(opts: {
    companyId?: number | null;
    companyNumber?: string | null;
    domain?: string | null;
    websiteUrl?: string | null;
    sourceContext?: string;
}): Promise<
    | { success: true; companyId: number; companyNumber: string | null; domain: string | null; websiteUrl: string | null }
    | { success: false; error: string; errorCode: string; hint: string }
> {
    const result = await resolveCompanyIdentity(opts);

    if (!result) {
        return {
            success: false,
            error: 'Company resolution failed',
            errorCode: 'COMPANY_RESOLUTION_FAILED',
            hint: 'Please rescan the company profile or ensure the company exists in the system'
        };
    }

    return {
        success: true,
        companyId: result.companyId,
        companyNumber: result.companyNumber,
        domain: result.domain,
        websiteUrl: result.websiteUrl
    };
}
