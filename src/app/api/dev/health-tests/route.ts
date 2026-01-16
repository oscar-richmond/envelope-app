import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { runWebsiteHealthScan } from '@/lib/websiteHealth/runScan';

export const dynamic = 'force-dynamic';

export async function GET() {
    const steps: any[] = [];
    let testCompanyId: number | null = null;
    let traceData: any = null;

    try {
        // STEP 1: Setup Test Company
        // Find a company that definitely has a website to test with
        // We'll use force=true so it doesn't matter if it was scanned before
        const testCompany = await prisma.companyProspect.findFirst({
            where: {
                websiteUrl: { not: null },
                websiteDomain: { not: null }
            },
            take: 1
        });

        if (!testCompany) {
            return NextResponse.json({
                success: false,
                message: 'No testable company found in DB',
                steps
            });
        }
        testCompanyId = testCompany.id;

        steps.push({
            name: '1. Select Test Candidate',
            status: 'PASS',
            details: { id: testCompany.id, name: testCompany.companyName, url: testCompany.websiteUrl }
        });

        // STEP 2: Execute Canonical Scan (Force Mode)
        const trace = await runWebsiteHealthScan({
            companyId: testCompany.id,
            force: true,
            initiatedFrom: 'api',
            requestId: 'GOLDEN-TEST-' + Date.now()
        });
        traceData = trace;

        if (trace.status === 'success') {
            steps.push({
                name: '2. Run Canonical Scan',
                status: 'PASS',
                details: {
                    score: trace.finalScore,
                    label: trace.label,
                    traceId: trace.traceId,
                    dbWriteConfirmed: trace.dbWriteConfirmed
                }
            });
        } else {
            throw new Error(`Scan failed: ${trace.error}`);
        }

        // STEP 3: Verify DB State (Readback)
        const dbState = await prisma.companyProspect.findUnique({
            where: { id: testCompany.id }
        });

        // 3a. Check Canonical Fields
        if (dbState?.websiteHealthStatus !== 'success' || dbState?.websiteHealthScore === null) {
            throw new Error(`DB Readback Failed: status=${dbState?.websiteHealthStatus}, score=${dbState?.websiteHealthScore}`);
        }

        // 3b. Check Stored Report
        let report = null;
        try {
            report = JSON.parse(dbState.webHealthData || 'null');
        } catch (e) { }

        if (!report || !report.factors || report.version !== 2) {
            throw new Error('Stored report is invalid or missing');
        }

        steps.push({
            name: '3. Verify DB State & Report',
            status: 'PASS',
            details: {
                canonicalScore: dbState.websiteHealthScore,
                reportVersion: report.version,
                reportScore: report.score,
                lastWriter: dbState.websiteHealthLastWriter
            }
        });

        // STEP 4: Math Check
        const sumPoints = report.factors.reduce((s: number, f: any) => s + f.points, 0);
        const expectedScore = Math.max(0, Math.min(100, 50 + sumPoints));

        if (expectedScore !== report.score) {
            throw new Error(`Math Mismatch: ${expectedScore} vs ${report.score}`);
        }

        steps.push({
            name: '4. Verify Scoring Math',
            status: 'PASS',
            details: { base: 50, sum: sumPoints, final: report.score }
        });

        return NextResponse.json({
            success: true,
            message: 'All Golden Path tests passed.',
            steps,
            trace: traceData
        });

    } catch (e: any) {
        return NextResponse.json({
            success: false,
            message: 'Test failed',
            steps: [
                ...steps,
                {
                    name: 'Fatal Error',
                    status: 'FAIL',
                    error: e.message
                }
            ],
            trace: traceData
        });
    }
}
