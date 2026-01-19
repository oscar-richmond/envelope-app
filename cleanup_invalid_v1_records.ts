/**
 * One-Time Cleanup: Remove Invalid Version 1 Success Records
 * 
 * Resets corrupted records where:
 * - websiteHealthVersion = 1
 * - websiteHealthStatus = 'success'
 * - AND (websiteHealthLabel IS NULL OR webHealthData IS NULL OR websiteHealthScore = 0)
 * 
 * These records were created by the backfill migration and break UX.
 */

import prisma from '@/lib/prisma';

async function cleanupInvalidV1Records() {
    console.log('🧹 Cleanup: Invalid Version 1 Success Records\n');

    // 1. Find corrupted records
    const corrupted = await prisma.companyProspect.findMany({
        where: {
            AND: [
                { websiteHealthVersion: 1 },
                { websiteHealthStatus: 'success' },
                {
                    OR: [
                        { websiteHealthLabel: null },
                        { webHealthData: null },
                        { websiteHealthScore: 0 }
                    ]
                }
            ]
        },
        select: {
            id: true,
            companyName: true,
            websiteHealthScore: true,
            websiteHealthLabel: true,
            webHealthData: true
        }
    });

    console.log(`Found ${corrupted.length} corrupted records\n`);

    if (corrupted.length === 0) {
        console.log('✅ No corrupted records found. Database is clean!\n');
        return;
    }

    // 2. Show sample
    console.log('Sample corrupted records:');
    corrupted.slice(0, 5).forEach(c => {
        console.log(`  - ID ${c.id}: ${c.companyName}`);
        console.log(`    Score: ${c.websiteHealthScore}, Label: ${c.websiteHealthLabel}, Report: ${c.webHealthData ? 'exists' : 'NULL'}`);
    });
    console.log();

    // 3. Confirm before cleanup
    console.log('⚠️  About to reset these records to idle state (score=null, label=null, scannedAt=null)\n');

    // 4. Perform cleanup
    const result = await prisma.companyProspect.updateMany({
        where: {
            AND: [
                { websiteHealthVersion: 1 },
                { websiteHealthStatus: 'success' },
                {
                    OR: [
                        { websiteHealthLabel: null },
                        { webHealthData: null },
                        { websiteHealthScore: 0 }
                    ]
                }
            ]
        },
        data: {
            websiteHealthStatus: 'idle',
            websiteHealthScore: null,
            websiteHealthLabel: null,
            websiteHealthScannedAt: null,
            websiteHealthError: null,
            webHealthData: null,
            // Keep version=1 to mark as "migrated but reset"
            websiteHealthTraceId: null,
            websiteHealthLastWriter: 'cleanup_script',
            websiteHealthLastSurface: 'admin'
        }
    });

    console.log(`✅ Reset ${result.count} records to idle state\n`);

    // 5. Verify cleanup
    const remaining = await prisma.companyProspect.count({
        where: {
            AND: [
                { websiteHealthStatus: 'success' },
                {
                    OR: [
                        { websiteHealthLabel: null },
                        { webHealthData: null },
                        { websiteHealthScore: 0 }
                    ]
                }
            ]
        }
    });

    if (remaining > 0) {
        console.log(`⚠️  WARNING: ${remaining} success records still have null label/report or score=0`);
        console.log('   These may be version=2 records with issues. Investigate manually.\n');
    } else {
        console.log('✅ VERIFIED: Zero success records with null label/report or score=0\n');
    }

    // 6. Summary
    console.log('Summary:');
    console.log(`  - Found: ${corrupted.length} corrupted records`);
    console.log(`  - Reset: ${result.count} records`);
    console.log(`  - Remaining issues: ${remaining}`);
    console.log();
}

cleanupInvalidV1Records()
    .then(() => {
        console.log('✅ Cleanup complete');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Cleanup failed:', error.message);
        process.exit(1);
    });
