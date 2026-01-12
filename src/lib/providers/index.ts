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
    confidence: number; // 0-100
    roleCategory: 'DECISION_MAKER' | 'MARKETING' | 'OTHER';
    source: 'website' | 'hunter' | 'places';
    verificationStatus: 'verified' | 'likely' | 'unknown';
    phone?: string;
    linkedinUrl?: string;
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
    readonly name: string;
}

// --- Real Implementations ---
import { CompaniesHouseProvider } from './companies-house';

export const companySearchProvider = new CompaniesHouseProvider();

// --- Contact Discovery Orchestrator ---
import { ContactDiscoveryOrchestrator } from './contact-orchestrator';
import { WebsiteScrapeProvider } from './website-scrape';
import { HunterProvider } from './hunter';

// Create providers
const websiteScrapeProvider = new WebsiteScrapeProvider();
const hunterProvider = new HunterProvider();

// Create orchestrator with providers in order
export const contactDiscoveryProvider = new ContactDiscoveryOrchestrator([
    websiteScrapeProvider,
    hunterProvider
]);

// --- Website Matcher (Phase 3) ---
import { GooglePlacesWebsiteMatcher } from '../services/google-places';
export const websiteMatcher = new GooglePlacesWebsiteMatcher();

// --- Website Analysis ---
import { WebsiteAnalysisService } from '../services/website-analysis';
export const websiteAnalysisService = new WebsiteAnalysisService();
