
export interface MatchResult {
    url: string | null;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    evidence?: any;
}

export class GooglePlacesWebsiteMatcher {
    private apiKey: string;

    constructor() {
        this.apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    }

    async match(companyName: string, location: string, industry?: string): Promise<MatchResult> {
        if (!this.apiKey) {
            console.warn("Missing GOOGLE_MAPS_API_KEY");
            return { url: null, confidence: 'LOW', evidence: { error: 'Missing API Key' } };
        }

        const query = `${companyName} ${location || ''}`.trim();

        try {
            // Using Text Search (New) or Old? Let's use old reliable Text Search (Place Search)
            // https://maps.googleapis.com/maps/api/place/textsearch/json
            const url = `https://places.googleapis.com/v1/places:searchText`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': this.apiKey,
                    'X-Goog-FieldMask': 'places.displayName,places.websiteUri,places.formattedAddress,places.businessStatus'
                },
                body: JSON.stringify({
                    textQuery: query,
                    maxResultCount: 1
                })
            });

            if (!response.ok) {
                const err = await response.text();
                throw new Error(`Google Places API Error: ${response.status} ${err}`);
            }

            const data = await response.json();
            const place = data.places?.[0];

            if (!place || !place.websiteUri) {
                return {
                    url: null,
                    confidence: 'LOW',
                    evidence: {
                        query,
                        found: !!place,
                        reason: 'No website listed in Places'
                    }
                };
            }

            // Simple Confidence Logic
            // If name matches reasonably well, High.
            // If name is very different, Medium.
            // For now, if Google returns it as top result for exact name query, we treat as HIGH/MEDIUM.

            return {
                url: place.websiteUri,
                confidence: 'HIGH', // Optimistic for MVP
                evidence: {
                    source: 'google_places_v1',
                    placeId: place.name, // resource name
                    matchedName: place.displayName?.text,
                    address: place.formattedAddress
                }
            };

        } catch (error: any) {
            console.error("Google Places Match Error", error);
            return {
                url: null,
                confidence: 'LOW',
                evidence: { error: error.message }
            };
        }
    }
}
