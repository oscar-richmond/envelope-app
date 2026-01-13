import { ContactDiscoveryProvider, ContactResult } from './index';

interface HunterEmail {
    value: string;
    type: string; // 'personal' or 'generic'
    confidence: number; // 0-100
    first_name: string | null;
    last_name: string | null;
    position: string | null;
    seniority: string | null;
    department: string | null;
    linkedin: string | null;
    twitter: string | null;
    phone_number: string | null;
    verification: {
        date: string | null;
        status: 'valid' | 'invalid' | 'accept_all' | 'webmail' | 'disposable' | 'unknown';
    };
}

interface HunterResponse {
    data: {
        domain: string;
        disposable: boolean;
        webmail: boolean;
        pattern: string | null;
        organization: string | null;
        emails: HunterEmail[];
    };
    meta: {
        results: number;
        limit: number;
        offset: number;
    };
}

/**
 * Hunter.io Email Discovery Provider
 * Uses Hunter's domain-search API to find professional emails
 */
export class HunterProvider implements ContactDiscoveryProvider {
    readonly name = 'hunter';
    private readonly apiKey: string;
    private readonly baseUrl = 'https://api.hunter.io/v2';

    constructor() {
        this.apiKey = process.env.HUNTER_API_KEY || '';
    }

    async find(domain: string): Promise<ContactResult[]> {
        if (!this.apiKey) {
            console.warn('[HunterProvider] No API key configured, skipping');
            return [];
        }

        try {
            // Clean domain
            const cleanDomain = domain
                .replace(/^https?:\/\//, '')
                .replace(/^www\./, '')
                .split('/')[0];

            // Add limit=100 to get more results (default is 10)
            const url = `${this.baseUrl}/domain-search?domain=${encodeURIComponent(cleanDomain)}&api_key=${this.apiKey}&limit=100`;

            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    console.error('[HunterProvider] Invalid API key');
                } else if (response.status === 429) {
                    console.warn('[HunterProvider] Rate limit exceeded');
                } else {
                    console.error('[HunterProvider] API error:', response.status);
                }
                return [];
            }

            const data: HunterResponse = await response.json();

            // Log raw response size for debugging
            console.log(`[HunterProvider] Raw response: ${data.data.emails.length} emails, meta: limit=${data.meta.limit}, results=${data.meta.results}`);

            return data.data.emails.map(email => this.mapToContactResult(email));

        } catch (error) {
            console.error('[HunterProvider] Discovery failed:', error);
            return [];
        }
    }

    private mapToContactResult(email: HunterEmail): ContactResult {
        // Map Hunter verification status to our status
        const verificationMap: Record<string, 'verified' | 'likely' | 'unknown'> = {
            'valid': 'verified',
            'accept_all': 'likely',
            'webmail': 'likely',
            'unknown': 'unknown',
            'invalid': 'unknown',
            'disposable': 'unknown'
        };

        // Map seniority to role category
        const roleCategory = this.mapSeniorityToCategory(email.seniority, email.department);

        return {
            firstName: email.first_name || '',
            lastName: email.last_name || '',
            title: email.position || '',
            email: email.value,
            confidence: email.confidence,
            roleCategory,
            source: 'hunter',
            verificationStatus: verificationMap[email.verification?.status] || 'unknown',
            phone: email.phone_number || undefined,
            linkedinUrl: email.linkedin || undefined
        };
    }

    private mapSeniorityToCategory(
        seniority: string | null,
        department: string | null
    ): 'DECISION_MAKER' | 'MARKETING' | 'OTHER' {
        const seniorityLower = (seniority || '').toLowerCase();
        const departmentLower = (department || '').toLowerCase();

        // Executive/senior roles are decision makers
        if (['executive', 'senior', 'director'].includes(seniorityLower)) {
            return 'DECISION_MAKER';
        }

        // C-suite keywords
        if (['ceo', 'cto', 'cfo', 'cmo', 'coo', 'founder', 'owner'].some(k =>
            seniorityLower.includes(k) || departmentLower.includes(k)
        )) {
            return 'DECISION_MAKER';
        }

        // Marketing/Sales department
        if (['marketing', 'sales', 'growth', 'business development'].some(k =>
            departmentLower.includes(k)
        )) {
            return 'MARKETING';
        }

        return 'OTHER';
    }
}
