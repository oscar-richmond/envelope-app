import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Bulk Scan API
 * 
 * Triggers scans for multiple leads at once
 * Supports: missing data only, stale data, or force all
 */

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            leadIds,
            type = 'both', // 'website' | 'financial' | 'both'
            mode = 'missing' // 'missing' | 'stale' | 'force'
        } = body;

        if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
            return NextResponse.json({ error: 'leadIds array required' }, { status: 400 });
        }

        // Rate limit: max 20 leads per bulk request
        const limitedIds = leadIds.slice(0, 20);

        // Get leads with their prospects
        const leads = await prisma.lead.findMany({
            where: { id: { in: limitedIds } },
            include: { companyProspect: true }
        });

        const results: { leadId: number; website?: string; financial?: string }[] = [];
        const baseUrl = process.env.NEXTAUTH_URL ||
            (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

        for (const lead of leads) {
            const prospect = lead.companyProspect;
            const result: { leadId: number; website?: string; financial?: string } = { leadId: lead.id };

            // Determine if we should scan website
            const shouldScanWebsite = type === 'website' || type === 'both';
            const hasWebsiteData = lead.stalenessScore !== null || prospect?.stalenessScore !== null;
            const websiteStale = lead.lastAnalyzedAt
                ? (Date.now() - new Date(lead.lastAnalyzedAt).getTime()) > 14 * 24 * 60 * 60 * 1000
                : true;

            const skipWebsite = mode === 'missing' && hasWebsiteData ||
                mode === 'stale' && !websiteStale && hasWebsiteData;

            if (shouldScanWebsite && !skipWebsite) {
                try {
                    const res = await fetch(`${baseUrl}/api/scan/website`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            leadId: lead.id,
                            companyProspectId: lead.companyProspectId
                        })
                    });
                    const data = await res.json();
                    result.website = data.status;
                } catch (e) {
                    result.website = 'error';
                }
            } else {
                result.website = 'skipped';
            }

            // Determine if we should scan financials
            const shouldScanFinancial = type === 'financial' || type === 'both';
            const hasFinancialData = prospect?.financialActivityScore !== null;
            const financialStale = prospect?.financialLastCheckedAt
                ? (Date.now() - new Date(prospect.financialLastCheckedAt).getTime()) > 14 * 24 * 60 * 60 * 1000
                : true;

            const skipFinancial = mode === 'missing' && hasFinancialData ||
                mode === 'stale' && !financialStale && hasFinancialData;

            if (shouldScanFinancial && !skipFinancial) {
                try {
                    const res = await fetch(`${baseUrl}/api/scan/financials`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            leadId: lead.id,
                            companyProspectId: lead.companyProspectId
                        })
                    });
                    const data = await res.json();
                    result.financial = data.status;
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
            total: leads.length,
            completed,
            skipped,
            results
        });

    } catch (error: any) {
        console.error('[BulkScan] Error:', error);
        return NextResponse.json({
            status: 'failed',
            error: error.message
        }, { status: 500 });
    }
}
