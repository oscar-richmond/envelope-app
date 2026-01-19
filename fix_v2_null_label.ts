/**
 * Fix: One-off V2 record with null label
 * 
 * Handles edge case where a V2 scan wrote success with null label
 */

import prisma from '@/lib/prisma';

async function fixV2NullLabel() {
    console.log('🔧 Fix: V2 record with null label\n');

    const record = await prisma.companyProspect.findFirst({
        where: {
            websiteHealthStatus: 'success',
            websiteHealthLabel: null
        },
        select: {
            id: true,
            companyName: true,
            websiteHealthScore: true,
            websiteHealthLabel: true,
            webHealthData: true,
            websiteHealthVersion: true
        }
    });

    if (!record) {
        console.log('✅ No records with null label found\n');
        return;
    }

    console.log(`Found record ID ${record.id}: ${record.companyName}`);
    console.log(`  Version: ${record.websiteHealthVersion}`);
    console.log(`  Score: ${record.websiteHealthScore}`);
    console.log(`  Label: ${record.websiteHealthLabel}`);
    console.log(`  Report exists: ${!!record.webHealthData}`);
    console.log();

    // If it has a report, extract the label from it
    if (record.webHealthData) {
        try {
            const report = JSON.parse(record.webHealthData);
            console.log(`  Report label: ${report.label}`);

            // Update with label from report
            await prisma.companyProspect.update({
                where: { id: record.id },
                data: {
                    websiteHealthLabel: report.label
                }
            });

            console.log(`\n✅ Fixed: Set label to "${report.label}"`);
        } catch (e) {
            console.log(`\n❌ Error parsing report: ${e}`);
        }
    } else {
        // No report, reset to idle
        await prisma.companyProspect.update({
            where: { id: record.id },
            data: {
                websiteHealthStatus: 'idle',
                websiteHealthScore: null,
                websiteHealthLabel: null,
                webHealthData: null
            }
        });
        console.log(`\n✅ Reset to idle (no report)`);
    }
}

fixV2NullLabel()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Fix failed:', error.message);
        process.exit(1);
    });
