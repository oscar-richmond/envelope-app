export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Lead Scan Endpoint
 * Triggers website and/or financial analysis for a lead
 */

export async function POST(
    request: Request,
    { params }: { params: { id: string } }
) {
    const leadId = parseInt(params.id);

    if (isNaN(leadId)) {
        return NextResponse.json({ error: 'Invalid lead ID' }, { status: 400 });
    }

    try {
        const body = await request.json().catch(() => ({}));
        const { type = 'both' } = body; // 'website' | 'financial' | 'both'

        // Get lead with company prospect
        const lead = await prisma.lead.findUnique({
            where: { id: leadId },
            include: { companyProspect: true }
        });

        if (!lead) {
            return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
        }

        const domain = lead.companyProspect?.websiteDomain ||
            lead.websiteUrl?.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
        const companyNumber = lead.companyProspect?.companyNumber;

        const results: any = {
            leadId,
            type,
            started: new Date().toISOString(),
        };

        // Run website analysis
        if (type === 'website' || type === 'both') {
            if (domain) {
                try {
                    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://envelope-app-sage.vercel.app';
                    const res = await fetch(`${baseUrl}/api/enrichment/website-analysis`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url: `https://${domain}` })
                    });

                    const websiteData = await res.json();

                    if (websiteData.success) {
                        // Update lead with staleness score
                        await prisma.lead.update({
                            where: { id: leadId },
                            data: {
                                stalenessScore: websiteData.overallScore ?? websiteData.stalenessScore ?? 0,
                                lastAnalyzedAt: new Date(),
                                copyrightYear: websiteData.copyrightYear,
                                hasSitemap: websiteData.hasSitemap ?? false,
                            }
                        });

                        results.website = {
                            success: true,
                            score: websiteData.overallScore ?? websiteData.stalenessScore
                        };
                    } else {
                        results.website = { success: false, error: websiteData.error };
                    }
                } catch (err: any) {
                    results.website = { success: false, error: err.message };
                }
            } else {
                results.website = { success: false, error: 'No domain available' };
            }
        }

        // Run financial analysis
        if (type === 'financial' || type === 'both') {
            if (companyNumber && lead.companyProspect) {
                try {
                    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://envelope-app-sage.vercel.app';
                    const res = await fetch(`${baseUrl}/api/enrichment/financial-analysis`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ companyNumber })
                    });

                    const financialData = await res.json();

                    if (financialData.success || financialData.score !== undefined) {
                        // Update company prospect with financial data
                        await prisma.companyProspect.update({
                            where: { id: lead.companyProspect.id },
                            data: {
                                financialActivityScore: financialData.score ?? financialData.overallScore ?? 0,
                                financialActivityBand: financialData.band,
                                financialSignals: JSON.stringify(financialData.signals || {}),
                                financialLastCheckedAt: new Date(),
                            }
                        });

                        results.financial = {
                            success: true,
                            score: financialData.score ?? financialData.overallScore
                        };
                    } else {
                        results.financial = { success: false, error: financialData.error };
                    }
                } catch (err: any) {
                    results.financial = { success: false, error: err.message };
                }
            } else {
                results.financial = { success: false, error: 'No company number available' };
            }
        }

        results.completed = new Date().toISOString();

        return NextResponse.json({
            success: true,
            ...results
        });

    } catch (error: any) {
        console.error('[LeadScan] Error:', error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
