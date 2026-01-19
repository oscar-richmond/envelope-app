import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/heal-health-data
 * 
 * Identifies and resets corrupted health records where:
 * 1. Status is 'success' BUT no underlying report data exists
 * 2. Status is 'success' BUT version is not V2
 * 
 * Query params:
 * - confirm=true (required to actually execute writes)
 */
export async function POST(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const confirm = searchParams.get('confirm') === 'true';

        // 1. Identify Valid but Corrupted Website Health Records
        // (Status success/scanning but missing data or wrong version)
        const corruptedWebsiteRecords = await prisma.companyProspect.findMany({
            where: {
                OR: [
                    // Case A: Marked success but no report data
                    {
                        websiteHealthStatus: 'success',
                        webHealthData: null
                    },
                    // Case B: Marked success but V1 (should be V2)
                    {
                        websiteHealthStatus: 'success',
                        NOT: {
                            websiteHealthVersion: 2
                        }
                    },
                    // Case C: Stuck in scanning for > 1 hour
                    {
                        websiteHealthStatus: 'scanning',
                        websiteHealthScannedAt: {
                            lt: new Date(Date.now() - 60 * 60 * 1000)
                        }
                    }
                ]
            },
            select: { id: true, websiteHealthStatus: true, websiteHealthVersion: true }
        });

        // 2. Identify Valid but Corrupted Financial Health Records
        const corruptedFinancialRecords = await prisma.companyProspect.findMany({
            where: {
                OR: [
                    // Case A: Marked success but no report data
                    {
                        financialHealthStatus: 'success',
                        finHealthData: null
                    },
                    // Case B: Marked success but V1
                    {
                        financialHealthStatus: 'success',
                        NOT: {
                            financialHealthVersion: 2
                        }
                    },
                    // Case C: Stuck in scanning
                    {
                        financialHealthStatus: 'scanning',
                        financialLastCheckedAt: {
                            lt: new Date(Date.now() - 60 * 60 * 1000)
                        }
                    }
                ]
            },
            select: { id: true, financialHealthStatus: true, financialHealthVersion: true }
        });

        const stats = {
            website: corruptedWebsiteRecords.length,
            financial: corruptedFinancialRecords.length
        };

        if (!confirm) {
            return NextResponse.json({
                message: 'Dry run complete. Use ?confirm=true to execute reset.',
                stats,
                examples: {
                    website: corruptedWebsiteRecords.slice(0, 5),
                    financial: corruptedFinancialRecords.slice(0, 5)
                }
            });
        }

        // 3. Execute Updates
        const websiteIds = corruptedWebsiteRecords.map(r => r.id);
        const financialIds = corruptedFinancialRecords.map(r => r.id);
        // 2. Heal Website Health (Invalid Success State)
        // Find companies with status='success' but NO report data or INVALID score
        const corruptedWeb = await prisma.companyProspect.findMany({
            where: {
                websiteHealthStatus: 'success',
                OR: [
                    { webHealthData: null },
                    { websiteHealthVersion: { not: 2 } },
                    { websiteHealthScore: null } // Should not happen in valid V2
                ]
            },
            take: 100
        });

        const webResults = [];
        for (const company of corruptedWeb) {
            // Reset to clean specific fields
            await prisma.companyProspect.update({
                where: { id: company.id },
                data: {
                    websiteHealthStatus: 'not_scanned',
                    websiteHealthScore: null,
                    websiteHealthLabel: null,
                    webHealthData: null,
                    websiteHealthVersion: 2, // Reset version
                    websiteHealthError: 'Healed: Invalid Success State'
                }
            });
            webResults.push(company.id);
        }

        // 3. Heal Financial Health
        const corruptedFin = await prisma.companyProspect.findMany({
            where: {
                financialHealthStatus: 'success',
                OR: [
                    { finHealthData: null },
                    { financialHealthVersion: { not: 2 } },
                    { financialHealthScore: null }
                ]
            },
            take: 100
        });

        const finResults = [];
        for (const company of corruptedFin) {
            await prisma.companyProspect.update({
                where: { id: company.id },
                data: {
                    financialHealthStatus: 'not_scanned',
                    financialHealthScore: null,
                    financialHealthLabel: null,
                    finHealthData: null,
                    financialHealthVersion: 2,
                    financialHealthError: 'Healed: Invalid Success State'
                }
            });
            finResults.push(company.id);
        }

        return NextResponse.json({
            success: true,
            healed: {
                website: { count: webResults.length, ids: webResults },
                financial: { count: finResults.length, ids: finResults }
            }
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
