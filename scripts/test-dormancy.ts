
import { FinancialAnalysisService } from '../src/lib/services/financial-analysis';

// Mock Provider to simulate Companies House responses
const mockProvider = {
    getCompanyProfile: async (companyNumber: string) => {
        if (companyNumber === 'ACTIVE_DORMANT_ACCOUNTS') {
            return {
                company_status: 'active',
                accounts: { last_accounts: { type: 'dormant' } }
            };
        }
        if (companyNumber === 'DORMANT_COMPANY') {
            return {
                company_status: 'dormant',
                accounts: { last_accounts: { type: 'dormant' } }
            };
        }
        if (companyNumber === 'ACTIVE_UNKNOWN') {
            return {
                company_status: 'active',
                accounts: { last_accounts: { type: 'unknown' } }
            };
        }
        return null;
    }
} as any;

async function test() {
    const service = new FinancialAnalysisService();
    // Inject mock (forcefully for testing)
    (service as any).provider = mockProvider;

    console.log("--- Testing Dormancy Logic ---");

    // Case 1: Active Company + Dormant Accounts
    const res1 = await service.analyze('ACTIVE_DORMANT_ACCOUNTS');
    console.log(`\nCase 1 (Active + Dormant Accounts):`);
    console.log(`Status: ${res1.signals.status}`);
    console.log(`isCompanyDormant: ${res1.signals.isCompanyDormant} (Expect: false)`);
    console.log(`hasDormantAccounts: ${res1.signals.hasDormantAccounts} (Expect: true)`);
    if (res1.signals.isCompanyDormant === false && res1.signals.hasDormantAccounts === true) {
        console.log("PASS");
    } else {
        console.error("FAIL");
    }

    // Case 2: Dormant Company
    const res2 = await service.analyze('DORMANT_COMPANY');
    console.log(`\nCase 2 (Dormant Company):`);
    console.log(`Status: ${res2.signals.status}`);
    console.log(`isCompanyDormant: ${res2.signals.isCompanyDormant} (Expect: true)`);
    if (res2.signals.isCompanyDormant === true) {
        console.log("PASS");
    } else {
        console.error("FAIL");
    }
}

test();
