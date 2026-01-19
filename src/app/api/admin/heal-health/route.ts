import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { dryRun = true } = body;

        // 1. Find Website Health Corruptions
        // Criteria: status='success' AND (webHealthData IS NULL OR websiteHealthVersion != 2 OR websiteHealthLabel IS NULL)
        const corruptedWeb = await prisma.companyProspect.findMany({
            where: {
                websiteHealthStatus: 'success',
                OR: [
                    { webHealthData: null },
                    { websiteHealthVersion: { not: 2 } },
                    { websiteHealthLabel: null }
                ]
            },
            select: { id: true, companyName: true, websiteHealthVersion: true }
        });

        // 2. Find Financial Health Corruptions
        // Criteria: financialHealthStatus='success' AND (finHealthData IS NULL OR financialHealthVersion != 2)
        const corruptedFin = await prisma.companyProspect.findMany({
            where: {
                financialHealthStatus: 'success',
                OR: [
                    { finHealthData: null },
                    { financialHealthVersion: { not: 2 } }
                ]
            },
            select: { id: true, companyName: true, financialHealthVersion: true }
        });

        const summary = {
            dryRun,
            websiteHealthCorrupted: corruptedWeb.length,
            financialHealthCorrupted: corruptedFin.length,
            webIds: corruptedWeb.map(c => c.id),
            finIds: corruptedFin.map(c => c.id)
        };

        if (dryRun) {
            return NextResponse.json({ ...summary, message: 'Dry run complete. Set dryRun=false to execute.' });
        }

        // 3. Heal Website Health
        if (corruptedWeb.length > 0) {
            await prisma.companyProspect.updateMany({
                where: {
                    id: { in: corruptedWeb.map(c => c.id) }
                },
                data: {
                    websiteHealthStatus: 'error',
                    websiteHealthScore: null,
                    websiteHealthLabel: null,
                    websiteHealthError: 'INVALID_SUCCESS_NO_REPORT',
                    websiteHealthVersion: 2,
                    webHealthData: null
                }
            });
        }

        // 4. Heal Financial Health
        if (corruptedFin.length > 0) {
            await prisma.companyProspect.updateMany({
                where: {
                    id: { in: corruptedFin.map(c => c.id) }
                },
                data: {
                    financialHealthStatus: 'error',
                    financialHealthScore: null,
                    financialHealthLabel: null,
                    financialHealthError: 'INVALID_SUCCESS_NO_REPORT',
                    financialHealthVersion: 2,
                    finHealthData: null
                }
            });
        }

        return NextResponse.json({
            ...summary,
            status: 'healed',
            message: `Healed ${corruptedWeb.length} web records and ${corruptedFin.length} financial records.`
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
