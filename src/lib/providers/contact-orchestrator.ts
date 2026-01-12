import { ContactDiscoveryProvider, ContactResult } from './index';

/**
 * Contact Discovery Orchestrator
 * Runs multiple providers in order, deduplicates results, and sorts by confidence
 */
export class ContactDiscoveryOrchestrator implements ContactDiscoveryProvider {
    readonly name = 'orchestrator';
    private providers: ContactDiscoveryProvider[];

    constructor(providers: ContactDiscoveryProvider[]) {
        this.providers = providers;
    }

    async find(domain: string): Promise<ContactResult[]> {
        const allResults: ContactResult[] = [];
        const emailMap = new Map<string, ContactResult>();

        // Run providers sequentially
        for (const provider of this.providers) {
            try {
                console.log(`[ContactOrchestrator] Running ${provider.name} provider...`);
                const results = await provider.find(domain);
                console.log(`[ContactOrchestrator] ${provider.name} found ${results.length} contacts`);

                // Process results, deduplicating by email
                for (const contact of results) {
                    if (!contact.email) continue;

                    const email = contact.email.toLowerCase();
                    const existing = emailMap.get(email);

                    if (!existing) {
                        // New email, add it
                        emailMap.set(email, contact);
                    } else {
                        // Duplicate - prefer verified over likely over unknown
                        const shouldReplace = this.shouldReplaceContact(existing, contact);
                        if (shouldReplace) {
                            // Merge data from both sources
                            const merged = this.mergeContacts(existing, contact);
                            emailMap.set(email, merged);
                        }
                    }
                }
            } catch (error) {
                console.error(`[ContactOrchestrator] Provider ${provider.name} failed:`, error);
                // Continue with other providers
            }
        }

        // Convert to array and sort by confidence (verified first, then by score)
        const results = Array.from(emailMap.values());

        return results.sort((a, b) => {
            // First by verification status
            const statusOrder = { 'verified': 0, 'likely': 1, 'unknown': 2 };
            const statusDiff = statusOrder[a.verificationStatus] - statusOrder[b.verificationStatus];
            if (statusDiff !== 0) return statusDiff;

            // Then by confidence score
            return b.confidence - a.confidence;
        });
    }

    private shouldReplaceContact(existing: ContactResult, newContact: ContactResult): boolean {
        const statusOrder = { 'verified': 0, 'likely': 1, 'unknown': 2 };

        // Prefer verified status
        if (statusOrder[newContact.verificationStatus] < statusOrder[existing.verificationStatus]) {
            return true;
        }

        // If same status, prefer higher confidence
        if (newContact.verificationStatus === existing.verificationStatus) {
            return newContact.confidence > existing.confidence;
        }

        return false;
    }

    private mergeContacts(existing: ContactResult, newContact: ContactResult): ContactResult {
        // Keep the preferred contact but merge in any missing data
        const preferred = this.shouldReplaceContact(existing, newContact) ? newContact : existing;
        const secondary = preferred === newContact ? existing : newContact;

        return {
            ...preferred,
            // Fill in missing fields from secondary
            firstName: preferred.firstName || secondary.firstName,
            lastName: preferred.lastName || secondary.lastName,
            title: preferred.title || secondary.title,
            phone: preferred.phone || secondary.phone,
            linkedinUrl: preferred.linkedinUrl || secondary.linkedinUrl
        };
    }
}
