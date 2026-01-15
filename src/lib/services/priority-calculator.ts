/**
 * Lead Opportunity / Priority Calculator
 * 
 * Single source of truth for computing lead opportunity scores.
 * Used by: Prospect Search, Lead Board, Company Profiles
 * 
 * Returns: { score, band, evidence[] }
 */

export interface Evidence {
    id: string;
    label: string;
    points: number;
    description?: string;
}

export interface LeadOpportunityResult {
    score: number;
    band: 'High' | 'Medium' | 'Low';
    evidence: Evidence[];
    breakdown: {
        needScore: number;
        abilityScore: number;
        newCompanyScore: number;
        synergyScore: number;
    };
}

export interface CompanyData {
    stalenessScore?: number | null;
    financialScore?: number | null;
    financialActivityBand?: string | null;
    websiteConfidence?: string | null;
    websiteUrl?: string | null;
    websiteMatchStatus?: string | null;
    incorporatedOn?: Date | string | null;
}

export class PriorityCalculator {
    /**
     * Calculate Lead Opportunity score with full evidence breakdown
     */
    calculate(data: CompanyData): LeadOpportunityResult {
        const evidence: Evidence[] = [];

        const stalenessScore = data.stalenessScore ?? 0;
        const financialScore = data.financialScore ?? 0;
        const conf = (data.websiteConfidence || 'LOW').toUpperCase();

        // Determine website status
        const hasWebsite = !!(data.websiteUrl && data.websiteUrl !== 'Unknown' && data.websiteUrl !== 'N/A');
        const websiteOutdated = stalenessScore >= 60;

        // Calculate days since incorporation
        let daysSinceIncorporation: number | null = null;
        if (data.incorporatedOn) {
            const incDate = new Date(data.incorporatedOn);
            if (!isNaN(incDate.getTime())) {
                daysSinceIncorporation = Math.floor((Date.now() - incDate.getTime()) / (1000 * 60 * 60 * 24));
            }
        }

        // --- 1. Need Score (0-60) ---
        let needScore = Math.min(60, stalenessScore);

        // Design Opportunity: staleness >= 40 indicates significant issues
        const designOpportunity = stalenessScore >= 40;
        if (designOpportunity) {
            needScore += 10;
            evidence.push({
                id: 'design_opportunity',
                label: `Website design opportunity (+10)`,
                points: 10,
                description: 'Staleness score indicates redesign potential'
            });
        }

        // Cap need score at 60
        needScore = Math.min(60, needScore);

        // Low confidence penalty
        if (conf === 'LOW') {
            needScore = Math.min(30, needScore);
        }

        // --- 2. Ability Score (0-30) ---
        const abilityScore = Math.round(financialScore * 0.30);

        if (data.financialActivityBand === 'Very Strong' || data.financialActivityBand === 'Strong') {
            evidence.push({
                id: 'strong_financials',
                label: `Strong financials (+${abilityScore})`,
                points: abilityScore,
                description: `Financial activity band: ${data.financialActivityBand}`
            });
        }

        // --- 3. New Company Score ---
        let newCompanyScore = 0;
        let newCompanyLabel = '';

        if (daysSinceIncorporation !== null) {
            if (daysSinceIncorporation <= 7) {
                newCompanyScore = 25;
                newCompanyLabel = 'Registered in last 7 days (+25)';
            } else if (daysSinceIncorporation <= 14) {
                newCompanyScore = 20;
                newCompanyLabel = 'Registered in last 14 days (+20)';
            } else if (daysSinceIncorporation <= 30) {
                newCompanyScore = 15;
                newCompanyLabel = 'Registered in last month (+15)';
            } else if (daysSinceIncorporation <= 60) {
                newCompanyScore = 10;
                newCompanyLabel = 'Registered in last 2 months (+10)';
            } else if (daysSinceIncorporation <= 90) {
                newCompanyScore = 8;
                newCompanyLabel = 'Registered in last 3 months (+8)';
            } else if (daysSinceIncorporation <= 120) {
                newCompanyScore = 6;
                newCompanyLabel = 'Registered in last 4 months (+6)';
            } else if (daysSinceIncorporation <= 150) {
                newCompanyScore = 4;
                newCompanyLabel = 'Registered in last 5 months (+4)';
            } else if (daysSinceIncorporation <= 180) {
                newCompanyScore = 2;
                newCompanyLabel = 'Registered in last 6 months (+2)';
            }

            if (newCompanyScore > 0) {
                evidence.push({
                    id: 'newly_registered',
                    label: newCompanyLabel,
                    points: newCompanyScore,
                    description: `Incorporated ${daysSinceIncorporation} days ago`
                });
            }
        }

        // --- 4. No Website Boost ---
        let noWebsiteScore = 0;
        if (!hasWebsite) {
            noWebsiteScore = 25;
            evidence.push({
                id: 'no_website',
                label: 'No website detected (+25)',
                points: 25,
                description: 'Company has no website - high opportunity'
            });
        } else if (websiteOutdated) {
            // Already counted in need score, but add explicit evidence
            evidence.push({
                id: 'website_outdated',
                label: 'Website likely outdated (+10)',
                points: 10,
                description: `Staleness score: ${stalenessScore}`
            });
        }

        // --- 5. Synergy Bonus: New Company + No Website ---
        let synergyScore = 0;
        if (daysSinceIncorporation !== null && daysSinceIncorporation <= 60 && !hasWebsite) {
            synergyScore = 15;
            evidence.push({
                id: 'new_no_website_synergy',
                label: 'New company + no website (high intent) (+15)',
                points: 15,
                description: 'Recently registered and needs a website'
            });
        }

        // --- Total Score ---
        let total = needScore + abilityScore + newCompanyScore + noWebsiteScore + synergyScore;
        total = Math.round(Math.min(100, Math.max(0, total)));

        // --- Bands ---
        let band: 'High' | 'Medium' | 'Low' = 'Low';
        if (total >= 60) band = 'High';
        else if (total >= 35) band = 'Medium';

        // --- Guardrail: Strong financials + opportunity = at least Medium ---
        if (financialScore >= 60 && (designOpportunity || stalenessScore >= 40 || !hasWebsite)) {
            if (band === 'Low') band = 'Medium';
        }

        return {
            score: total,
            band,
            evidence,
            breakdown: {
                needScore,
                abilityScore,
                newCompanyScore: newCompanyScore + noWebsiteScore,
                synergyScore
            }
        };
    }

    /**
     * Legacy interface for backwards compatibility
     */
    calculateLegacy(stalenessScore: number = 0, financialScore: number = 0, websiteConfidence: string = 'LOW') {
        const result = this.calculate({
            stalenessScore,
            financialScore,
            websiteConfidence
        });

        return {
            score: result.score,
            band: result.band,
            breakdown: {
                need: result.breakdown.needScore,
                ability: result.breakdown.abilityScore,
                confidence: 0
            }
        };
    }
}

export const priorityCalculator = new PriorityCalculator();
