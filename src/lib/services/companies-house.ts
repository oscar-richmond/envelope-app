/**
 * Phase 4: Companies House API Integration
 * UK company director enrichment
 */

// ============================================
// TYPES
// ============================================

export interface CompanySearchResult {
    companyNumber: string;
    companyName: string;
    companyStatus: string;
    companyType: string;
    addressSnippet: string;
    dateOfCreation?: string;
    matchScore: number;
}

export interface CompanyOfficer {
    name: string;
    fullName: string;
    firstName: string;
    lastName: string;
    role: string;
    appointedOn: string | null;
    resignedOn: string | null;
    isActive: boolean;
    nationality?: string;
    occupation?: string;
}

export interface ResolveResult {
    status: 'matched' | 'uncertain' | 'not_found' | 'error';
    companyNumber?: string;
    companyName?: string;
    candidates: CompanySearchResult[];
    message?: string;
}

export interface OfficersResult {
    officers: CompanyOfficer[];
    companyNumber: string;
    companyName: string;
    totalResults: number;
    fetchedAt: string;
}

// ============================================
// CONSTANTS
// ============================================

const CH_API_BASE = 'https://api.company-information.service.gov.uk';
const CACHE_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Role priority (lower = more important)
const ROLE_PRIORITY: Record<string, number> = {
    'managing director': 1,
    'chief executive officer': 1,
    'ceo': 1,
    'director': 2,
    'non-executive director': 3,
    'company secretary': 4,
    'secretary': 4,
};

// ============================================
// API HELPERS
// ============================================

function getApiKey(): string | null {
    return process.env.COMPANIES_HOUSE_API_KEY || null;
}

function getAuthHeader(): Record<string, string> {
    const apiKey = getApiKey();
    if (!apiKey) return {};

    // Companies House uses HTTP Basic Auth with API key as username
    const encoded = Buffer.from(`${apiKey}:`).toString('base64');
    return {
        'Authorization': `Basic ${encoded}`,
        'Accept': 'application/json'
    };
}

export function isCompaniesHouseEnabled(): boolean {
    return !!getApiKey();
}

// ============================================
// NAME PARSING
// ============================================

function parseOfficerName(rawName: string): { fullName: string; firstName: string; lastName: string } {
    // Companies House format: "SMITH, John William" or "John William SMITH"
    let fullName = rawName.trim();
    let firstName = '';
    let lastName = '';

    // Remove titles
    fullName = fullName.replace(/^(Mr|Mrs|Ms|Miss|Dr|Prof|Sir|Dame|Lord|Lady)\.?\s+/i, '');
    fullName = fullName.replace(/\s+(OBE|MBE|CBE|KBE|DBE|PhD|MD|FRCS|FCA)$/i, '');

    if (fullName.includes(',')) {
        // Format: "LASTNAME, Firstname"
        const [lastPart, firstPart] = fullName.split(',').map(s => s.trim());
        lastName = lastPart;
        firstName = firstPart.split(' ')[0]; // Take first word

        // Capitalize properly
        lastName = capitalizeWord(lastName);
        firstName = capitalizeWord(firstName);
        fullName = `${firstName} ${lastName}`;
    } else {
        // Format: "Firstname Lastname" or "FIRSTNAME LASTNAME"
        const parts = fullName.split(/\s+/);
        if (parts.length >= 2) {
            firstName = capitalizeWord(parts[0]);
            lastName = capitalizeWord(parts[parts.length - 1]);
            fullName = `${firstName} ${lastName}`;
        } else {
            firstName = capitalizeWord(parts[0]);
            lastName = firstName;
            fullName = firstName;
        }
    }

    return { fullName, firstName, lastName };
}

