/**
 * Verification: Prove Zero Invalid Success Records
 * 
 * Queries database to confirm there are NO records where:
 * - status = 'success'
 * - BUT report is null/missing OR label is null OR score is 0
 */

import prisma from '@/lib/prisma';

async function verifyNoInvalidSuccessRecords() {
    console.log('🔍 Verification: Zero Invalid Success Records\n');

    // Test 1: Success with null report
    const successNoReport = await prisma.companyProspect.count({
        where: {
            websiteHealthStatus: 'success',
            webHealthData: null
        }
    });

    console.log(`Test 1: Success + NULL report: ${successNoReport}`);
    if (successNoReport > 0) {
        console.log(`  ❌ FAIL: Found ${successNoReport} success records with null report`);
    } else {
        console.log(`  ✅ PASS: No success records with null report`);
    }
    console.log();

    // Test 2: Success with null label
    const successNoLabel = await prisma.companyProspect.count({
        where: {
            websiteHealthStatus: 'success',
            websiteHealthLabel: null
        }
    });

    console.log(`Test 2: Success + NULL label: ${successNoLabel}`);
    if (successNoLabel > 0) {
        console.log(`  ❌ FAIL: Found ${successNoLabel} success records with null label`);
    } else {
        console.log(`  ✅ PASS: No success records with null label`);
    }
    console.log();

    // Test 3: Success with score=0
    const successScoreZero = await prisma.companyProspect.count({
        where: {
            websiteHealthStatus: 'success',
            websiteHealthScore: 0
        }
    });

    console.log(`Test 3: Success + score=0: ${successScoreZero}`);
    if (successScoreZero > 0) {
        console.log(`  ❌ FAIL: Found ${successScoreZero} success records with score=0`);
    } else {
        console.log(`  ✅ PASS: No success records with score=0`);
    }
    console.log();

    // Test 4: Version=1 success records still exist?
    const v1Success = await prisma.companyProspect.count({
        where: {
            websiteHealthVersion: 1,
            websiteHealthStatus: 'success'
        }
    });

    console.log(`Test 4: Version=1 + success: ${v1Success}`);
    if (v1Success > 0) {
        console.log(`  ⚠️  WARNING: ${v1Success} version=1 success records exist`);
        console.log(`  These should be handled by UI (show as "Not Scanned" via getWebsiteHealthStatus)`);
    } else {
        console.log(`  ✅ PASS: No version=1 success records`);
    }
    console.log();

    // Test 5: All V2 success records have reports
    const v2SuccessTotal = await prisma.companyProspect.count({
        where: {
            websiteHealthVersion: 2,
            websiteHealthStatus: 'success'
        }
    });

    const v2SuccessWithReport = await prisma.companyProspect.count({
        where: {
            websiteHealthVersion: 2,
            websiteHealthStatus: 'success',
            webHealthData: { not: null }
        }
    });

    console.log(`Test 5: V2 Success Records: ${v2SuccessTotal} total, ${v2SuccessWithReport} with report`);
    if (v2SuccessTotal !== v2SuccessWithReport) {
        console.log(`  ❌ FAIL: ${v2SuccessTotal - v2SuccessWithReport} V2 success records missing reports`);
    } else {
        console.log(`  ✅ PASS: All V2 success records have reports`);
    }
    console.log();

    // Summary
    const totalFails =
        (successNoReport > 0 ? 1 : 0) +
        (successNoLabel > 0 ? 1 : 0) +
        (successScoreZero > 0 ? 1 : 0) +
        (v2SuccessTotal !== v2SuccessWithReport ? 1 : 0);

    console.log('─'.repeat(60));
    if (totalFails === 0) {
        console.log('✅ VERIFICATION PASSED: Zero invalid success records');
        console.log('   Database integrity confirmed.');
    } else {
        console.log(`❌ VERIFICATION FAILED: ${totalFails} test(s) failed`);
        console.log('   Database still has invalid success records.');
        process.exit(1);
    }
    console.log('─'.repeat(60));
    console.log();
}

verifyNoInvalidSuccessRecords()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Verification error:', error.message);
        process.exit(1);
    });
