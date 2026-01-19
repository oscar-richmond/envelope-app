/**
 * Test: Valid Scan Invariant
 * 
 * Verifies that runWebsiteHealthScan MUST write status='success' 
 * with a full report when scanning a valid URL.
 */

import prisma from '@/lib/prisma';
import { runWebsiteHealthScan } from '@/lib/websiteHealth/runScan';

async function testValidScanInvariant() {
    console.log('🧪 Test: Valid Scan Invariant\n');

    // 1. Create company with valid URL
    const company = await prisma.companyProspect.create({
        data: {
            companyName: 'Test Valid URL',
            companyNumber: 'TEST002',
            websiteUrl: 'https://google.com' // Well-known valid URL
        }
    });
    console.log(`✓ Created test company ID ${company.id} with URL: ${company.websiteUrl}`);

    try {
        // 2. Run scan
        const result = await runWebsiteHealthScan({
            companyId: company.id,
            initiatedFrom: 'api'
        });

        // 3. Verify result
        if (result.status !== 'success') {
            throw new Error(`❌ Expected status='success', got '${result.status}'. Error: ${result.error}`);
        }
        console.log(`✓ Scanner returned status='success'`);

        if (typeof result.finalScore !== 'number') {
            throw new Error(`❌ Score should be numeric, got ${typeof result.finalScore}`);
        }
        console.log(`✓ Final score is numeric: ${result.finalScore}`);

        if (result.factorsCount <= 0) {
            throw new Error(`❌ Should have factors, got ${result.factorsCount}`);
        }
        console.log(`✓ Has ${result.factorsCount} factors`);

        if (!result.label) {
            throw new Error(`❌ Should have label`);
        }
        console.log(`✓ Has label: "${result.label}"`);

        // 4. Verify DB state
        const readback = await prisma.companyProspect.findUnique({
            where: { id: company.id },
            select: {
                websiteHealthStatus: true,
                websiteHealthScore: true,
                websiteHealthLabel: true,
                webHealthData: true,
                websiteHealthVersion: true,
                websiteHealthTraceId: true,
                websiteHealthLastWriter: true,
                websiteHealthLastSurface: true
            }
        });

        // DB Assertions
        if (readback!.websiteHealthStatus !== 'success') {
            throw new Error(`❌ DB status should be 'success', got '${readback!.websiteHealthStatus}'`);
        }
        console.log(`✓ DB has status='success'`);

        if (readback!.websiteHealthScore === null || readback!.websiteHealthScore === undefined) {
            throw new Error(`❌ Score should NOT be null`);
        }
        console.log(`✓ Score exists: ${readback!.websiteHealthScore}`);

        if (!readback!.websiteHealthLabel) {
            throw new Error(`❌ Label should NOT be null`);
        }
        console.log(`✓ Label exists: "${readback!.websiteHealthLabel}"`);

        if (!readback!.webHealthData) {
            throw new Error(`❌ Report data should exist`);
        }
        console.log(`✓ Report data exists`);

        if (readback!.websiteHealthVersion !== 2) {
            throw new Error(`❌ Version should be 2, got ${readback!.websiteHealthVersion}`);
        }
        console.log(`✓ Version is 2`);

        if (!readback!.websiteHealthTraceId) {
            throw new Error(`❌ TraceId should exist`);
        }
        console.log(`✓ TraceId exists: ${readback!.websiteHealthTraceId}`);

        if (readback!.websiteHealthLastWriter !== 'runWebsiteHealthScan') {
            throw new Error(`❌ Writer should be 'runWebsiteHealthScan', got '${readback!.websiteHealthLastWriter}'`);
        }
        console.log(`✓ LastWriter is 'runWebsiteHealthScan'`);

        if (readback!.websiteHealthLastSurface !== 'api') {
            throw new Error(`❌ Surface should be 'api', got '${readback!.websiteHealthLastSurface}'`);
        }
        console.log(`✓ LastSurface is 'api'`);

        // 5. Verify report structure
        const report = JSON.parse(readback!.webHealthData!);

        if (report.version !== 2) {
            throw new Error(`❌ Report version should be 2, got ${report.version}`);
        }
        console.log(`✓ Report version: ${report.version}`);

        if (!Array.isArray(report.factors) || report.factors.length === 0) {
            throw new Error(`❌ Report should have factors array with length > 0`);
        }
        console.log(`✓ Report has ${report.factors.length} factors`);

        if (typeof report.score !== 'number') {
            throw new Error(`❌ Report should have numeric score`);
        }
        console.log(`✓ Report score: ${report.score}`);

        if (!report.label) {
            throw new Error(`❌ Report should have label`);
        }
        console.log(`✓ Report label: "${report.label}"`);

        if (!report.traceId) {
            throw new Error(`❌ Report should have traceId`);
        }
        console.log(`✓ Report traceId: ${report.traceId}`);

        // 6. Verify score consistency
        if (readback!.websiteHealthScore !== report.score) {
            throw new Error(`❌ DB score (${readback!.websiteHealthScore}) should match report score (${report.score})`);
        }
        console.log(`✓ DB score matches report score`);

        console.log('\n✅ TEST PASSED: Valid URL → success + full report with all metadata');

    } finally {
        // Cleanup
        await prisma.companyProspect.delete({ where: { id: company.id } });
        console.log(`✓ Cleaned up test company\n`);
    }
}

testValidScanInvariant()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('\n❌ TEST FAILED:', error.message);
        process.exit(1);
    });
