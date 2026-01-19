import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const COMPANIES_HOUSE_API_KEY = process.env.COMPANIES_HOUSE_API_KEY;
const BATCH_SIZE = 50;
const DELAY_BETWEEN_BATCHES_MS = 2000;

/**
 * Backfill Incorporation Date
 * 
 * Finds companies with companyNumber but no incorporatedOn,
 * fetches from Companies House, and persists the date.
 * 
 * Rate-limited and resumable via lastProcessedId query param.
 */

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const lastProcessedId = parseInt(searchParams.get('lastProcessedId') || '0');
    const limit = parseInt(searchParams.get('limit') || String(BATCH_SIZE));
    const dryRun = searchParams.get('dryRun') === 'true';

    if (!COMPANIES_HOUSE_API_KEY) {
        return NextResponse.json({
            error: 'COMPANIES_HOUSE_API_KEY not configured'
        }, { status: 500 });
    }

    try {
        // Find companies needing backfill
        const companies = await prisma.companyProspect.findMany({
            where: {
                companyNumber: { not: undefined },
                OR: [
                    { incorporatedOn: null },
                    { incorporatedOnLastSyncedAt: null }
                ],
                id: { gt: lastProcessedId }
            },
            select: {
                id: true,
                companyNumber: true,
                companyName: true,
                incorporatedOn: true
            },
            orderBy: { id: 'asc' },
            take: limit
        });

        if (companies.length === 0) {
            return NextResponse.json({
                status: 'complete',
                message: 'No more companies to backfill',
                processed: 0,
                lastProcessedId
            });
        }

        const results: {
            id: number;
            companyNumber: string;
            status: 'updated' | 'skipped' | 'error';
            incorporatedOn?: string;
            error?: string;
        }[] = [];

        const auth = Buffer.from(`${COMPANIES_HOUSE_API_KEY}:`).toString('base64');

        for (const company of companies) {
            if (dryRun) {
                results.push({
                    id: company.id,
                    companyNumber: company.companyNumber!,
                    status: 'skipped'
                });
                continue;
            }

            try {
                // Fetch from Companies House
                const res = await fetch(
                    `https://api.company-information.service.gov.uk/company/${company.companyNumber}`,
                    { headers: { Authorization: `Basic ${auth}` } }
                );

                if (!res.ok) {
                    results.push({
                        id: company.id,
                        companyNumber: company.companyNumber!,
                        status: 'error',
                        error: `CH API returned ${res.status}`
                    });
                    continue;
                }

                const profile = await res.json();
                const dateOfCreation = profile.date_of_creation;

                if (!dateOfCreation) {
                    results.push({
                        id: company.id,
                        companyNumber: company.companyNumber!,
                        status: 'skipped',
                        error: 'No date_of_creation in CH response'
                    });
                    continue;
                }

                const incorporatedOn = new Date(dateOfCreation);

                // Update the company
                await prisma.companyProspect.update({
                    where: { id: company.id },
                    data: {
                        incorporatedOn,
                        incorporatedOnSource: 'companies_house',
                        incorporatedOnLastSyncedAt: new Date()
                    }
                });

                results.push({
                    id: company.id,
                    companyNumber: company.companyNumber!,
                    status: 'updated',
                    incorporatedOn: dateOfCreation
                });

            } catch (e: any) {
                results.push({
                    id: company.id,
                    companyNumber: company.companyNumber!,
                    status: 'error',
                    error: e.message
                });
            }

            // Small delay between individual requests to be nice to CH
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        const lastId = companies[companies.length - 1]?.id || lastProcessedId;
        const updatedCount = results.filter(r => r.status === 'updated').length;
        const errorCount = results.filter(r => r.status === 'error').length;

        console.log(`[Backfill] Processed ${companies.length} companies, updated ${updatedCount}, errors ${errorCount}`);

        return NextResponse.json({
            status: 'in_progress',
            processed: companies.length,
            updated: updatedCount,
            errors: errorCount,
            lastProcessedId: lastId,
            nextUrl: `/api/admin/backfill-incorporation?lastProcessedId=${lastId}&limit=${limit}`,
            results
        });

    } catch (error: any) {
        console.error('[Backfill] Error:', error);
        return NextResponse.json({
            error: error.message
        }, { status: 500 });
    }
}
