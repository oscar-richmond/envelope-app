import { ContactDiscoveryProvider, ContactResult } from './index';
import { emailDiscovery } from '../services/email-discovery';

/**
 * Website Scrape Provider
 * Wraps the existing EmailDiscoveryService to implement ContactDiscoveryProvider interface
 */
export class WebsiteScrapeProvider implements ContactDiscoveryProvider {
    readonly name = 'website';

    async find(domain: string): Promise<ContactResult[]> {
        try {
            const url = domain.startsWith('http') ? domain : `https://${domain}`;
            const result = await emailDiscovery.discoverEmails(url);

            return result.emails.map(email => this.mapToContactResult(email));
        } catch (error) {
            console.error('[WebsiteScrapeProvider] Discovery failed:', error);
            return [];
        }
    }

    private mapToContactResult(email: {
        email: string;
        type: string;
        confidence: string;
        sourceUrl: string;
        contextSnippet: string;
        roleTitle?: string;
        name?: string | null;
    }): ContactResult {
        // Parse name if available
        let firstName = '';
        let lastName = '';

        if (email.name) {
            const parts = email.name.split(' ');
            firstName = parts[0] || '';
            lastName = parts.slice(1).join(' ') || '';
        }

        // Map confidence
        const confidenceMap: Record<string, number> = {
            'HIGH': 85,
            'MEDIUM': 60,
            'LOW': 35
        };

        // Map role to category
        const roleCategory = this.mapRoleToCategory(email.roleTitle || email.type);

        // Map verification status based on confidence
        const verificationStatus = email.confidence === 'HIGH' ? 'likely' : 'unknown';

        return {
            firstName,
            lastName,
            title: email.roleTitle || '',
            email: email.email,
            confidence: confidenceMap[email.confidence] || 50,
            roleCategory,
            source: 'website',
            verificationStatus
        };
    }

    private mapRoleToCategory(role: string): 'DECISION_MAKER' | 'MARKETING' | 'OTHER' {
        const decisionMakerKeywords = [
            'ceo', 'cto', 'cfo', 'cmo', 'coo', 'founder', 'owner', 'director',
            'president', 'partner', 'principal', 'head', 'vp', 'chief'
        ];
        const marketingKeywords = ['marketing', 'sales', 'growth', 'brand'];

        const lowerRole = role.toLowerCase();

        if (decisionMakerKeywords.some(k => lowerRole.includes(k))) {
            return 'DECISION_MAKER';
        }
        if (marketingKeywords.some(k => lowerRole.includes(k))) {
            return 'MARKETING';
        }
        return 'OTHER';
    }
}
