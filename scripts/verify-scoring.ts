import { priorityCalculator } from '../src/lib/services/priority-calculator';

function bandToVal(b: string) {
    if (b === 'High') return 3;
    if (b === 'Medium') return 2;
    return 1;
}

console.log("--- Verifying Lead Opportunity Scoring ---");

const tests = [
    {
        name: "Strong Fin + Design Opp",
        input: { staleness: 45, financial: 80, confidence: 'HIGH' },
        expected: { minBand: 'Medium' }
    },
    {
        name: "Strong Fin + Fresh Site",
        input: { staleness: 10, financial: 80, confidence: 'HIGH' },
        expected: { minBand: 'Medium' }
    },
    {
        name: "Low Confidence Cap",
        input: { staleness: 100, financial: 10, confidence: 'LOW' },
        expected: { minScore: 0 }
    }
];

tests.forEach((testCase) => {
    const { name, input, expected } = testCase;

    const result = priorityCalculator.calculate({
        stalenessScore: input.staleness || 0,
        financialScore: input.financial || 0
    });

    // Check Band
    let pass = true;
    if (expected.minBand && bandToVal(result.band) < bandToVal(expected.minBand)) {
        console.error(`FAIL [${name}]: Band ${result.band} is below min ${expected.minBand}`);
        pass = false;
    }

    // Check Score Range if needed
    if (expected.minScore && result.score < expected.minScore) {
        console.error(`FAIL [${name}]: Score ${result.score} < ${expected.minScore}`);
        pass = false;
    }

    if (pass) console.log(`PASS [${name}]: Score ${result.score} (${result.band})`);
    else console.log(`   -> Input: ${JSON.stringify(input)}`);
});
