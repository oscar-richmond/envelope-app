export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Lead Scan Endpoint
 * Triggers website and/or financial analysis for a lead
 */

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    const leadId = parseInt(id);

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
            if (lead.companyProspect?.id) {
                const { runWebsiteHealthScan } = await import('@/lib/websiteHealth/runScan');

                // DELEGATE TO CANONICAL
                const webResult = await runWebsiteHealthScan({
                    companyId: lead.companyProspect.id,
                    initiatedFrom: 'api',
                    force: true
                });

                if (webResult.status === 'success') {
                    results.website = { success: true, score: webResult.finalScore };

                    // Sync legacy fields on Lead model for older UI
                    await prisma.lead.update({
                        where: { id: leadId },
                        data: {
                            stalenessScore: webResult.finalScore,
                            lastAnalyzedAt: new Date(),
                            // We don't have copyrightYear/hasSitemap directly exposed in V2 trace response easily without parsing receipt
                            // But usually V2 is the source of truth.
                        }
                    });
                } else {
                    results.website = { success: false, error: webResult.error };
                }
            } else {
                results.website = { success: false, error: 'No company attached to lead' };
            }
        }

        // Run financial analysis
        if (type === 'financial' || type === 'both') {
            if (lead.companyProspect?.id && companyNumber) {
                const { runFinancialHealthScan } = await import('@/lib/financials/runFinancialScan');

                // DELEGATE TO CANONICAL
                const finResult = await runFinancialHealthScan({
                    companyId: lead.companyProspect.id,
                    initiatedFrom: 'lead_scan_api',
                    force: true
                });

                if (finResult.status === 'success') {
                    results.financial = {
                        success: true,
                        score: finResult.receipt.computed.score
                    };
                } else {
                    results.financial = { success: false, error: finResult.error };
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
