/**
 * Backfill Script: Website Health Fields
 * 
 * Migrates data from legacy fields (stalenessScore, lastAnalysedAt) 
 * to new canonical fields (websiteHealthStatus, websiteHealthScore, etc.)
 * 
 * Usage:
 *   npx tsx scripts/backfill-website-health.ts [--dry-run] [--batch-size=100]
 * 
 * Features:
 * - Batched processing to avoid memory issues
 * - Dry-run mode for testing
 * - Progress logging
 * - Resumable via cursor
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface BackfillOptions {
    dryRun: boolean;
    batchSize: number;
    startFromId?: number;
}

interface BackfillResult {
    total: number;
    updated: number;
    skipped: number;
    errors: number;
}

async function backfillWebsiteHealth(options: BackfillOptions): Promise<BackfillResult> {
    const { dryRun, batchSize, startFromId } = options;
    
    console.log(`\n🔄 Starting Website Health Backfill`);
    console.log(`   Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE'}`);
    console.log(`   Batch size: ${batchSize}`);
    if (startFromId) console.log(`   Starting from ID: ${startFromId}`);
    console.log('');

    const result: BackfillResult = {
        total: 0,
        updated: 0,
        skipped: 0,
        errors: 0
    };

    let cursor: number | undefined = startFromId;
    let batchNumber = 0;

    while (true) {
        batchNumber++;
        
        // Fetch batch of prospects
        const prospects = await prisma.companyProspect.findMany({
            where: cursor ? { id: { gt: cursor } } : undefined,
            orderBy: { id: 'asc' },
            take: batchSize,
            select: {
                id: true,
                stalenessScore: true,
                lastAnalysedAt: true,
                websiteHealthStatus: true,
                websiteHealthScore: true,
            }
        });

        if (prospects.length === 0) {
            console.log(`\n✅ Backfill complete!`);
            break;
        }

        console.log(`📦 Batch ${batchNumber}: Processing ${prospects.length} records (IDs ${prospects[0].id} - ${prospects[prospects.length - 1].id})`);

        for (const prospect of prospects) {
            result.total++;

            // Skip if already backfilled
            if (prospect.websiteHealthStatus !== null) {
                result.skipped++;
                continue;
            }

            // Determine new values based on legacy data
            const wasScanned = prospect.lastAnalysedAt !== null;
            
            const newData = {
                websiteHealthStatus: wasScanned ? 'success' : 'idle',
                websiteHealthScore: wasScanned ? prospect.stalenessScore : null,
                websiteHealthScannedAt: wasScanned ? prospect.lastAnalysedAt : null,
                websiteHealthError: null,
                websiteHealthVersion: 1
            };

            if (dryRun) {
                console.log(`   [DRY] ID ${prospect.id}: ${wasScanned ? `scanned (score: ${prospect.stalenessScore})` : 'not scanned'}`);
            } else {
                try {
                    await prisma.companyProspect.update({
                        where: { id: prospect.id },
                        data: newData
                    });
                } catch (error) {
                    console.error(`   ❌ Error updating ID ${prospect.id}:`, error);
                    result.errors++;
                    continue;
                }
            }

            result.updated++;
        }

        // Update cursor for next batch
        cursor = prospects[prospects.length - 1].id;
        
        // Progress summary
        const scannedCount = prospects.filter(p => p.lastAnalysedAt !== null).length;
        console.log(`   → ${scannedCount}/${prospects.length} were previously scanned`);
    }

    // Final summary
    console.log('\n📊 Summary:');
    console.log(`   Total processed: ${result.total}`);
    console.log(`   Updated: ${result.updated}`);
    console.log(`   Skipped (already migrated): ${result.skipped}`);
    console.log(`   Errors: ${result.errors}`);

    return result;
}

async function main() {
    const args = process.argv.slice(2);
    
    const options: BackfillOptions = {
        dryRun: args.includes('--dry-run'),
        batchSize: 100
    };

    // Parse batch size
    const batchArg = args.find(a => a.startsWith('--batch-size='));
    if (batchArg) {
        options.batchSize = parseInt(batchArg.split('=')[1], 10);
    }

    // Parse start ID
    const startArg = args.find(a => a.startsWith('--start-from='));
    if (startArg) {
        options.startFromId = parseInt(startArg.split('=')[1], 10);
    }

    try {
        await backfillWebsiteHealth(options);
    } catch (error) {
        console.error('❌ Backfill failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
