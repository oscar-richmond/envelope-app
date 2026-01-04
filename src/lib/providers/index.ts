// --- Interfaces ---

export interface CompanySearchResult {
    companyName: string;
    companyNumber?: string; // Companies House ID
    websiteUrl?: string;    // Optional now
    industry?: string;
    sicCodes?: string[];
    location?: string;
    registeredAddress?: string;
    sizeBand?: string;
    incorporationDate?: string;
    status?: string;
    source: string;
}

export interface ContactResult {
    firstName: string;
    lastName: string;
    title: string;
    email: string | null;
    confidence: number;
    roleCategory: 'DECISION_MAKER' | 'MARKETING' | 'OTHER';
    source: string;
}

export interface CompanySearchCriteria {
    query?: string; // Free text
    industry?: string | string[]; // High-level industry name (e.g. "Construction") or array
    sicCode?: string; // Comma separated codes
    status?: string;
    location?: string;
    size?: string;
    minAge?: number; // Years
    maxAge?: number; // Years
}

export interface CompanySearchProvider {
    search(criteria: CompanySearchCriteria): Promise<CompanySearchResult[]>;
}

export interface ContactDiscoveryProvider {
    find(domain: string): Promise<ContactResult[]>;
}

// --- Real Implementations only ---
import { CompaniesHouseProvider } from './companies-house';

export const companySearchProvider = new CompaniesHouseProvider();

// Placeholder for Contact Discovery (Phase 4)
// We use a strict empty provider until implemented
class EmptyContactDiscovery implements ContactDiscoveryProvider {
    async find(domain: string): Promise<ContactResult[]> {
        return [];
    }
}
export const contactDiscoveryProvider = new EmptyContactDiscovery();

// --- Website Matcher (Phase 3) ---
import { GooglePlacesWebsiteMatcher } from '../services/google-places';
export const websiteMatcher = new GooglePlacesWebsiteMatcher();

// --- Website Analysis ---
import { WebsiteAnalysisService } from '../services/website-analysis';
export const websiteAnalysisService = new WebsiteAnalysisService();
