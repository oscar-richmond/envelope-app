import prisma from '@/lib/prisma';

export type DraftResult = {
    subjectLine1: string;
    subjectLine2: string;
    emailBody: string;
};

// Mock LLM function (real one would use OpenAI/Anthropic SDK)
async function callLLM(prompt: string, apiKey: string): Promise<DraftResult> {
    // In a real implementation:
    // const completion = await openai.chat.completions.create({...})
    // For now, simulate different output based on randomness or prompt
    return {
        subjectLine1: "Partnership opportunity",
        subjectLine2: "Quick question",
        emailBody: "Simulated LLM Response:\n\n" + prompt.substring(0, 50) + "..."
    };
}

// Deterministic Template Fallback
function generateTemplate(lead: any, reasons: string[]): DraftResult {
    const company = lead.companyName;
    const industry = lead.industry || "your industry";

    // Pick the most impactful reason
    let observation = "I was reviewing your website functionality.";
    if (reasons.some(r => r.includes("Content update") || r.includes("24 months"))) {
        observation = "I noticed your content updates have been quiet recently.";
    } else if (reasons.some(r => r.includes("Mobile"))) {
        observation = "I noticed the mobile experience could be optimised.";
    } else if (reasons.some(r => r.includes("Copyright"))) {
        observation = "I noticed the copyright date is a bit behind.";
    }

    return {
        subjectLine1: `Quick question about ${company}'s website`,
        subjectLine2: `Partnership logic for ${company}`,
        emailBody: `Hi [Name],\n\nI was just browsing the ${company} website today and ${observation.toLowerCase()}\n\nWe help companies in the ${industry} space modernize their web presence without a total rebuild. \n\nAre you open to a quick chat next week?\n\nBest,\n[Your Name]`
    };
}

export async function draftEmail(lead: any): Promise<DraftResult & { version: number }> {
    // 1. Get previous drafts to determine version
    const previousDrafts = await prisma.emailDraft.findMany({
        where: { leadId: lead.id }
    });
    const nextVersion = previousDrafts.length + 1;

    // 2. Draft Content
    // Check for API Key in Settings (Mock)
    // const settings = await prisma.settings.findFirst();
    // const apiKey = settings?.openaiApiKey;
    const apiKey = process.env.OPENAI_API_KEY;

    let result: DraftResult;
    let reasons: string[] = [];
    try { reasons = JSON.parse(lead.scoreReasons || '[]'); } catch (e) { }

    if (apiKey) {
        // Use LLM
        // Placeholder for actual call
        result = generateTemplate(lead, reasons);
        // If we had real LLM logic, we'd pass detailed prompt here.
    } else {
        result = generateTemplate(lead, reasons);
    }

    // 3. Persist Draft Version
    await prisma.emailDraft.create({
        data: {
            leadId: lead.id,
            version: nextVersion,
            subjectLine1: result.subjectLine1,
            subjectLine2: result.subjectLine2,
            body: result.emailBody
        }
    });

    return { ...result, version: nextVersion };
}
