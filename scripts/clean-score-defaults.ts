// Data Migration Script - Clean up score=0 defaults
// Purpose: Set score=null for companies that were never actually scanned/checked
// Run this after schema migration completes

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🧹 Starting data cleanup: Removing score=0 defaults for unscanned companies...\n');

    // 1. CompanyProspect: stalenessScore
    console.log('1️⃣  Cleaning stalenessScore...');
    const stalenessResult = await prisma.companyProspect.updateMany({
        where: {
            stalenessScore: 0,
            lastAnalysedAt: null,
            websiteHealthStatus: null,
        },
        data: {
            stalenessScore: null,
        },
    });
    console.log(`   ✅ Updated ${stalenessResult.count} companies with stalenessScore = null\n`);

    // 2. CompanyProspect: financialActivityScore
    console.log('2️⃣  Cleaning financialActivityScore...');
    const financialResult = await prisma.companyProspect.updateMany({
        where: {
            financialActivityScore: 0,
            financialLastCheckedAt: null,
        },
        data: {
            financialActivityScore: null,
        },
    });
    console.log(`   ✅ Updated ${financialResult.count} companies with financialActivityScore = null\n`);

    // 3. CompanyProspect: contactPriorityScore
    console.log('3️⃣  Cleaning contactPriorityScore...');
    const priorityResult = await prisma.companyProspect.updateMany({
        where: {
            contactPriorityScore: 0,
            contactPriorityLastCalculatedAt: null,
        },
        data: {
            contactPriorityScore: null,
        },
    });
    console.log(`   ✅ Updated ${priorityResult.count} companies with contactPriorityScore = null\n`);

    // Verification: Sample 10 companies
    console.log('📊 Verification - Sample 10 companies:');
    const sample = await prisma.companyProspect.findMany({
        take: 10,
        orderBy: { updatedAt: 'desc' },
        select: {
            id: true,
            companyName: true,
            stalenessScore: true,
            lastAnalysedAt: true,
            websiteHealthStatus: true,
            websiteHealthScore: true,
            financialActivityScore: true,
            financialLastCheckedAt: true,
        },
    });

    console.table(
        sample.map((c) => ({
            id: c.id,
            name: c.companyName.substring(0, 30),
            'staleness (legacy)': c.stalenessScore ?? 'null',
            'health status (new)': c.websiteHealthStatus ?? 'null',
            'health score (new)': c.websiteHealthScore ?? 'null',
            'financial': c.financialActivityScore ?? 'null',
        }))
    );

    // Count statistics
    const stats = {
        unscanned: await prisma.companyProspect.count({
            where: { stalenessScore: null },
        }),
        legitimate_zero: await prisma.companyProspect.count({
            where: {
                stalenessScore: 0,
                lastAnalysedAt: { not: null },
            },
        }),
        scanned_non_zero: await prisma.companyProspect.count({
            where: {
                stalenessScore: { gt: 0 },
            },
        }),
    };

    console.log('\n📈 Statistics:');
    console.log(`   • Unscanned (score=null): ${stats.unscanned}`);
    console.log(`   • Legitimate score=0 (Fresh sites): ${stats.legitimate_zero}`);
    console.log(`   • Scores > 0: ${stats.scanned_non_zero}`);

    console.log('\n✅ Data cleanup complete!');
}

main()
    .catch((e) => {
        console.error('❌ Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