function capitalizeWord(word: string): string {
    if (!word) return '';
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

// ============================================
// COMPANY SEARCH
// ============================================

export async function searchCompanies(
    companyName: string,
    options?: { postcode?: string; city?: string }
): Promise<CompanySearchResult[]> {
    if (!isCompaniesHouseEnabled()) {
        console.log('[CompaniesHouse] API key not configured');
        return [];
    }

    try {
        const params = new URLSearchParams({
            q: companyName,
            items_per_page: '5'
        });

        const response = await fetch(`${CH_API_BASE}/search/companies?${params}`, {
            headers: getAuthHeader(),
            signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
            console.log(`[CompaniesHouse] Search failed: ${response.status}`);
            return [];
        }

        const data = await response.json();
        const results: CompanySearchResult[] = [];

        for (const item of data.items || []) {
            // Calculate match score
            let matchScore = 0;

            // Name similarity
            const nameLower = companyName.toLowerCase();
            const titleLower = (item.title || '').toLowerCase();
            if (titleLower === nameLower) matchScore += 50;
            else if (titleLower.includes(nameLower) || nameLower.includes(titleLower)) matchScore += 30;

            // Active company bonus
            if (item.company_status === 'active') matchScore += 20;

            // Address match
            if (options?.postcode && item.address_snippet?.includes(options.postcode)) matchScore += 15;
            if (options?.city && item.address_snippet?.toLowerCase().includes(options.city.toLowerCase())) matchScore += 10;

            results.push({
                companyNumber: item.company_number,
                companyName: item.title,
                companyStatus: item.company_status,
                companyType: item.company_type,
                addressSnippet: item.address_snippet || '',
                dateOfCreation: item.date_of_creation,
                matchScore
            });
        }

        // Sort by match score
        results.sort((a, b) => b.matchScore - a.matchScore);

        return results;

    } catch (err: any) {
        console.error('[CompaniesHouse] Search error:', err.message);
        return [];
    }
}

// ============================================
// RESOLVE COMPANY
// ============================================

export async function resolveCompany(
    companyName: string,
    options?: { postcode?: string; city?: string; companyNumber?: string }
): Promise<ResolveResult> {
    // If we already have a company number, use it
    if (options?.companyNumber) {
        return {
            status: 'matched',
            companyNumber: options.companyNumber,
            companyName,
            candidates: [],
            message: 'Using provided company number'
        };
    }

    const candidates = await searchCompanies(companyName, options);

    if (candidates.length === 0) {
        return {
            status: 'not_found',
            candidates: [],
            message: 'No matching UK company found'
        };
    }

    // Check if top match is confident
    const topMatch = candidates[0];

    if (topMatch.matchScore >= 60 && topMatch.companyStatus === 'active') {
        return {
            status: 'matched',
            companyNumber: topMatch.companyNumber,
            companyName: topMatch.companyName,
            candidates,
            message: 'High-confidence match'
        };
    }

    // Uncertain - need user selection
    return {
        status: 'uncertain',
        candidates,
        message: 'Multiple possible matches - please select'
    };
}

// ============================================
// FETCH OFFICERS
// ============================================

export async function fetchOfficers(companyNumber: string): Promise<OfficersResult | null> {
    if (!isCompaniesHouseEnabled()) {
        console.log('[CompaniesHouse] API key not configured');
        return null;
    }

    try {
        // First get company details
        const companyResponse = await fetch(`${CH_API_BASE}/company/${companyNumber}`, {
            headers: getAuthHeader(),
            signal: AbortSignal.timeout(10000)
        });

        let companyName = '';
        if (companyResponse.ok) {
            const companyData = await companyResponse.json();
            companyName = companyData.company_name || '';
        }

        // Fetch officers
        const response = await fetch(`${CH_API_BASE}/company/${companyNumber}/officers?items_per_page=50`, {
            headers: getAuthHeader(),
            signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
            console.log(`[CompaniesHouse] Officers fetch failed: ${response.status}`);
            return null;
        }

        const data = await response.json();
        const officers: CompanyOfficer[] = [];

        for (const item of data.items || []) {
            const { fullName, firstName, lastName } = parseOfficerName(item.name || '');

            const isActive = !item.resigned_on;
            const role = (item.officer_role || '').toLowerCase().replace(/_/g, ' ');

            officers.push({
                name: item.name,
                fullName,
                firstName,
                lastName,
                role: capitalizeRole(role),
                appointedOn: item.appointed_on || null,
                resignedOn: item.resigned_on || null,
                isActive,
                nationality: item.nationality,
                occupation: item.occupation
            });
        }

        // Sort by role priority, then by active status
        officers.sort((a, b) => {
            // Active first
            if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;

            // Then by role priority
            const aPriority = ROLE_PRIORITY[a.role.toLowerCase()] || 10;
            const bPriority = ROLE_PRIORITY[b.role.toLowerCase()] || 10;
            return aPriority - bPriority;
        });

        return {
            officers,
            companyNumber,
            companyName,
            totalResults: data.total_results || officers.length,
            fetchedAt: new Date().toISOString()
        };

    } catch (err: any) {
        console.error('[CompaniesHouse] Officers error:', err.message);
        return null;
    }
}

function capitalizeRole(role: string): string {
    return role.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

// ============================================
// DECISION MAKERS SELECTION
// ============================================

export function selectDecisionMakers(officers: CompanyOfficer[], maxCount = 3): CompanyOfficer[] {
    // Filter to active officers only
    const active = officers.filter(o => o.isActive);

    // Already sorted by priority in fetchOfficers
    return active.slice(0, maxCount);
}
