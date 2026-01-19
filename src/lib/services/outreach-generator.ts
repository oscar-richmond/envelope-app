
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
        const subjectOptions = this.generateSubjectLines(companyName, recipientFirstName || undefined);
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
     * Tone variants for follow-up emails
     */
    public readonly VARIANTS = {
        POLITE: 'polite',
        ASSERTIVE: 'assertive',
        ULTRA_SOFT: 'ultra-soft'
    } as const;

    /**
 * Generate follow-up email drafts for all three variants
 */
    generateFollowUpVariants(
        originalSubject: string,
        companyName: string,
        firstName: string | null,
        followUpNumber: number,
        regenerate: boolean = false
    ): { polite: string; assertive: string; ultraSoft: string; subject: string } {
        const name = firstName || 'there';
        const greeting = `Hi ${name},`;
        const senderName = 'Oscar';

        // Use regenerate flag to vary phrasing
        const variantIndex = regenerate ? Math.floor(Math.random() * 3) : 0;

        return {
            polite: this.generatePolite(greeting, companyName, senderName, followUpNumber, variantIndex),
            assertive: this.generateAssertive(greeting, companyName, senderName, followUpNumber, variantIndex),
            ultraSoft: this.generateUltraSoft(greeting, companyName, senderName, followUpNumber, variantIndex),
            subject: `Re: ${originalSubject}`
        };
    }

    /**
     * POLITE variant - calm, respectful, low pressure
     * Use for: First follow-up, medium confidence, conservative industries
     */
    private generatePolite(
        greeting: string,
        companyName: string,
        senderName: string,
        followUpNumber: number,
        variantIndex: number
    ): string {
        const openers = [
            `Just following up on the note I sent earlier after spending some time on ${companyName}'s website.`,
            `Wanted to check in on the message I sent about ${companyName}'s website.`,
            `Following up briefly on my earlier note about ${companyName}'s online presence.`
        ];

        const values = [
            `I wanted to see if it would be useful to share a few specific thoughts around how the site could better support first impressions and enquiries.`,
            `There were a few areas where I thought small adjustments could help the site communicate your expertise more clearly in those first few seconds.`,
            `I noticed some opportunities to strengthen how the site builds trust with visitors and guides them to the right next step.`
        ];

        const ctas = [
            `If it helps, I'm happy to walk through those ideas briefly over a short call this week or next.`,
            `Happy to share those thoughts on a quick call if that would be useful.`,
            `Let me know if you'd like to discuss. I'm flexible on timing.`
        ];

        const opener = openers[variantIndex % openers.length];
        const value = values[variantIndex % values.length];
        const cta = ctas[variantIndex % ctas.length];

        return this.validateAndClean(`${greeting}

${opener}

${value}

${cta}

Best,
${senderName}`);
    }

    /**
     * ASSERTIVE variant - confident, direct, still respectful
     * Use for: Second follow-up, high opportunity, clear issues detected
     */
    private generateAssertive(
        greeting: string,
        companyName: string,
        senderName: string,
        followUpNumber: number,
        variantIndex: number
    ): string {
        const openers = [
            `I wanted to follow up on my earlier message about ${companyName}'s website.`,
            `Checking back in on the note I sent about ${companyName}'s online presence.`,
            `Following up on my observations about ${companyName}'s site.`
        ];

        const values = [
            `In my experience, early impressions play a big role in whether people feel confident enough to get in touch, and there are a few areas where small changes could make a meaningful difference.`,
            `First impressions often determine whether visitors stay or leave. There are specific improvements that could strengthen how ${companyName} comes across online.`,
            `The way a site presents your work in those first few seconds has a real impact on enquiry rates. I've identified some clear opportunities.`
        ];

        const ctas = [
            `If you're open to it, I'd be happy to run through those observations on a quick call over the next few days.`,
            `Would you have 15 minutes this week to discuss? I can walk through the key points.`,
            `Let me know if you'd like to see specific recommendations. I can share them on a brief call.`
        ];

        const opener = openers[variantIndex % openers.length];
        const value = values[variantIndex % values.length];
        const cta = ctas[variantIndex % ctas.length];

        return this.validateAndClean(`${greeting}

${opener}

${value}

${cta}

Best,
${senderName}`);
    }

    /**
     * ULTRA-SOFT variant - minimal, human, non-intrusive
     * Use for: Low confidence leads, last follow-up, risk of annoyance
     */
    private generateUltraSoft(
        greeting: string,
        companyName: string,
        senderName: string,
        followUpNumber: number,
        variantIndex: number
    ): string {
        const bodies = [
            `Just wanted to briefly check in on the note I sent about ${companyName}'s website. No problem at all if now isn't the right time, but happy to share a couple of thoughts if useful.

Either way, thanks for your time.`,
            `Quick check in on my earlier message about ${companyName}'s site. Completely understand if this isn't a priority right now.

If it is, I'm happy to help.`,
            `Checking in briefly on my note about ${companyName}'s website. No worries if this doesn't fit your plans at the moment.

Just let me know either way.`
        ];

        const body = bodies[variantIndex % bodies.length];

        return this.validateAndClean(`${greeting}

${body}

Best,
${senderName}`);
    }

    /**
     * Get a single variant by name
     */
    getVariant(
        originalSubject: string,
        companyName: string,
        firstName: string | null,
        followUpNumber: number,
        variant: string,
        regenerate: boolean = false
    ): { body: string; subject: string } {
        const variants = this.generateFollowUpVariants(
            originalSubject,
            companyName,
            firstName,
            followUpNumber,
            regenerate
        );

        let body = variants.polite; // Default
        if (variant === 'assertive') body = variants.assertive;
        if (variant === 'ultra-soft') body = variants.ultraSoft;

        return { body, subject: variants.subject };
    }

    /**
     * Legacy method - returns polite variant
     * @deprecated Use generateFollowUpVariants instead
     */
    generateFollowUpDrafts(
        originalSubject: string,
        companyName: string,
        firstName: string | null,
        followUpNumber: number
    ): { callFirst: string; emailIdeasFirst: string } {
        const variants = this.generateFollowUpVariants(originalSubject, companyName, firstName, followUpNumber);
        return {
            callFirst: variants.polite,
            emailIdeasFirst: variants.assertive
        };
    }

    /**
     * Legacy method for backward compatibility
     * @deprecated Use generateFollowUpVariants instead
     */
    generateFollowUp(originalSubject: string, companyName: string, count: number): string {
        const variants = this.generateFollowUpVariants(originalSubject, companyName, null, count + 1);
        return variants.polite;
    }
}

export const outreachGenerator = new OutreachGeneratorService();

