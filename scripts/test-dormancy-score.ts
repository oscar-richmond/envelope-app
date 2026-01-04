
import { FinancialAnalysisService } from '../src/lib/services/financial-analysis';

// Mock Provider
const mockProvider = {
    getCompanyProfile: async (companyNumber: string) => {
        // Case: Active status but dormant accounts
        if (companyNumber === 'ACTIVE_DORMANT') {
            return {
                company_status: 'active', // +25
                accounts: {
                    last_accounts: { type: 'dormant' },
                    overdue: false
                },
                confirmation_statement: { overdue: false } // +20 (On Time)
            };
        }
        return null;
    }
} as any;

async function test() {
    const service = new FinancialAnalysisService();
    (service as any).provider = mockProvider;

    console.log("--- Testing Dormancy Scoring Penalties ---");

    const res = await service.analyze('ACTIVE_DORMANT');

    console.log(`Score: ${res.score}`);
    console.log(`Band: ${res.band}`);
    console.log(`Breakdown:`);
    res.signals.breakdown?.forEach(b => console.log(` - ${b.label}: ${b.points}`));

    // Expectation: 
    // Status: 25
    // Filing: 20
    // Size: 0 (Penalty)
    // Momentum: 0 (Penalty)
    // Assets: 0 (Penalty)
    // Total: 45 (Medium) OR Low depending on band logic. 
    // 45 is Medium (40-59).

    if (res.score === 45) {
        console.log("PASS: Score penalty applied correctly (45 pts).");
    } else {
        console.error(`FAIL: Expected 45, got ${res.score}`);
    }
}

test();
