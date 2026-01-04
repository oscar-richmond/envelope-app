
import { websiteAnalysisService } from '../src/lib/services/website-analysis';

async function main() {
    console.log("Starting Analysis Test...");

    const testUrls = [
        'https://example.com', // Simple, likely stale or minimal
        'https://vercel.com',  // Modern, active
    ];

    for (const url of testUrls) {
        console.log(`\nAnalyzing: ${url}`);
        const start = Date.now();
        const result = await websiteAnalysisService.analyze(url);
        const duration = Date.now() - start;

        console.log(`Duration: ${duration}ms`);
        console.log(`Score: ${result.stalenessScore} (Confidence: ${result.confidence})`);
        console.log("Reasons:", result.reasons);
        console.log("Signals:", JSON.stringify(result.signals, null, 2));
    }
}

main().catch(console.error);
