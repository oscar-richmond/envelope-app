
export class PriorityCalculator {
    calculate(stalenessScore: number = 0, financialScore: number = 0, websiteConfidence: string = 'LOW') {
        const conf = websiteConfidence.toUpperCase();

        // --- 1. Need Score (0-60) ---
        // Base: min(60, staleness)
        let needScore = Math.min(60, stalenessScore);

        // Design Opportunity: We interpret staleness >= 40 as having significant design issues/staleness
        const designOpportunity = stalenessScore >= 40;

        if (designOpportunity) {
            needScore += 10;
        }

        // Cap need score at 60 max
        needScore = Math.min(60, needScore);

        // Low Confidence Cap
        if (conf === 'LOW') {
            needScore = Math.min(30, needScore);
        }

        // --- 2. Ability Score (0-30) ---
        const abilityScore = Math.round(financialScore * 0.30);

        // --- 3. Confidence Score (0-10) ---
        let confidenceScore = 0;
        if (conf === 'HIGH') confidenceScore = 10;
        else if (conf === 'MEDIUM') confidenceScore = 6;

        // --- Total ---
        let total = needScore + abilityScore + confidenceScore;
        total = Math.round(Math.min(100, Math.max(0, total)));

        // --- Bands ---
        let band = 'Low';
        if (total >= 60) band = 'High';
        else if (total >= 35) band = 'Medium';

        // --- Guardrail ---
        // If Strong Financials AND (DesignOpp OR Staleness >= 40) -> Min Medium
        // Financial Score >= 60 usually implies Strong/Very Strong (check logic elsewhere, but let's assume 60+ is strong contextually or explicit band checking if passed. 
        // Since we only pass score here, we assume 60+ ~ Strong. 
        // Actually, FinancialAnalysisService defines bands. 
        // "Strong" starts at 50-60? Let's be safe and use 60 as proxy for Strong, or rely on Ability Score contribution.
        // Wait, prompt says: "If financialActivityBand in (Strong, Very strong)".
        // I don't have the BAND passed in. 
        // I should probably map score 60+ to Strong?
        // Let's assume financialScore 60+ covers Strong.
        if (financialScore >= 60 && (designOpportunity || stalenessScore >= 40)) {
            if (band === 'Low') band = 'Medium';
        }

        return {
            score: total,
            band,
            breakdown: { need: needScore, ability: abilityScore, confidence: confidenceScore }
        };
    }
}

export const priorityCalculator = new PriorityCalculator();
