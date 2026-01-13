import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Website Scan API
 * 
 * Triggers or retrieves website analysis for a company/lead
 */

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { companyProspectId, leadId, force = false } = body;

        if (!companyProspectId && !leadId) {
            return NextResponse.json({ error: 'companyProspectId or leadId required' }, { status: 400 });
        }

        // Find the company prospect
        let prospect;
        if (companyProspectId) {
            prospect = await prisma.companyProspect.findUnique({
                where: { id: companyProspectId }
            });
        } else if (leadId) {
            const lead = await prisma.lead.findUnique({
                where: { id: leadId },
                include: { companyProspect: true }
            });
            prospect = lead?.companyProspect;
        }

        if (!prospect) {
            return NextResponse.json({ error: 'Company not found' }, { status: 404 });
        }

        // Check if already scanning or recently scanned
        const now = new Date();
        const lastScanned = prospect.lastAnalysedAt;
        const isStale = !lastScanned || (now.getTime() - lastScanned.getTime()) > 14 * 24 * 60 * 60 * 1000;

        if (!force && !isStale && prospect.stalenessScore !== null) {
            return NextResponse.json({
                status: 'already_complete',
                message: 'Website was recently scanned',
                data: {
                    score: prospect.stalenessScore,
                    lastScannedAt: lastScanned,
                    isStale: false
                }
            });
        }

        // Check if website URL exists
        const websiteUrl = prospect.websiteUrl || prospect.websiteDomain;
        if (!websiteUrl) {
            return NextResponse.json({
                status: 'no_website',
                message: 'No website URL found for this company',
                data: {
                    score: null,
                    error: 'No website URL'
                }
            });
        }

        // Simulate scan (in real implementation, this would enqueue a job)
        // For now, we'll do a simple "scan" that sets some scores
        const stalenessScore = Math.floor(Math.random() * 100);

        await prisma.companyProspect.update({
            where: { id: prospect.id },
            data: {
                stalenessScore,
                lastAnalysedAt: now,
            }
        });

        // Also update the lead if applicable
        if (leadId) {
            await prisma.lead.update({
                where: { id: leadId },
                data: {
                    stalenessScore,
                    lastAnalyzedAt: now
                }
            });
        }

        return NextResponse.json({
            status: 'complete',
            message: 'Website scan completed',
            data: {
                score: stalenessScore,
                lastScannedAt: now,
                label: stalenessScore >= 60 ? 'Outdated' : stalenessScore >= 30 ? 'Aging' : 'Fresh'
            }
        });

    } catch (error: any) {
        console.error('[ScanWebsite] Error:', error);
        return NextResponse.json({
            status: 'failed',
            error: error.message
        }, { status: 500 });
    }
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const companyProspectId = searchParams.get('companyProspectId');

    if (!companyProspectId) {
        return NextResponse.json({ error: 'companyProspectId required' }, { status: 400 });
    }

    const prospect = await prisma.companyProspect.findUnique({
        where: { id: companyProspectId },
        select: {
            stalenessScore: true,
            lastAnalysedAt: true,
            websiteUrl: true,
            websiteDomain: true
        }
    });

    if (!prospect) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const hasWebsite = !!(prospect.websiteUrl || prospect.websiteDomain);
    const isScanned = prospect.stalenessScore !== null;
    const lastScanned = prospect.lastAnalysedAt;
    const isStale = lastScanned ? (Date.now() - lastScanned.getTime()) > 14 * 24 * 60 * 60 * 1000 : true;

    return NextResponse.json({
        status: isScanned ? (isStale ? 'stale' : 'complete') : (hasWebsite ? 'not_scanned' : 'no_website'),
        data: {
            score: prospect.stalenessScore,
            lastScannedAt: lastScanned,
            hasWebsite,
            isStale
        }
    });
}
