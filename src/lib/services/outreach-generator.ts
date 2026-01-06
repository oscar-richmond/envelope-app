
import { CompanyProspect, Lead } from '@prisma/client';

interface OutreachDraft {
    tier: 'HIGH' | 'MEDIUM' | 'LOW';
    subject: string;
    subjectOptions: string[];
    body: string;
    observations: string[];
    internalNote?: string;
    recipientFirstName?: string;
    companyName: string;
}

export class OutreachGeneratorService {

    /**
     * Generate a draft based on prospect data and signals.
     * Implements strict formatting and name resolution rules.
     */
    generateDraft(prospect: CompanyProspect, lead?: Lead | null, recipientEmail?: string): OutreachDraft | null {
        // 1. Resolve Canonical Company Name (CRITICAL)
        const companyName = this.getCanonicalName(prospect);
        if (!companyName || companyName === "Company") {
            // Cannot generate without a valid company name
            return null;
        }

        // 2. Determine Tier
        const score = prospect.contactPriorityScore || 0;
        let signals: any = {};
        try {
            signals = typeof prospect.financialSignals === 'string'
                ? JSON.parse(prospect.financialSignals)
                : prospect.financialSignals || {};
        } catch (e) { }

        // Hard Dormant Safety Check
        const isHardDormant = signals.status && signals.status !== 'active';
        if (isHardDormant) return null;

        // Opportunity Tier
        let opportunity: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
        if (score >= 70) opportunity = 'HIGH';
        else if (score < 40) opportunity = 'LOW';

        // 3. Resolve Recipient First Name
        const recipientFirstName = this.extractFirstName(recipientEmail, prospect);
        const greeting = recipientFirstName ? `Hi ${recipientFirstName},` : 'Hi there,';

        // 4. Generate Email Components
        const subjectOptions = this.generateSubjectLines(companyName, recipientFirstName);
        const paragraph1 = this.generateProofOfReview(companyName);
        const paragraph2 = this.generatePainAndInsight();
        const paragraph3 = this.generateOutcomeValue();
        const paragraph4 = this.generateSoftCTA();

        // 5. Get Sender Name (TODO: Could be dynamic from session)
        const senderFirstName = "Oscar";

        // 6. Assemble Body (Strict formatting: short paragraphs, no em-dashes)
        const body = `${greeting}

${paragraph1}

${paragraph2}

${paragraph3}

${paragraph4}

Best,
${senderFirstName}`;

        // 7. Validation: No em-dashes, correct company name placement
        const validatedBody = this.validateAndClean(body);

        const internalNote = `Generated for ${opportunity} opportunity (score: ${score}). Company: ${companyName}`;

        return {
            tier: opportunity,
            subject: subjectOptions[0],
            subjectOptions,
            body: validatedBody,
            observations: this.parseWebsiteSignals(prospect),
            internalNote,
            recipientFirstName: recipientFirstName || undefined,
            companyName
        };
    }

    // --- Component Generators (Following Exact Approved Patterns) ---

    private generateSubjectLines(companyName: string, firstName?: string): string[] {
        // Rules: 3-7 words, curious but professional, include name or company
        const lines: string[] = [];

        if (firstName) {
            lines.push(`Quick question, ${firstName}`);
        }
        lines.push(`Quick thought on ${companyName}`);
        lines.push(`${companyName} website question`);
        lines.push(`Thought on your website`);

        // Return first 3
        return lines.slice(0, 3);
    }

    private generateProofOfReview(companyName: string): string {
        // Paragraph 1: Must reference company name and a concrete area of the site
        const templates = [
            `I spent a few minutes on ${companyName}'s website earlier, looking through the main service pages.`,
            `I was reviewing ${companyName}'s website this morning, particularly the homepage and how the services are presented.`,
            `I had a look at the ${companyName} website earlier today, specifically the homepage and navigation structure.`
        ];
        return templates[Math.floor(Math.random() * templates.length)];
    }

    private generatePainAndInsight(): string {
        // Paragraph 2: Exact approved framing
        // Focus on perception and trust, never say "outdated", never criticise directly
        return `What you do is clear, but the site doesn't fully reflect the quality of the organisation in the first few seconds. For service businesses like yours, that initial impression often decides whether someone trusts the firm enough to get in touch or moves on.`;
    }

    private generateOutcomeValue(): string {
        // Paragraph 3: Describe improvement in plain terms
        // "User experience" may appear once only
        const templates = [
            `Improving the user experience in those early moments would help communicate your value more confidently and guide people to the right next step.`,
            `A clearer structure and stronger visual presence would help visitors understand your expertise immediately and take the next step with confidence.`,
            `Refining how the site presents your work would build trust faster and make it easier for the right people to get in touch.`
        ];
        return templates[Math.floor(Math.random() * templates.length)];
    }

    private generateSoftCTA(): string {
        // Paragraph 4: Soft, clear CTA. Ask for a call, low pressure, loose timeframe.
        // No booking links. No urgency language.
        const templates = [
            `I've noted a few specific ideas if that would be useful. Would you be open to a short call over the next few days to talk it through?`,
            `I have a few observations that might be helpful. Would you have time for a brief conversation this week?`,
            `I've made some notes on what could work well. Happy to walk through them on a quick call if you're interested.`
        ];
        return templates[Math.floor(Math.random() * templates.length)];
    }

