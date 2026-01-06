
import prisma from '@/lib/prisma';
import { CompanyProspect } from '@prisma/client';

const PLACES_API_BASE = 'https://places.googleapis.com/v1';
const CACHE_DURATION_DAYS = 7;

interface PlacesDetailsResponse {
    displayName?: { text: string; languageCode: string };
    primaryType?: string;
    types?: string[];
    formattedAddress?: string;
    location?: { latitude: number; longitude: number };
    websiteUri?: string;
    nationalPhoneNumber?: string;
    internationalPhoneNumber?: string;
    googleMapsUri?: string;
    regularOpeningHours?: {
        openNow?: boolean;
        weekdayDescriptions?: string[];
    };
    businessStatus?: string;
    rating?: number;
    userRatingCount?: number;
    priceLevel?: string;
}

export class PlacesDetailsService {
    private apiKey: string;

    constructor() {
        this.apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    }

    /**
     * Check if we should refresh Places data
     */
    shouldRefresh(prospect: CompanyProspect): boolean {
        if (!prospect.placeId) return false;
        if (!prospect.placesDetailsFetchedAt) return true;

        const daysSinceFetch = (Date.now() - prospect.placesDetailsFetchedAt.getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceFetch > CACHE_DURATION_DAYS;
    }

    /**
     * Fetch Places details and update prospect
     */
    async fetchAndUpdate(prospectId: number, forceRefresh = false): Promise<CompanyProspect | null> {
        const prospect = await prisma.companyProspect.findUnique({ where: { id: prospectId } });
        if (!prospect) return null;

        // Check if we need to refresh
        if (!forceRefresh && !this.shouldRefresh(prospect)) {
            return prospect; // Return cached data
        }

        if (!prospect.placeId) {
            console.log(`No placeId for prospect ${prospectId}`);
            return prospect;
        }

        try {
            const details = await this.fetchDetails(prospect.placeId);
            if (!details) return prospect;

            // Map to our schema
            const updateData = this.mapToSchema(details);

            // Update prospect
            const updated = await prisma.companyProspect.update({
                where: { id: prospectId },
                data: {
                    ...updateData,
                    placesDetailsRawJson: JSON.stringify(details),
                    placesDetailsFetchedAt: new Date()
                }
            });

            return updated;
        } catch (error) {
            console.error(`Failed to fetch Places details for ${prospectId}:`, error);
            return prospect;
        }
    }

    /**
     * Fetch details from Google Places API
     */
    private async fetchDetails(placeId: string): Promise<PlacesDetailsResponse | null> {
        if (!this.apiKey) {
            console.warn('Missing GOOGLE_MAPS_API_KEY');
            return null;
        }

        // The placeId from search is the resource name like "places/ChIJ..."
        // We need to use it directly or extract the ID
        const resourceName = placeId.startsWith('places/') ? placeId : `places/${placeId}`;

        const fieldMask = [
            'displayName',
            'primaryType',
            'types',
            'formattedAddress',
            'location',
            'websiteUri',
            'nationalPhoneNumber',
            'internationalPhoneNumber',
            'googleMapsUri',
            'regularOpeningHours',
            'businessStatus',
            'rating',
            'userRatingCount',
            'priceLevel'
        ].join(',');

        try {
            const response = await fetch(`${PLACES_API_BASE}/${resourceName}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': this.apiKey,
                    'X-Goog-FieldMask': fieldMask
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Places API error: ${response.status} ${errorText}`);
                return null;
            }

            return await response.json();
        } catch (error) {
            console.error('Places API fetch error:', error);
            return null;
        }
    }

    /**
     * Map Places API response to our schema fields
     */
    private mapToSchema(details: PlacesDetailsResponse): Partial<CompanyProspect> {
        const priceLevelMap: Record<string, number> = {
            'PRICE_LEVEL_FREE': 0,
            'PRICE_LEVEL_INEXPENSIVE': 1,
            'PRICE_LEVEL_MODERATE': 2,
            'PRICE_LEVEL_EXPENSIVE': 3,
            'PRICE_LEVEL_VERY_EXPENSIVE': 4
        };

        return {
            placesDisplayName: details.displayName?.text || null,
            placesCategory: details.primaryType || null,
            placesSecondaryCategories: details.types ? JSON.stringify(details.types) : null,
            placesFormattedAddress: details.formattedAddress || null,
            placesPhoneE164: details.internationalPhoneNumber || details.nationalPhoneNumber || null,
            placesMapsUrl: details.googleMapsUri || null,
            placesLat: details.location?.latitude || null,
            placesLng: details.location?.longitude || null,
            placesBusinessStatus: details.businessStatus || null,
            placesOpeningHours: details.regularOpeningHours ? JSON.stringify(details.regularOpeningHours) : null,
            placesPriceLevel: details.priceLevel ? priceLevelMap[details.priceLevel] ?? null : null,
            placesRating: details.rating || null,
            placesReviewCount: details.userRatingCount || null
        };
    }

    /**
     * Resolve the canonical display brand name
     */
    resolveDisplayName(prospect: CompanyProspect): { name: string; source: string } {
        // Priority order
        if (prospect.brandNameOverride?.trim()) {
            return { name: prospect.brandNameOverride.trim(), source: 'brandOverride' };
        }
        if (prospect.websiteBrandName?.trim()) {
            return { name: prospect.websiteBrandName.trim(), source: 'websiteBrand' };
        }
        if (prospect.placesDisplayName?.trim()) {
            return { name: prospect.placesDisplayName.trim(), source: 'places' };
        }
        if (prospect.websiteDomain?.trim()) {
            const domain = prospect.websiteDomain.replace(/^www\./, '');
            const clean = domain.split('.')[0];
            return { name: clean.charAt(0).toUpperCase() + clean.slice(1), source: 'domain' };
        }
        // Clean legal name fallback
        let name = prospect.companyName || 'Company';
        name = name.replace(/\s*\(?(trading|t\/a)\)?.*$/i, '');
        name = name.replace(/\s+(ltd|limited|llp|plc|inc|corp|corporation|holdings|group)\.?$/i, '');
        name = name.replace(/[.,]+$/, '').trim();
        return { name: name || 'Company', source: 'legal' };
    }

    /**
     * Update display name on prospect
     */
    async updateDisplayName(prospectId: number): Promise<void> {
        const prospect = await prisma.companyProspect.findUnique({ where: { id: prospectId } });
        if (!prospect) return;

        const resolved = this.resolveDisplayName(prospect);

        await prisma.companyProspect.update({
            where: { id: prospectId },
            data: {
                displayBrandName: resolved.name,
                displayBrandNameSource: resolved.source
            }
        });
    }
}

export const placesDetailsService = new PlacesDetailsService();
