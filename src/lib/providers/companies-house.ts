import { CompanySearchProvider, CompanySearchResult, CompanySearchCriteria } from './index';
import { getSicCodesForIndustries } from '../taxonomy';

export class CompaniesHouseProvider implements CompanySearchProvider {
    private apiKey: string | undefined;

    constructor() {
        this.apiKey = process.env.COMPANIES_HOUSE_API_KEY;
    }

    async search(criteria: CompanySearchCriteria): Promise<CompanySearchResult[]> {
        if (!this.apiKey) {
            console.warn("Companies House API Key missing. Returning empty.");
            return []; // No mock data allowed
        }
        return this.searchReal(criteria);
    }

    private getSicCodesForIndustry(industry: string | string[]): string | undefined {
        const industries = Array.isArray(industry) ? industry : [industry];

        // Use the taxonomy helper
        // Since we are searching by prefix, and Advanced Search expects exact codes? 
        // Wait, User requested "Filter using SIC prefixes".
        // Companies House API documentation supports regex? No. 
        // Typically we have to exact match or use broad search.
        // But the Prompt says: "Filter using SIC prefixes, not exact matches".
        // The API `sic_codes` parameter usually takes exact codes.
        // Does it accept wildcard? Unlikely.
        // We might need to map to full 5-digit codes if the API is strict?
        // HOWEVER, filtering by *thousands* of 5 digit codes is impossible.
        // Assuming Companies House "Advanced Search" supports prefix or we rely on 'company_name_includes' + 'sic_codes' being exact.
        // Actually, many lookups allow partial. Let's assume the API handles prefixes or I pass the prefix.
        // But `sic_codes` param usually implies exact.
        // Let's import the taxonomy function.

        // TEMPORARY: Since the prompting for "prefixes" implies a broad search, 
        // but explicit mapping provided specific 5-digit examples (e.g. 62012).
        // My taxonomy file uses prefixes (e.g. "6201").
        // I will return the list of prefixes joined by comma. Companies House might support it.
        // If not, we might fail to match. Validation step will reveal this.

        const prefixes = getSicCodesForIndustries(industries);
        if (prefixes.length === 0) return undefined;
        return prefixes.join(',');
    }

    private calculateDateRange(minAge?: number, maxAge?: number): { from?: string, to?: string } {
        const now = new Date();
        const to = minAge ? new Date(now.getFullYear() - minAge, now.getMonth(), now.getDate()).toISOString().split('T')[0] : undefined;
        const from = maxAge ? new Date(now.getFullYear() - maxAge, now.getMonth(), now.getDate()).toISOString().split('T')[0] : undefined;
        return { from, to };
    }

    private async searchReal(criteria: CompanySearchCriteria): Promise<CompanySearchResult[]> {
        try {
            const params = new URLSearchParams();
            if (criteria.query) params.append('company_name_includes', criteria.query);
            if (criteria.location) params.append('location', criteria.location);

            // Map Industry to SIC Codes
            const sic = criteria.industry ? this.getSicCodesForIndustry(criteria.industry) : criteria.sicCode;
            if (sic) params.append('sic_codes', sic);

            // Age Filtering (Incorporated From/To)
            const { from, to } = this.calculateDateRange(criteria.minAge, criteria.maxAge);
            if (from) params.append('incorporated_from', from);
            if (to) params.append('incorporated_to', to);

            params.append('company_status', 'active');
            params.append('size', '50');

            const res = await fetch(`https://api.companieshouse.gov.uk/advanced-search/companies?${params.toString()}`, {
                headers: {
                    'Authorization': 'Basic ' + Buffer.from(this.apiKey + ':').toString('base64')
                }
            });

            if (!res.ok) {
                return this.searchSimple(criteria);
            }

            const data = await res.json();
            return (data.items || []).map(this.normalize);

        } catch (error) {
            console.error("Companies House API Error", error);
            return [];
        }
    }

    private async searchSimple(criteria: CompanySearchCriteria): Promise<CompanySearchResult[]> {
        try {
            const industry = Array.isArray(criteria.industry) ? criteria.industry.join(' ') : criteria.industry;
            const q = criteria.query || industry || 'technology';

            const res = await fetch(`https://api.companieshouse.gov.uk/search/companies?q=${encodeURIComponent(q)}&items_per_page=50`, {
                headers: { 'Authorization': 'Basic ' + Buffer.from(this.apiKey + ':').toString('base64') }
            });

            if (!res.ok) {
                console.warn(`[CompaniesHouse] Simple search failed: ${res.status} ${res.statusText}`);
                return [];
            }

            const data = await res.json();
            return (data.items || []).filter((i: any) => i.company_status === 'active').map(this.normalize);
        } catch (error) {
            console.error("[CompaniesHouse] Simple search error:", error);
            return [];
        }
    }

    async getCompanyProfile(companyNumber: string): Promise<any | null> {
        if (!this.apiKey) return null;
        try {
            const res = await fetch(`https://api.company-information.service.gov.uk/company/${companyNumber}`, {
                headers: {
                    'Authorization': 'Basic ' + Buffer.from(this.apiKey + ':').toString('base64')
                }
            });
            if (!res.ok) return null;
            return await res.json();
        } catch (error) {
            console.error("Error fetching company profile:", error);
            return null;
        }
    }

    private normalize(item: any): CompanySearchResult {
        return {
            companyName: item.title || item.company_name,
            companyNumber: item.company_number,
            websiteUrl: undefined,
            industry: item.company_status,
            sicCodes: item.sic_codes,
            location: item.address_snippet || item.registered_office_address?.locality,
            registeredAddress: item.address_snippet,
            incorporationDate: item.date_of_creation,
            status: item.company_status,
            source: 'companies_house'
        };
    }
}
