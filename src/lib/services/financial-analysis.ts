import { CompaniesHouseProvider } from '../providers/companies-house';

export interface FinancialAnalysisResult {
    score: number;
    band: 'Very Strong' | 'Strong' | 'Medium' | 'Low';
    signals: {
        status: string;
        accountsType: string;
        filingHealth: 'On Time' | 'One Late' | 'Multiple Late' | 'Unknown';
        momentum: 'Increasing' | 'Flat' | 'Declining' | 'Unknown';
        netAssets: 'Positive' | 'Negative' | 'Unknown';
        isCompanyDormant?: boolean;
        hasDormantAccounts?: boolean;
        breakdown?: { label: string, points: number, text: string }[];
        details?: string[]; // Legacy/Backward compat
    };
}

export class FinancialAnalysisService {
    private provider: CompaniesHouseProvider;

    constructor() {
        this.provider = new CompaniesHouseProvider();
    }

    async analyze(companyNumber: string): Promise<FinancialAnalysisResult> {
        const profile = await this.provider.getCompanyProfile(companyNumber);

        let score = 0;
        const breakdown: { label: string, points: number, text: string }[] = [];
        const signals: any = {
            status: 'Unknown',
            accountsType: 'Unknown',
            filingHealth: 'Unknown',
            momentum: 'Unknown',
            netAssets: 'Unknown'
        };

        if (!profile) {
            return {
                score: 0, // Will trigger error in scanner if we enforce null, but let's keep 0 here and handle in scanner? 
                // Wait, request said "score cannot be returned without report". Here we return a report saying "unavailable".
                // Better: 
                band: 'Low',
                signals: { ...signals, breakdown: [{ label: 'Data Availability', points: 0, text: 'Company data unavailable' }] }
            };
        }

        // Data Sufficiency Check preventing 70-score clumping
        // If we don't know status AND don't know accountsType, it's a ghost record.
        const isGhost = (!profile.company_status || profile.company_status === 'unknown') &&
            (!profile.accounts?.last_accounts?.type);

        if (isGhost) {
            return {
                score: 0,
                band: 'Low',
                signals: { ...signals, breakdown: [{ label: 'Data Sufficiency', points: 0, text: 'Insufficient public data' }] }
            };
        }

        // 1. Operational Status (25 pts)
        // 'active' -> +25, 'dormant' -> +0
        const status = profile.company_status || 'unknown';
        signals.status = status;

        if (status === 'active') {
            score += 25;
            breakdown.push({ label: 'Operational Status', points: 25, text: 'Active' });
        } else {
            breakdown.push({ label: 'Operational Status', points: 0, text: status });
        }

        // 2. Filing Health (20 pts)
        // Check finding dates. Profile usually has 'accounts.next_due', 'accounts.last_accounts.made_up_to', 'accounts.overdue'
        // 'confirmation_statement.overdue'
        // If overdue = true, penalize.
        // We lack full filing history here, so we use the 'overdue' flags in the profile which cover the current cycle.
        // We can check 'accounts.overdue' and 'confirmation_statement.overdue'.

        const accountsOverdue = profile.accounts?.overdue || false;
        const csOverdue = profile.confirmation_statement?.overdue || false;

        if (!accountsOverdue && !csOverdue) {
            score += 20;
            signals.filingHealth = 'On Time';
            breakdown.push({ label: 'Filing Health', points: 20, text: 'All filings on time' });
        } else if (accountsOverdue && csOverdue) {
            score += 0;
            signals.filingHealth = 'Multiple Late';
            breakdown.push({ label: 'Filing Health', points: 0, text: 'Multiple filings overdue' });
        } else {
            score += 10; // one late
            signals.filingHealth = 'One Late';
            breakdown.push({ label: 'Filing Health', points: 10, text: 'One filing overdue' });
        }

        // 3. Company Size (25 pts)
        // accounts.last_accounts.type
        // 'micro-entity', 'small', 'medium', 'full' (large), 'total-exemption-small', etc.
        const accType = profile.accounts?.last_accounts?.type || 'unknown';
        signals.accountsType = accType;

        // Check for Dormant Accounts early to influence scoring defaults
        const hasDormantAccounts = (accType.includes('dormant'));

        if (accType.includes('micro') || accType === 'total-exemption-full') {
            score += hasDormantAccounts ? 0 : 5;
            breakdown.push({ label: 'Company Size', points: hasDormantAccounts ? 0 : 5, text: `Micro-entity/Small (${accType})` });
        } else if (accType.includes('small') || accType === 'total-exemption-small') {
            score += hasDormantAccounts ? 0 : 15;
            breakdown.push({ label: 'Company Size', points: hasDormantAccounts ? 0 : 15, text: `Small (${accType})` });
        } else if (accType.includes('medium')) {
            score += hasDormantAccounts ? 0 : 20;
            breakdown.push({ label: 'Company Size', points: hasDormantAccounts ? 0 : 20, text: 'Medium' });
        } else if (accType.includes('full') || accType.includes('group')) {
            score += hasDormantAccounts ? 0 : 25;
            breakdown.push({ label: 'Company Size', points: hasDormantAccounts ? 0 : 25, text: `Large/Full (${accType})` });
        } else {
            score += hasDormantAccounts ? 0 : 5;
            breakdown.push({ label: 'Company Size', points: hasDormantAccounts ? 0 : 5, text: `Unknown/Other (${accType})` });
        }

        // 4. Financial Momentum (20 pts)
        // If dormant accounts, momentum is 0. Otherwise default to +10.
        const momPoints = hasDormantAccounts ? 0 : 10;
        score += momPoints;
        signals.momentum = 'Unknown';
        breakdown.push({
            label: 'Financial Momentum',
            points: momPoints,
            text: hasDormantAccounts ? 'Dormant (0 pts)' : 'Insufficient data (Default +10)'
        });

        // 5. Balance Sheet Buffer (10 pts)
        // If dormant accounts, assets logic is 0. Otherwise default to +10.
        const assetPoints = hasDormantAccounts ? 0 : 10;
        score += assetPoints;
        signals.netAssets = 'Unknown';
        breakdown.push({
            label: 'Balance Sheet',
            points: assetPoints,
            text: hasDormantAccounts ? 'Dormant (0 pts)' : 'Data unavailable (Default +10)'
        });

        // Explicit Flags for UI Consumption - CANONICAL SOURCE
        // 1. Hard Dormant: Only if official Companies House status is NOT active.
        signals.isCompanyDormant = (status !== 'active');

        // 2. Dormant Accounts: Active company filed dormant accounts.
        signals.hasDormantAccounts = hasDormantAccounts;

        // Clarify Breakdown Label for Dormant Accounts
        if (signals.hasDormantAccounts) {
            // Find and update the Company Size label if it was generic
            const sizeItem = breakdown.find(b => b.label === 'Company Size');
            if (sizeItem && sizeItem.text.includes('Unknown/Other')) {
                sizeItem.text = 'Unknown/Other (Dormant Accounts)';
            }
        }

        // Calculate Band
        let band: "Very Strong" | "Strong" | "Medium" | "Low" = 'Low';
        if (score >= 80) band = 'Very Strong';
        else if (score >= 60) band = 'Strong';
        else if (score >= 40) band = 'Medium';
        else band = 'Low';

        // Override Band for Dormant Accounts (Hard Cap)
        // Dormant accounts should never be "Strong". Cap at Medium.
        if (signals.hasDormantAccounts && (band === 'Strong' || band === 'Very Strong')) {
            band = 'Medium';
            // Also cap the score if it's artificially high? 
            // Let's keep the raw score for debugging but the band dictates the UI badge.
            // Actually, if we cap the band, we should probably cap the score to 59 to be consistent.
            if (score >= 60) score = 59;
        }

        signals.breakdown = breakdown;
        // Legacy support
        signals.details = breakdown.map(b => `${b.label}: ${b.text} (+${b.points})`);

        return {
            score,
            band,
            signals
        };
    }
}

export const financialAnalysisService = new FinancialAnalysisService();
