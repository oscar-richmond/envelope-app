/**
 * Display Name Resolver
 * 
 * Single source of truth for resolving company display names.
 * Priority: brandNameOverride > websiteBrandName > displayBrandName > placesDisplayName > domain > companyName
 */

export interface DisplayNameResult {
    displayName: string;
    legalName: string;
    secondaryName?: string;
    source: 'manual_override' | 'website_brand' | 'display_brand' | 'places' | 'domain' | 'legal';
    confidence: number;
}

export interface CompanyLike {
    companyName: string;
    brandNameOverride?: string | null;
    websiteBrandName?: string | null;
    websiteBrandNameSource?: string | null;
    websiteBrandNameConfidence?: string | null;
    displayBrandName?: string | null;
    displayBrandNameSource?: string | null;
    placesDisplayName?: string | null;
    websiteDomain?: string | null;
    websiteUrl?: string | null;
}

/**
 * Clean a company name by removing common legal suffixes
 */
export function cleanLegalName(name: string): string {
    if (!name) return '';

    // Remove common suffixes (case insensitive)
    const suffixes = [
        /\s+(LIMITED|LTD|LLP|PLC|INC|LLC|CORP|CORPORATION|CO\.?|COMPANY)\.?$/i,
        /\s*\([^)]+\)$/,  // Remove parenthetical additions
    ];

    let cleaned = name;
    for (const suffix of suffixes) {
        cleaned = cleaned.replace(suffix, '');
    }

    // Convert ALL CAPS to Title Case
    if (cleaned === cleaned.toUpperCase() && cleaned.length > 3) {
        cleaned = cleaned
            .toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    return cleaned.trim();
}

/**
 * Extract a brand name guess from a domain
 */
export function brandFromDomain(domain: string | null | undefined): string | null {
    if (!domain) return null;

    try {
        // Remove protocol and path
        let host = domain.replace(/^https?:\/\//, '').split('/')[0];

        // Remove www and common TLDs
        host = host.replace(/^www\./, '');
        const tlds = ['.com', '.co.uk', '.uk', '.org', '.io', '.net', '.co'];
        for (const tld of tlds) {
            if (host.endsWith(tld)) {
                host = host.slice(0, -tld.length);
            }
        }

        // Replace hyphens with spaces and title case
        const name = host
            .replace(/-/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');

        return name.length > 1 ? name : null;
    } catch {
        return null;
    }
}

/**
 * Get confidence score from source type
 */
function getConfidence(source: string | null | undefined, confidenceStr?: string | null): number {
    if (source === 'manual_override' || source === 'manual') return 100;

    if (confidenceStr) {
        if (confidenceStr === 'HIGH') return 90;
        if (confidenceStr === 'MEDIUM') return 70;
        if (confidenceStr === 'LOW') return 50;
    }

    switch (source) {
        case 'og_site_name': return 90;
        case 'title': return 75;
        case 'h1': return 70;
        case 'logo_alt': return 65;
        case 'domain_fallback': return 50;
        case 'places': return 80;
        default: return 30;
    }
}

/**
 * Main resolver function - use this everywhere!
 */
export function getCompanyDisplayName(company: CompanyLike | null | undefined): DisplayNameResult {
    if (!company) {
        return {
            displayName: 'Unknown Company',
            legalName: 'Unknown',
            source: 'legal',
            confidence: 0
        };
    }

    const legalName = company.companyName || 'Unknown';
    const cleanedLegal = cleanLegalName(legalName);

    // Priority 1: Manual override
    if (company.brandNameOverride) {
        return {
            displayName: company.brandNameOverride,
            legalName,
            secondaryName: legalName !== company.brandNameOverride ? legalName : undefined,
            source: 'manual_override',
            confidence: 100
        };
    }

    // Priority 2: Website-extracted brand name
    if (company.websiteBrandName) {
        return {
            displayName: company.websiteBrandName,
            legalName,
            secondaryName: legalName !== company.websiteBrandName ? legalName : undefined,
            source: 'website_brand',
            confidence: getConfidence(company.websiteBrandNameSource, company.websiteBrandNameConfidence)
        };
    }

    // Priority 3: Pre-resolved display brand name
    if (company.displayBrandName) {
        return {
            displayName: company.displayBrandName,
            legalName,
            secondaryName: legalName !== company.displayBrandName ? legalName : undefined,
            source: 'display_brand',
            confidence: getConfidence(company.displayBrandNameSource)
        };
    }

    // Priority 4: Google Places display name
    if (company.placesDisplayName) {
        return {
            displayName: company.placesDisplayName,
            legalName,
            secondaryName: legalName !== company.placesDisplayName ? legalName : undefined,
            source: 'places',
            confidence: 80
        };
    }

    // Priority 5: Domain-derived name
    const domainName = brandFromDomain(company.websiteDomain || company.websiteUrl);
    if (domainName && domainName.toLowerCase() !== cleanedLegal.toLowerCase()) {
        return {
            displayName: domainName,
            legalName,
            secondaryName: legalName,
            source: 'domain',
            confidence: 50
        };
    }

    // Fallback: Cleaned legal name
    return {
        displayName: cleanedLegal || legalName,
        legalName,
        source: 'legal',
        confidence: 30
    };
}

/**
 * Simple helper to just get the display name string
 */
export function displayName(company: CompanyLike | null | undefined): string {
    return getCompanyDisplayName(company).displayName;
}

/**
 * Normalise a name for comparison purposes
 * Removes legal suffixes, punctuation, extra spaces, and lowercases
 */
export function normaliseForComparison(name: string): string {
    if (!name) return '';

    let normalised = name
        .toLowerCase()
        .trim()
        // Remove common legal suffixes
        .replace(/\s+(limited|ltd|llp|plc|inc|llc|corp|corporation|co\.?|company)\.?$/gi, '')
        // Remove punctuation
        .replace(/[.,'"!?;:()]/g, '')
        // Collapse multiple spaces
        .replace(/\s+/g, ' ')
        .trim();

    return normalised;
}

/**
 * Check if there's a meaningful mismatch between display name and legal name
 * Returns false if names are essentially the same after normalisation
 */
export function isMeaningfulMismatch(displayName: string | null | undefined, legalName: string | null | undefined): boolean {
    if (!displayName || !legalName) return false;

    const normDisplay = normaliseForComparison(displayName);
    const normLegal = normaliseForComparison(legalName);

    // If they're the same after normalisation, no mismatch
    if (normDisplay === normLegal) return false;

    // Check if one contains the other (partial match)
    if (normLegal.includes(normDisplay) || normDisplay.includes(normLegal)) {
        // Only meaningful if there's significant additional content
        const lengthDiff = Math.abs(normLegal.length - normDisplay.length);
        if (lengthDiff < 5) return false; // Minor difference, not meaningful
    }

    return true;
}

/**
 * Extended interface with company number for tooltip display
 */
export interface CompanyWithNumber extends CompanyLike {
    companyNumber?: string | null;
}

/**
 * Get full display info including mismatch status for tooltip
 */
export function getCompanyDisplayInfo(company: CompanyWithNumber | null | undefined): DisplayNameResult & { hasMismatch: boolean; companyNumber?: string } {
    const result = getCompanyDisplayName(company);
    const hasMismatch = isMeaningfulMismatch(result.displayName, result.legalName);

    return {
        ...result,
        hasMismatch,
        companyNumber: company?.companyNumber || undefined
    };
}
