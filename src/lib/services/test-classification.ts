// Stand-alone test script (no imports)

const CONSUMER_PROVIDERS = new Set([
    'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'hotmail.com', 'hotmail.co.uk',
    'outlook.com', 'live.com', 'icloud.com', 'me.com', 'aol.com', 'protonmail.com', 'zoho.com',
    'yandex.com', 'mail.com', 'gmx.com'
]);

function classify(email: string, companyDomain?: string): 'GENERAL' | 'SALES' | 'SUPPORT' | 'PERSONAL' | 'BUSINESS' {
    const [local, domain] = email.split('@');

    // 1. Check Company Match
    if (companyDomain && (domain === companyDomain || domain.endsWith('.' + companyDomain) || companyDomain.endsWith('.' + domain))) {
        if (/sales|partner|biz|growth/i.test(local)) return 'SALES';
        if (/support|help|desk|billing/i.test(local)) return 'SUPPORT';
        if (/info|hello|hi|enquir|general|office|contact/i.test(local)) return 'GENERAL';
        return 'BUSINESS';
    }

    // 2. Check Strict Personal
    if (CONSUMER_PROVIDERS.has(domain)) return 'PERSONAL';

    // 3. Fallback
    if (/sales|partner|biz|growth/i.test(local)) return 'SALES';
    if (/support|help|desk|billing/i.test(local)) return 'SUPPORT';
    if (/info|hello|hi|enquir|general|office|contact/i.test(local)) return 'GENERAL';

    return 'BUSINESS';
}

async function test() {
    console.log("Testing Email Classification Logic...");

    const cases = [
        { email: 'john@company.com', domain: 'company.com', expected: 'BUSINESS' },
        { email: 'john@company.com', domain: 'www.company.com', expected: 'BUSINESS' },
        { email: 'info@company.com', domain: 'company.com', expected: 'GENERAL' },
        { email: 'john@gmail.com', domain: 'company.com', expected: 'PERSONAL' },
        { email: 'john@yahoo.co.uk', domain: 'company.com', expected: 'PERSONAL' },
        { email: 'partner@agency.com', domain: 'company.com', expected: 'BUSINESS' }, // External/Unknown -> Business
        { email: 'john@sub.company.com', domain: 'company.com', expected: 'BUSINESS' },
    ];

    for (const c of cases) {
        let companyDomain = '';
        try {
            const url = c.domain.startsWith('http') ? c.domain : 'https://' + c.domain;
            companyDomain = new URL(url).hostname.replace(/^www\./, '');
        } catch (e) { }

        const result = classify(c.email, companyDomain);
        const pass = result === c.expected || (c.expected === 'BUSINESS' && result === 'BUSINESS');

        console.log(`Email: ${c.email}, Site: ${c.domain} -> Classified: ${result} [${pass ? 'PASS' : 'FAIL'}]`);
    }
}

test().catch(console.error);
