
export interface WebsiteMatchResult {
    url: string | null;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    evidence: {
        placeId?: string;
        placeName?: string;
        formattedAddress?: string;
        matchSignals?: string[];
        types?: string[];
        failureReason?: string;
        candidates?: any[];
        bestScore?: number;
        query?: string;
        error?: string;
        requestPayload?: string;
    };
}

export interface WebsiteMatcher {
    match(companyName: string, location: string, industry?: string): Promise<WebsiteMatchResult>;
}

export class GooglePlacesWebsiteMatcher implements WebsiteMatcher {
    private apiKey: string | undefined;

    constructor() {
        this.apiKey = process.env.GOOGLE_MAPS_API_KEY;
    }

    async match(companyName: string, location: string, industry?: string): Promise<WebsiteMatchResult> {
        if (!this.apiKey) {
            console.warn("GOOGLE_MAPS_API_KEY missing");
            return { url: null, confidence: 'LOW', evidence: { matchSignals: ['API_KEY_MISSING'] } };
        }

        const evidence: any = {
            query: '',
            candidates: [],
            bestScore: 0,
            requestPayload: '',
            failureReason: null
        };

        try {
            // 1. Text Search (New) - Fetch multiple candidates
            const query = `${this.cleanName(companyName)} ${location}`;
            evidence.query = query;

            // Correctly defined payload outside of fetch options
            const requestBody = {
                textQuery: query,
                maxResultCount: 5,
                regionCode: 'GB' // Bias to UK results
            };

            evidence.requestPayload = JSON.stringify(requestBody);

            const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': this.apiKey,
                    // Critical: Ensure websiteUri is requested
                    'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.websiteUri,places.types,places.location'
                },
                body: JSON.stringify(requestBody)
            });

            if (!res.ok) {
                const errorText = await res.text();
                evidence.failureReason = 'API_ERROR';
                evidence.error = `Status: ${res.status} | Body: ${errorText}`;
                return { url: null, confidence: 'LOW', evidence };
            }

            const data = await res.json();
            const places = data.places || [];

            if (places.length === 0) {
                evidence.failureReason = 'NO_CANDIDATES';
                return { url: null, confidence: 'LOW', evidence };
            }

            // 2. Score All Candidates
            let bestMatch: any = null;
            let bestScore = -1;

            for (const place of places) {
                const scoreData = this.scoreCandidate(place, companyName, location);
                evidence.candidates.push({
                    placeId: place.id,
                    name: place.displayName?.text,
                    address: place.formattedAddress,
                    website: place.websiteUri,
                    score: scoreData.score,
                    signals: scoreData.signals
                });

                if (scoreData.score > bestScore) {
                    bestScore = scoreData.score;
                    bestMatch = { place, ...scoreData };
                }
            }

            evidence.bestScore = bestScore;

            if (!bestMatch || bestScore < 30) {
                evidence.failureReason = 'LOW_CONFIDENCE';
                return { url: null, confidence: 'LOW', evidence };
            }

            // 3. Final Decision
            const { place, signals } = bestMatch;
            const website = place.websiteUri;

            // Handle "Found but no website"
            if (!website) {
                evidence.failureReason = 'NO_WEBSITE_FIELD';
                // Return MEDIUM confidence but null URL -> Needs Review
                return {
                    url: null,
                    confidence: bestScore >= 50 ? 'MEDIUM' : 'LOW',
                    evidence
                };
            }

            // Validate URL
            if (this.isDirectoryOrSocial(website)) {
                evidence.failureReason = 'WEBSITE_REJECTED_DIRECTORY';
                return { url: null, confidence: 'LOW', evidence };
            }

            let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
            if (bestScore >= 50) confidence = 'MEDIUM';
            if (bestScore >= 80) confidence = 'HIGH';

            return {
                url: website,
                confidence,
                evidence
            };

        } catch (error: any) {
            console.error("Website Match Error", error);
            evidence.failureReason = 'EXCEPTION';
            evidence.error = error.message;
            return { url: null, confidence: 'LOW', evidence };
        }
    }

    private cleanName(name: string): string {
        return name
            .replace(/\b(limited|ltd|plc|llp|holdings|group)\b/ig, '')
            .replace(/[^\w\s]/g, '')
            .trim();
    }

    private scoreCandidate(place: any, targetName: string, targetLocation: string): { score: number, signals: string[] } {
        let score = 0;
        const signals: string[] = [];

        const placeName = (place.displayName?.text || '').toLowerCase();
        const cleanPlaceName = this.cleanName(placeName);
        const cleanTargetName = this.cleanName(targetName).toLowerCase();
        const address = (place.formattedAddress || '').toLowerCase();
        const cleanLocation = targetLocation.split(',')[0].trim().toLowerCase();

        // 1. Exact/Substring Match
        if (cleanPlaceName === cleanTargetName) {
            score += 60;
            signals.push('EXACT_NAME');
        } else if (cleanPlaceName.includes(cleanTargetName) || cleanTargetName.includes(cleanPlaceName)) {
            score += 40;
            signals.push('PARTIAL_NAME');
        } else {
            // 2. Token Overlap Match (Fuzzy)
            // e.g. "Dragons Head Shop" vs "Dragon Vape" -> "Dragon" overlaps
            const targetTokens = cleanTargetName.split(/\s+/).filter(t => t.length > 2);
            const placeTokens = cleanPlaceName.split(/\s+/).filter(t => t.length > 2);

            let matchCount = 0;
            for (const t of targetTokens) {
                // Check if token matches start of any place token (e.g. Dragon matches Dragons)
                if (placeTokens.some(p => p.includes(t) || t.includes(p))) {
                    matchCount++;
                }
            }

            if (targetTokens.length > 0 && matchCount > 0) {
                const overlapRatio = matchCount / targetTokens.length;
                if (overlapRatio >= 0.5) {
                    score += 30; // Medium match
                    signals.push('TOKEN_MATCH_HIGH');
                } else {
                    score += 15; // Weak match
                    signals.push('TOKEN_MATCH_LOW');
                }
            } else {
                score -= 10; // Penalty for no name similarity
            }
        }

        // 3. Address Analysis
        if (address.includes(cleanLocation)) {
            score += 30;
            signals.push('LOCATION_MATCH');
        }

        // 4. Boost for having a website (if needed, but score is mostly about identity)
        // If we found a website, it's a stronger candidate for "Lead Gen" purpose
        // but not necessarily correct. Keeping score focused on identity is safer.

        return { score, signals };
    }

    private isDirectoryOrSocial(url: string): boolean {
        const lower = url.toLowerCase();
        return lower.includes('facebook') ||
            lower.includes('instagram') ||
            lower.includes('linkedin') ||
            lower.includes('yell.com') ||
            lower.includes('yelp') ||
            lower.includes('tripadvisor') ||
            lower.includes('checkatrade');
    }
}
