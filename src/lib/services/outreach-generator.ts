import { CompanyProspect, Lead } from '@prisma/client';

interface OutreachDraft {
    tier: 'HIGH' | 'MEDIUM' | 'LOW';
    subject: string;
    subjectOptions?: string[]; // New: 3 options
    body: string;
    observations: string[];
    internalNote?: string; // New: Debug info
}

export class OutreachGeneratorService {

    /**
     * Generate a draft based on prospect data and signals
     */
    generateDraft(prospect: CompanyProspect, lead?: Lead | null): OutreachDraft | null {
        // 1. Determine Tier & Opportunity
        const score = prospect.contactPriorityScore || 0;
        let signals: any = {};
        try { signals = typeof prospect.financialSignals === 'string' ? JSON.parse(prospect.financialSignals) : prospect.financialSignals || {}; } catch (e) { }

        // Hard Dormant Safety Check
        const isHardDormant = signals.status && signals.status !== 'active';
        if (isHardDormant) return null;

        // Opportunity Tone
        let opportunity: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
        if (score >= 70) opportunity = 'HIGH';
        else if (score < 40) opportunity = 'LOW';

        // if (opportunity === 'LOW') return null; // Constraint Removed: Allow generation for all

        // 2. Data Preparation
        const companyLabel = this.getCanonicalName(prospect);
        const industry = prospect.industry || "professional services";
        const location = this.extractCity(prospect.registeredLocation) || "the UK";
        const websiteSignals = this.parseWebsiteSignals(prospect);

        // 3. Generate Components
        const opening = this.generateOpening(companyLabel, industry, location, websiteSignals, opportunity);
        const valueProp = this.generateValueProp(opportunity, websiteSignals);
        const cta = this.generateCTA(opportunity);
        const subjectOptions = this.generateSubjectLines(companyLabel, opportunity);

        // 4. Assemble Body (Short paragraphs, no em-dashes)
        const senderName = "Oscar"; // Default

        const body = `Hi {{FirstName}},

${opening}

${valueProp}

${cta}

Best,
${senderName}`;

        const internalNote = `Generated for ${opportunity} opportunity (${score}). Opening: ${opening.substring(0, 30)}...`;

        return {
            tier: opportunity,
            subject: subjectOptions[0], // Default to first
            subjectOptions,
            body,
            observations: websiteSignals,
            internalNote
        };
    }

    // --- Component Generators ---

    private generateSubjectLines(companyName: string, opportunity: 'HIGH' | 'MEDIUM' | 'LOW'): string[] {
        // Rules: 3-7 words, Curious but professional. Include First/Company Name.
        return [
            `Quick question, {{FirstName}}`,
            `Thought on ${companyName}`,
            `${companyName} website question`
        ];
    }

    private generateOpening(company: string, industry: string, location: string, signals: string[], opportunity: 'HIGH' | 'MEDIUM' | 'LOW'): string {
        // Rule: Tailored opening (prove research immediately). Reference Homepage/Services/Nav.
        const templates = [
            `I was looking at the ${company} website earlier today, particularly the homepage and services section.`,
            `I spent a few minutes on the ${company} website this morning, specifically looking at your navigation structure.`,
            `I was reviewing ${company}'s digital presence earlier and reading through your main service pages.`
        ];

        return templates[Math.floor(Math.random() * templates.length)];
    }

    private generateValueProp(opportunity: 'HIGH' | 'MEDIUM' | 'LOW', signals: string[]): string {
        // Rule: Rebuild-Led. Frame as "Underselling" or "Earlier Version of Business". 
        // NO "tweaks", "optimisation", "quick wins".

        const painPoints = [
            // Pain 1: Earlier Version
            `The business has clearly evolved, but the current site structure feels like it represents an earlier version of the firm. A more modern platform would better align your digital presence with where the business is today.`,

            // Pain 2: Underselling
            `It’s clear you are established in the sector, but the current site seems to slightly undersell that expertise. A site built to modern standards would ensure visitors immediately grasp the full weight of your experience.`,

            // Pain 3: Structural Limit
            `The content is valuable, but the current site architecture limits how clearly you can communicate your value. Moving to a purpose-built structure would allow you to present your services with much greater clarity.`
        ];

        // Signal override (if mobile is REALLY bad, frame it as "Brand misalignment" not "mobile fix")
        if (signals.some(s => s.includes("mobile"))) {
            return `The current mobile experience doesn't quite match the professional standard set by the firm itself. A rebuilt platform would ensure the brand feels just as established on a phone as it does in person.`;
        }

        return painPoints[Math.floor(Math.random() * painPoints.length)];
    }

