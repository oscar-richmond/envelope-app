import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { SCAN_TTL_DAYS } from '@/lib/config/staleness-config';

/**
 * Financial Scan API
 * 
 * Triggers or retrieves financial analysis for a company/lead
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

        // Check if already scanned recently
        const now = new Date();
        const lastScanned = prospect.financialLastCheckedAt;
        const isStale = !lastScanned || (now.getTime() - lastScanned.getTime()) > SCAN_TTL_DAYS.FIN_HEALTH * 24 * 60 * 60 * 1000;

        if (!force && !isStale && prospect.financialActivityScore !== null) {
            return NextResponse.json({
                status: 'already_complete',
                message: 'Financials were recently scanned',
                data: {
                    score: prospect.financialActivityScore,
                    lastScannedAt: lastScanned,
                    isStale: false
                }
            });
        }

        // Simulate financial scan
        // In real implementation, this would query Companies House API
        const financialScore = Math.floor(Math.random() * 100);
        const band = financialScore > 75 ? 'Strong' : financialScore > 50 ? 'Medium' : 'Low';
        const breakdown = [];

        // Persist to both individual fields AND structured finHealthData JSON
        await prisma.companyProspect.update({
            where: { id: prospect.id },
            data: {
                financialActivityScore: financialScore,
                financialActivityBand: band,
                financialLastCheckedAt: now,
                finHealthData: JSON.stringify({
                    score: financialScore,
                    band,
                    breakdown,
                    lastSyncedAt: now.toISOString()
                })
            }
        });

        return NextResponse.json({
            status: 'complete',
            message: 'Financial scan completed',
            data: {
                score: financialScore,
                band,
                lastScannedAt: now
            }
        });

    } catch (error: any) {
        console.error('[ScanFinancials] Error:', error);
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
            financialActivityScore: true,
            financialLastCheckedAt: true,
            companyName: true
        }
    });

    if (!prospect) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const isScanned = prospect.financialActivityScore !== null;
    const lastScanned = prospect.financialLastCheckedAt;
    const isStale = lastScanned ? (Date.now() - lastScanned.getTime()) > 14 * 24 * 60 * 60 * 1000 : true;

    return NextResponse.json({
        status: isScanned ? (isStale ? 'stale' : 'complete') : 'not_scanned',
        data: {
            score: prospect.financialActivityScore,
            lastScannedAt: lastScanned,
            isStale
        }
    });
}
