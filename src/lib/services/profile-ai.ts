
import OpenAI from 'openai';
import prisma from '@/lib/prisma';
import { CompanyProspect } from '@prisma/client';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

interface AIProfileContent {
    oneLiner: string;
    overview: string;
    reputationSummary: string | null;
}

export class ProfileAIService {

    /**
     * Generate AI summaries for a prospect profile
     */
    async generateSummaries(prospect: CompanyProspect): Promise<AIProfileContent | null> {
        // Check minimum requirements
        const displayName = prospect.displayBrandName || prospect.companyName;
        if (!displayName) return null;

        const hasContext = prospect.placesCategory || prospect.websiteUrl || prospect.placesFormattedAddress;
        if (!hasContext) return null;

        // Build grounded inputs
        const inputs = this.buildInputs(prospect);

        try {
            const content = await this.callOpenAI(inputs);

            // Store the generated content
            await prisma.companyProspect.update({
                where: { id: prospect.id },
                data: {
                    aiOneLiner: content.oneLiner,
                    aiOverview: content.overview,
                    aiReputationSummary: content.reputationSummary,
                    aiGeneratedAt: new Date(),
                    aiInputsSnapshot: JSON.stringify(inputs),
                    aiModelVersion: 'gpt-4o-mini'
                }
            });

            return content;
        } catch (error) {
            console.error('AI generation failed:', error);
            return null;
        }
    }

    /**
     * Build strictly grounded inputs for AI
     */
    private buildInputs(prospect: CompanyProspect): Record<string, any> {
        const inputs: Record<string, any> = {
            displayName: prospect.displayBrandName || prospect.companyName
        };

        if (prospect.placesCategory) {
            inputs.category = this.formatCategory(prospect.placesCategory);
        }
        if (prospect.placesFormattedAddress) {
            inputs.location = this.extractArea(prospect.placesFormattedAddress);
        }
        if (prospect.websiteUrl) {
            inputs.hasWebsite = true;
            inputs.domain = prospect.websiteDomain;
        }
        if (prospect.placesRating && prospect.placesReviewCount) {
            inputs.rating = prospect.placesRating;
            inputs.reviewCount = prospect.placesReviewCount;
        }
        if (prospect.stalenessScore !== null) {
            inputs.websiteStalenessBand = this.getStalenessBand(prospect.stalenessScore);
        }
        if (prospect.financialActivityBand) {
            inputs.financialActivityBand = prospect.financialActivityBand;
        }
        if (prospect.contactPriorityBand) {
            inputs.leadOpportunityBand = prospect.contactPriorityBand;
        }

        return inputs;
    }

    /**
     * Call OpenAI with strictly grounded prompt
     */
    private async callOpenAI(inputs: Record<string, any>): Promise<AIProfileContent> {
        const systemPrompt = `You are generating factual company profile summaries. You must ONLY use the provided inputs. Do not invent any information.

Rules:
- UK English spelling
- Neutral, businesslike tone
- No sales language
- No adjectives like "leading" unless present in inputs
- Do not invent: years in business, clients, awards, certifications, team size, specific services beyond category

If uncertain about something, omit it.`;

        const userPrompt = `Generate a company profile summary based on these facts ONLY:

${JSON.stringify(inputs, null, 2)}

Respond in JSON format:
{
  "oneLiner": "One factual sentence describing the business (max 15 words)",
  "overview": "2-4 neutral sentences describing the business based on available facts",
  "reputationSummary": ${inputs.rating ? '"2-3 bullet points about their reputation based on rating and review count, or null if no rating data"' : 'null'}
}`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.3,
            max_tokens: 500
        });

        const content = response.choices[0]?.message?.content;
        if (!content) throw new Error('No response from OpenAI');

        const parsed = JSON.parse(content);
        return {
            oneLiner: parsed.oneLiner || '',
            overview: parsed.overview || '',
            reputationSummary: parsed.reputationSummary || null
        };
    }

    /**
     * Format Google Places category to readable text
     */
    private formatCategory(category: string): string {
        // e.g. "accounting" -> "Accounting", "restaurant" -> "Restaurant"
        return category
            .replace(/_/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase());
    }

    /**
     * Extract area/city from full address
     */
    private extractArea(address: string): string {
        // Try to get the city from a UK-style address
        const parts = address.split(',').map(p => p.trim());
        if (parts.length >= 2) {
            // Usually city is second-to-last before postcode
            return parts[parts.length - 2] || parts[0];
        }
        return parts[0] || address;
    }

    /**
     * Get staleness band from score
     */
    private getStalenessBand(score: number): string {
        if (score >= 70) return 'Outdated';
        if (score >= 40) return 'Moderate';
        return 'Fresh';
    }

    /**
     * Check if AI summaries need regeneration
     */
    needsRegeneration(prospect: CompanyProspect): boolean {
        if (!prospect.aiGeneratedAt) return true;
        if (!prospect.aiOneLiner) return true;

        // Check if key inputs have changed since generation
        if (!prospect.aiInputsSnapshot) return true;

        try {
            const oldInputs = JSON.parse(prospect.aiInputsSnapshot);
            const newInputs = this.buildInputs(prospect);

            // Compare key fields
            if (oldInputs.displayName !== newInputs.displayName) return true;
            if (oldInputs.category !== newInputs.category) return true;
            if (oldInputs.rating !== newInputs.rating) return true;

            return false;
        } catch {
            return true;
        }
    }
}

export const profileAIService = new ProfileAIService();
