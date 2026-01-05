import { CompanyProspect, Lead } from '@prisma/client';

interface OutreachDraft {
    tier: 'HIGH' | 'MEDIUM' | 'LOW';
    subject: string;
    body: string;
    observations: string[];
}

export class OutreachGeneratorService {

    // Templates
    private TEMPLATES = {
        HIGH: {
            subject: [
                "Quick thought on {{CompanyName}}",
                "Noticed something on {{CompanyName}}'s site",
                "A small idea for {{CompanyName}}"
            ],
            body: `Hi {{FirstName}},

I came across {{CompanyName}} while looking at {{industry_location_context}} firms and spent a few minutes reviewing your website.

It’s solid overall, but there are a couple of areas where a small update could make a noticeable difference — particularly around {{specific_issue_1}}.

We’ve helped similar businesses modernise without disrupting what already works, and I thought it might be worth a short conversation.

Would you be open to a quick 15-minute chat? No prep needed — just happy to share a couple of observations.

Best,
{{SenderName}}`
        },
        MEDIUM: {
            subject: [
                "Quick thought on {{CompanyName}}",
                "Question about {{CompanyName}}",
                "Connecting re: {{CompanyName}}"
            ],
            body: `Hi {{FirstName}},

I was looking into {{industry}} companies in {{location}} and came across {{CompanyName}}.

Your site does its job well, but I noticed a few areas where similar firms have been improving clarity and conversion — especially around {{specific_issue_1}}.

Not sure if this is something you’re actively thinking about, but if you’d ever like an outside perspective, I’d be happy to share a couple of ideas.

No obligation at all — just thought I’d reach out.

Best,
{{SenderName}}`
        }
    };

    /**
     * Generate a draft based on prospect data and signals
     */
    generateDraft(prospect: CompanyProspect, lead?: Lead | null): OutreachDraft | null {
        // 1. Determine Tier
        const score = prospect.contactPriorityScore || 0; // Use Contact Priority (Lead Opportunity Score)
        // Hard Dormant Safety Check
        let signals: any = {};
        try { signals = typeof prospect.financialSignals === 'string' ? JSON.parse(prospect.financialSignals) : prospect.financialSignals || {}; } catch (e) { }

        const isHardDormant = signals.status && signals.status !== 'active';
        if (isHardDormant) return null;

        let tier: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
        if (score >= 70) tier = 'HIGH';
        else if (score >= 40) tier = 'MEDIUM';

        // Remove blocking check for LOW tier
        // if (tier === 'LOW') return null;

        // 2. Parse Website Signals for Observations
        const observations = this.generateObservations(prospect);
        const specificIssue = observations.length > 0 ? observations[0] : "digital presence and user experience";
        const specificIssue2 = observations.length > 1 ? observations[1] : "performance optimization";

        // 3. Select Template (Fallback LOW to MEDIUM template for now)
        // If we want a specific LOW template we can add it, but for now reuse MEDIUM
        const templateKey = tier === 'LOW' ? 'MEDIUM' : tier;
        const template = this.TEMPLATES[templateKey];
        const subject = template.subject[Math.floor(Math.random() * template.subject.length)]
            .replace('{{CompanyName}}', prospect.companyName);

        // 4. Personalize Body
        const firstName = "there"; // Default, to be replaced by UI or if Contact exists
        const senderName = "Oscar"; // Default

        let body = template.body
            .replace('{{FirstName}}', firstName)
            .replace('{{CompanyName}}', prospect.companyName)
            .replace('{{SenderName}}', senderName)
            .replace('{{specific_issue_1}}', specificIssue)
            .replace('{{specific_issue_2}}', specificIssue2);

        // Context tokens
        const industry = prospect.industry || "relevant";
        const location = this.extractCity(prospect.registeredLocation) || "the UK";
        const context = `${industry} firms in ${location}`;

        body = body
            .replace('{{industry}}', industry)
            .replace('{{location}}', location)
            .replace('{{industry_location_context}}', context);

        return {
            tier,
            subject,
            body,
            observations
        };
    }

    private generateObservations(prospect: CompanyProspect): string[] {
        const obs: string[] = [];

        // Parse Website Signals
        let webSignals: any = {};
        try {
            // websiteMatchEvidence might contain the analysis result? 
            // Or signals? The DB schema has 'signals' field in CompanyProspect which stores WebsiteAnalysis signals usually?
            // Wait, schema says `signals` on CompanyProspect is "Staleness Analysis". Yes.
            webSignals = typeof prospect.signals === 'string' ? JSON.parse(prospect.signals) : prospect.signals || {};
        } catch (e) { }

        // 1. Technology Observations
        if (webSignals.hasJQuery) obs.push("modernising legacy frontend frameworks");
        if (webSignals.hasBootstrap) obs.push("moving away from generic template structures");
        if ((webSignals.tableCount || 0) > 2) obs.push("updating older layout structures");

        // 2. Mobile / Viewport
        if (webSignals.viewport === false) obs.push("optimising mobile responsiveness");

        // 3. Content Freshness
        if (webSignals.blogLastPost) {
            const lastPost = new Date(webSignals.blogLastPost);
            const now = new Date();
            const months = (now.getTime() - lastPost.getTime()) / (1000 * 60 * 60 * 24 * 30);
            if (months > 12) obs.push("refreshing dated content channels");
        }

        // 4. Performance / Images
        if ((webSignals.htmlSizeKb || 0) > 150) obs.push("improving page load performance");
        if ((webSignals.nonSolarImages || 0) > 5) obs.push("optimising media assets for speed");

        return obs;
    }

    private extractCity(address: string | null): string | null {
        if (!address) return null;
        // Simple heuristic: take the last part or first part? 
        // CH addresses are comma separated usually.
        const parts = address.split(',');
        if (parts.length > 1) return parts[parts.length - 2].trim(); // Often City, Postcode
        return parts[0].trim();
    }
}

export const outreachGenerator = new OutreachGeneratorService();
