import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Bulk Scan API for Prospects (CompanyProspects directly)
 * 
 * Triggers scans for multiple company prospects at once
 * Supports: missing data only, stale data, or force all
 */

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            companyIds, // CompanyProspect IDs
            type = 'both', // 'website' | 'financial' | 'both'
            mode = 'missing' // 'missing' | 'stale' | 'force'
        } = body;

        if (!companyIds || !Array.isArray(companyIds) || companyIds.length === 0) {
            return NextResponse.json({ error: 'companyIds array required' }, { status: 400 });
        }

        // Rate limit: max 20 companies per bulk request
        const limitedIds = companyIds.slice(0, 20);

        // Get company prospects
        const prospects = await prisma.companyProspect.findMany({
            where: { id: { in: limitedIds } }
        });

        const results: any[] = [];
        const baseUrl = process.env.NEXTAUTH_URL ||
            (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

        for (const prospect of prospects) {
            const result: any = { id: prospect.id };

            // Determine if we should scan website
            const shouldScanWebsite = type === 'website' || type === 'both';
            const hasWebsiteData = prospect.stalenessScore !== null;
            const websiteStale = prospect.lastAnalysedAt
                ? (Date.now() - new Date(prospect.lastAnalysedAt).getTime()) > 14 * 24 * 60 * 60 * 1000
                : true;

            const skipWebsite = mode === 'missing' && hasWebsiteData ||
                mode === 'stale' && !websiteStale && hasWebsiteData;

            if (shouldScanWebsite && !skipWebsite && prospect.websiteUrl) {
                try {
                    const res = await fetch(`${baseUrl}/api/companies/${prospect.id}/web-health/scan`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ force: mode === 'force' })
                    });
                    const data = await res.json();
                    result.website = 'complete';
                    result.stalenessScore = data.score;
                    result.lastAnalysedAt = new Date().toISOString();
                } catch (e) {
                    result.website = 'error';
                }
            } else {
                result.website = 'skipped';
            }

            // Determine if we should scan financials
            const shouldScanFinancial = type === 'financial' || type === 'both';
            const hasFinancialData = prospect.financialActivityScore !== null;
            const financialStale = prospect.financialLastCheckedAt
                ? (Date.now() - new Date(prospect.financialLastCheckedAt).getTime()) > 14 * 24 * 60 * 60 * 1000
                : true;

            const skipFinancial = mode === 'missing' && hasFinancialData ||
                mode === 'stale' && !financialStale && hasFinancialData;

            if (shouldScanFinancial && !skipFinancial) {
                try {
                    const res = await fetch(`${baseUrl}/api/companies/${prospect.id}/financials/sync`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ force: mode === 'force' })
                    });
                    const data = await res.json();
                    result.financial = 'complete';
                    result.financialActivityScore = data.score;
                    result.financialActivityBand = data.band;
                    result.financialLastCheckedAt = new Date().toISOString();
                } catch (e) {
                    result.financial = 'error';
                }
            } else {
                result.financial = 'skipped';
            }

            results.push(result);
        }

        const completed = results.filter(r =>
            r.website === 'complete' || r.financial === 'complete'
        ).length;
        const skipped = results.filter(r =>
            r.website === 'skipped' && r.financial === 'skipped'
        ).length;

        return NextResponse.json({
            status: 'complete',
            message: `Bulk scan finished: ${completed} updated, ${skipped} skipped`,
            total: prospects.length,
            completed,
            skipped,
            results
        });

    } catch (error: any) {
        console.error('[ProspectsBulkScan] Error:', error);
        return NextResponse.json({
            status: 'failed',
            error: error.message
        }, { status: 500 });
    }
}
