/**
 * QA Test Fixtures
 * 12 sample companies for E2E testing
 */

export interface TestCompany {
    id: string;
    name: string;
    website: string;
    domain: string;
    type: 'uk_team' | 'uk_contact' | 'uk_pdf' | 'uk_generic' | 'uk_ch';
    expectations: {
        minEmails: number;
        minNonGeneric: number;
        hasTeamPage: boolean;
        hasPdf: boolean;
        hasCH: boolean;
        patternExpected: boolean;
    };
    companyNumber?: string;
    notes?: string;
}

export const TEST_COMPANIES: TestCompany[] = [
    {
        id: 'monzo',
        name: 'Monzo Bank',
        website: 'https://monzo.com',
        domain: 'monzo.com',
        type: 'uk_team',
        expectations: {
            minEmails: 1,
            minNonGeneric: 0,
            hasTeamPage: true,
            hasPdf: false,
            hasCH: true,
            patternExpected: false,
        },
        companyNumber: '09446231',
        notes: 'UK fintech, leadership page'
    },
    {
        id: 'deliveroo',
        name: 'Deliveroo',
        website: 'https://deliveroo.co.uk',
        domain: 'deliveroo.co.uk',
        type: 'uk_contact',
        expectations: {
            minEmails: 1,
            minNonGeneric: 0,
            hasTeamPage: false,
            hasPdf: false,
            hasCH: true,
            patternExpected: false,
        },
        companyNumber: '09116243',
        notes: 'UK delivery, contact page'
    },
    {
        id: 'revolut',
        name: 'Revolut',
        website: 'https://www.revolut.com',
        domain: 'revolut.com',
        type: 'uk_team',
        expectations: {
            minEmails: 1,
            minNonGeneric: 0,
            hasTeamPage: true,
            hasPdf: true,
            hasCH: true,
            patternExpected: false,
        },
        companyNumber: '08804411',
        notes: 'UK fintech, team + press'
    },
    {
        id: 'selfridges',
        name: 'Selfridges',
        website: 'https://www.selfridges.com',
        domain: 'selfridges.com',
        type: 'uk_generic',
        expectations: {
            minEmails: 1,
            minNonGeneric: 0,
            hasTeamPage: false,
            hasPdf: false,
            hasCH: true,
            patternExpected: false,
        },
        companyNumber: '00097117',
        notes: 'UK retail, generic emails only'
    },
    {
        id: 'seedlegals',
        name: 'SeedLegals',
        website: 'https://seedlegals.com',
        domain: 'seedlegals.com',
        type: 'uk_ch',
        expectations: {
            minEmails: 1,
            minNonGeneric: 1,
            hasTeamPage: true,
            hasPdf: false,
            hasCH: true,
            patternExpected: true,
        },
        companyNumber: '10440218',
        notes: 'UK legal tech, team page with emails'
    },
    {
        id: 'octopus',
        name: 'Octopus Energy',
        website: 'https://octopus.energy',
        domain: 'octopus.energy',
        type: 'uk_team',
        expectations: {
            minEmails: 1,
            minNonGeneric: 0,
            hasTeamPage: true,
            hasPdf: false,
            hasCH: true,
            patternExpected: false,
        },
        companyNumber: '09263424',
        notes: 'UK energy, multiple sources'
    },
    {
        id: 'madedotcom',
        name: 'Made.com',
        website: 'https://www.made.com',
        domain: 'made.com',
        type: 'uk_generic',
        expectations: {
            minEmails: 0,
            minNonGeneric: 0,
            hasTeamPage: false,
            hasPdf: false,
            hasCH: true,
            patternExpected: false,
        },
        companyNumber: '07101408',
        notes: 'Brand differs from legal name'
    },
    {
        id: 'brewdog',
        name: 'BrewDog',
        website: 'https://www.brewdog.com',
        domain: 'brewdog.com',
        type: 'uk_ch',
        expectations: {
            minEmails: 1,
            minNonGeneric: 0,
            hasTeamPage: true,
            hasPdf: false,
            hasCH: true,
            patternExpected: false,
        },
        companyNumber: 'SC311560',
        notes: 'Scottish company, CH officers'
    },
    {
        id: 'bulb',
        name: 'Bulb Energy',
        website: 'https://bulb.co.uk',
        domain: 'bulb.co.uk',
        type: 'uk_generic',
        expectations: {
            minEmails: 0,
            minNonGeneric: 0,
            hasTeamPage: false,
            hasPdf: false,
            hasCH: true,
            patternExpected: false,
        },
        companyNumber: '09469947',
        notes: 'Administration test case'
    },
    {
        id: 'starling',
        name: 'Starling Bank',
        website: 'https://www.starlingbank.com',
        domain: 'starlingbank.com',
        type: 'uk_team',
        expectations: {
            minEmails: 1,
            minNonGeneric: 0,
            hasTeamPage: true,
            hasPdf: false,
            hasCH: true,
            patternExpected: false,
        },
        companyNumber: '09092149',
        notes: 'UK fintech, leadership page'
    },
    {
        id: 'cazoo',
        name: 'Cazoo',
        website: 'https://www.cazoo.co.uk',
        domain: 'cazoo.co.uk',
        type: 'uk_contact',
        expectations: {
            minEmails: 1,
            minNonGeneric: 0,
            hasTeamPage: false,
            hasPdf: false,
            hasCH: true,
            patternExpected: false,
        },
        companyNumber: '11553599',
        notes: 'UK auto, public search test'
    },
    {
        id: 'gousto',
        name: 'Gousto',
        website: 'https://www.gousto.co.uk',
        domain: 'gousto.co.uk',
        type: 'uk_team',
        expectations: {
            minEmails: 1,
            minNonGeneric: 0,
            hasTeamPage: true,
            hasPdf: false,
            hasCH: true,
            patternExpected: false,
        },
        companyNumber: '08108825',
        notes: 'UK food, team page'
    },
];

export function getTestCompany(id: string): TestCompany | undefined {
    return TEST_COMPANIES.find(c => c.id === id);
}

export function getTestCompaniesByType(type: TestCompany['type']): TestCompany[] {
    return TEST_COMPANIES.filter(c => c.type === type);
}