    // --- Validation ---

    private validateAndClean(body: string): string {
        // Remove any em-dashes or en-dashes
        let cleaned = body.replace(/—/g, '. ');
        cleaned = cleaned.replace(/–/g, '. ');
        cleaned = cleaned.replace(/ - /g, '. ');

        // Ensure no double spaces
        cleaned = cleaned.replace(/  +/g, ' ');

        // Ensure proper line breaks (no triple line breaks)
        cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

        return cleaned.trim();
    }

    // --- Helpers ---

    private extractFirstName(email?: string, prospect?: CompanyProspect): string | null {
        // Try to extract first name from email if it follows pattern: firstname.lastname@domain.com
        if (email) {
            const localPart = email.split('@')[0];
            if (localPart.includes('.')) {
                const firstName = localPart.split('.')[0];
                // Capitalize
                return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
            }
            // Check if it looks like a name (not info@, hello@, etc.)
            const commonGeneric = ['info', 'hello', 'contact', 'sales', 'support', 'admin', 'enquiries', 'enquiry', 'office', 'team'];
            if (!commonGeneric.includes(localPart.toLowerCase())) {
                // Might be a name, capitalise it
                if (localPart.length > 2 && localPart.length < 15) {
                    return localPart.charAt(0).toUpperCase() + localPart.slice(1).toLowerCase();
                }
            }
        }
        return null;
    }

    private parseWebsiteSignals(prospect: CompanyProspect): string[] {
        const obs: string[] = [];
        let webSignals: any = {};
        try {
            webSignals = typeof prospect.signals === 'string' ? JSON.parse(prospect.signals) : prospect.signals || {};
        } catch (e) { }

        if (webSignals.hasJQuery) obs.push("modernising the tech stack");
        if (webSignals.hasBootstrap) obs.push("moving away from generic templates");
        if ((webSignals.tableCount || 0) > 2) obs.push("updating older layout structures");
        if (webSignals.viewport === false) obs.push("optimising mobile responsiveness");

        if (webSignals.blogLastPost) {
            const lastPost = new Date(webSignals.blogLastPost);
            const now = new Date();
            const months = (now.getTime() - lastPost.getTime()) / (1000 * 60 * 60 * 24 * 30);
            if (months > 12) obs.push("refreshing content channels");
        }

        if ((webSignals.htmlSizeKb || 0) > 150) obs.push("improving page load performance");

        return obs;
    }

    public getCanonicalName(prospect: CompanyProspect): string {
        // Priority: brandNameOverride > websiteBrandName > cleaned legal name > domain

        // 1. Manual Override (Highest Priority)
        if (prospect.brandNameOverride && prospect.brandNameOverride.trim().length > 0) {
            return prospect.brandNameOverride.trim();
        }

        // 2. Extracted Website Brand Name
        if (prospect.websiteBrandName && prospect.websiteBrandName.trim().length > 0) {
            return prospect.websiteBrandName.trim();
        }

        // 3. Legal Name (Cleaned)
        let name = prospect.companyName || "";
        // Remove Legal Entities and Trading suffixes
        name = name.replace(/\s*\(?(trading|t\/a)\)?.*$/i, '');
        name = name.replace(/\s+(ltd|limited|llp|plc|inc|corp|corporation|holdings|group)\.?$/i, '');
        name = name.replace(/[.,]+$/, '');
        name = name.trim();

        // Avoid using category-like names
        const categoryWords = ['services', 'solutions', 'consulting', 'consultants', 'associates', 'partners', 'group'];
        const words = name.toLowerCase().split(/\s+/);
        const isCategoryLike = words.length <= 2 && categoryWords.some(cw => words.includes(cw));

        if (name.length > 0 && !isCategoryLike) {
            return name;
        }

        // 4. Domain Fallback
        if (prospect.websiteDomain) {
            const domain = prospect.websiteDomain.replace(/^www\./, '');
            const clean = domain.split('.')[0];
            // Capitalise properly
            return clean.charAt(0).toUpperCase() + clean.slice(1);
        }

        return "Company";
    }

    /**
     * Generate a short follow-up email
     */
    generateFollowUp(originalSubject: string, companyName: string, count: number): string {
        const openers = [
            "Just bumping this to the top in case it got buried.",
            "Wanted to quickly circle back on the note below.",
            "Just checking in on this."
        ];

        const opening = openers[Math.floor(Math.random() * openers.length)];

        const closers = [
            "Would you have a few minutes later this week?",
            "Happy to send over a rough idea if you're open to it.",
            "Let me know if this isn't a priority right now."
        ];

        const close = closers[Math.floor(Math.random() * closers.length)];

        return `Hi there,

${opening}

I still think there's a good opportunity to strengthen how ${companyName} comes across online.

${close}

Best,
Oscar`;
    }
}

export const outreachGenerator = new OutreachGeneratorService();