    private generateCTA(opportunity: 'HIGH' | 'MEDIUM' | 'LOW'): string {
        // Rule: "Walk through observations", 15 mins. No "sales".

        const offer = `I made a few notes on what a more representative site could look like.`;

        if (opportunity === 'HIGH') {
            return `${offer} If you’re free over the next few days, happy to run through those observations on a 15-minute call.`;
        } else {
            // Even for medium, we keep the high-value "observation walk through" but softer
            return `${offer} Happy to walk through those observations briefly if you're open to a short conversation.`;
        }
    }

    // --- Helpers ---

    private parseWebsiteSignals(prospect: CompanyProspect): string[] {
        const obs: string[] = [];
        let webSignals: any = {};
        try {
            webSignals = typeof prospect.signals === 'string' ? JSON.parse(prospect.signals) : prospect.signals || {};
        } catch (e) { }

        // Mapped to "Issues" but expressed as "Areas to improve"
        if (webSignals.hasJQuery) obs.push("modernising the tech stack");
        if (webSignals.hasBootstrap) obs.push("moving away from generic templates");
        if ((webSignals.tableCount || 0) > 2) obs.push("updating older layout structures");
        if (webSignals.viewport === false) obs.push("optimising mobile responsiveness"); // Prime signal

        if (webSignals.blogLastPost) {
            const lastPost = new Date(webSignals.blogLastPost);
            const now = new Date();
            const months = (now.getTime() - lastPost.getTime()) / (1000 * 60 * 60 * 24 * 30);
            if (months > 12) obs.push("refreshing content channels");
        }

        if ((webSignals.htmlSizeKb || 0) > 150) obs.push("improving page load performance");

        return obs;
    }

    private extractCity(address: string | null): string | null {
        if (!address) return null;
        const parts = address.split(',');
        if (parts.length > 1) return parts[parts.length - 2].trim();
        return parts[0].trim();
    }

    public getCanonicalName(prospect: CompanyProspect): string {
        // 1. Manual Override (Highest Priority)
        if (prospect.brandNameOverride) return prospect.brandNameOverride;

        // 2. Extracted Website Brand Name
        if (prospect.websiteBrandName) return prospect.websiteBrandName;

        // 3. Legal Name (Cleaned)
        let name = prospect.companyName || "";
        // Remove Legal Entities
        name = name.replace(/\s+(ltd|limited|llp|plc|inc|corp|corporation|holdings|group)\.?$/i, '');
        // Remove trailing punctuation
        name = name.replace(/[.,]+$/, '');

        if (name.trim().length > 0) return name.trim();

        // 4. Domain Fallback
        if (prospect.websiteDomain) {
            const clean = prospect.websiteDomain.split('.')[0];
            return clean.charAt(0).toUpperCase() + clean.slice(1);
        }

        return "Company";
    }

    /**
     * Generate a short follow-up
     */
    generateFollowUp(originalSubject: string, companyName: string, count: number): string {
        const templates = [
            "Just bumping this thread to see if it might be of interest?",
            "Wanted to quickly circle back on the note below.",
            "Just bubbling this up in case it got buried.",
            "Quick checking in on this."
        ];

        const opening = templates[Math.floor(Math.random() * templates.length)];

        const closers = [
            "Do you have 5 minutes later this week?",
            "Happy to send over a draft idea if you're open to it?",
            "Worth a brief chat to explore?",
            "Let me know if this isn't a priority right now."
        ];

        const close = closers[Math.floor(Math.random() * closers.length)];

        return `Hi there,

${opening}

I know things get busy, but I still think there's a strong opportunity to elevate the ${companyName} digital presence.

${close}

Best,
Oscar`;
    }
}

export const outreachGenerator = new OutreachGeneratorService();
