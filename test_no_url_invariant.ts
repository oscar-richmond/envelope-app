/**
 * Test: No URL Invariant
 * 
 * Verifies that runWebsiteHealthScan CANNOT write status='success' 
 * when a company has no website URL.
 */

import prisma from '@/lib/prisma';
import { runWebsiteHealthScan } from '@/lib/websiteHealth/runScan';

async function testNoUrlInvariant() {
    console.log('🧪 Test: No URL Invariant\n');

    // 1. Create company with no URL
    const company = await prisma.companyProspect.create({
        data: {
            companyName: 'Test No URL',
            companyNumber: 'TEST001',
            websiteUrl: null // NO URL
        }
    });
    console.log(`✓ Created test company ID ${company.id} with NO URL`);

    try {
        // 2. Run scan
        const result = await runWebsiteHealthScan({
            companyId: company.id,
            initiatedFrom: 'api'
        });

        // 3. Verify result
        if (result.status !== 'error') {
            throw new Error(`❌ Expected status='error', got '${result.status}'`);
        }
        console.log(`✓ Scanner returned status='error'`);

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
                websiteHealthLastWriter: true
            }
        });

        // Assertions
        if (readback!.websiteHealthStatus !== 'error') {
            throw new Error(`❌ DB status should be 'error', got '${readback!.websiteHealthStatus}'`);
        }
        console.log(`✓ DB has status='error'`);

        if (readback!.websiteHealthScore !== null) {
            throw new Error(`❌ Score should be null, got ${readback!.websiteHealthScore}`);
        }
        console.log(`✓ Score is null`);

        if (readback!.websiteHealthLabel !== null) {
            throw new Error(`❌ Label should be null, got '${readback!.websiteHealthLabel}'`);
        }
        console.log(`✓ Label is null`);

        if (readback!.webHealthData !== null) {
            throw new Error(`❌ Report should be null, got data`);
        }
        console.log(`✓ Report data is null`);

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

        console.log('\n✅ TEST PASSED: No URL → error state with null score/label/report');

    } finally {
        // Cleanup
        await prisma.companyProspect.delete({ where: { id: company.id } });
        console.log(`✓ Cleaned up test company\n`);
    }
}

testNoUrlInvariant()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('\n❌ TEST FAILED:', error.message);
        process.exit(1);
    });
