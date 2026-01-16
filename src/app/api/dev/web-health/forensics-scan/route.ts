/**
 * Web Health Forensics Scan
 * 
 * Runs a real scan with before/after forensics
 */

import { NextResponse } from 'next/server';
import { getWebsiteHealthCanonical } from '@/lib/websiteHealth/canonicalRead';
import { writeWebsiteHealth } from '@/lib/websiteHealth/canonicalWrite';
import { computeWebsiteReview, type WebsiteScanInput } from '@/lib/scoring';
import { validateReport } from '@/lib/scoring/types';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
    // Guard: Dev only
    if (process.env.NODE_ENV === 'production' && process.env.DEBUG_HEALTH !== '1') {
        return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
        return NextResponse.json({ error: 'companyId required' }, { status: 400 });
    }

    const startTime = Date.now();

    try {
        // Get before state
        const before = await getWebsiteHealthCanonical(parseInt(companyId));

        // Get company for scan
        const company = await prisma.companyProspect.findUnique({
            where: { id: parseInt(companyId) },
            select: { id: true, companyName: true, websiteUrl: true, websiteDomain: true }
        });

        if (!company || !company.websiteUrl) {
            return NextResponse.json({
                error: 'Company not found or no website URL',
                before,
                after: null,
                scanDurationMs: Date.now() - startTime
            }, { status: 400 });
        }

        // Run scan (same logic as real scan endpoint)
        const scanInput: WebsiteScanInput = {
            isReachable: false,
            isHttps: false
        };

        try {
            const url = new URL(company.websiteUrl.startsWith('http')
                ? company.websiteUrl
                : `https://${company.websiteUrl}`
            );

            scanInput.isHttps = url.protocol === 'https:';

            // Try to fetch
            const response = await fetch(url.toString(), {
                method: 'HEAD',
                signal: AbortSignal.timeout(5000)
            });

            scanInput.isReachable = true;
            scanInput.httpStatus = response.status;
            scanInput.pageLoadOk = response.ok;

            // Calculate days since last verification
            if (before.new.websiteHealthScannedAt) {
                scanInput.daysSinceVerified = Math.floor(
                    (Date.now() - new Date(before.new.websiteHealthScannedAt).getTime()) / (1000 * 60 * 60 * 24)
                );
            }
        } catch (e: any) {
            scanInput.error = e.message || 'Scan error';
        }

        // Compute score using canonical engine
        const report = computeWebsiteReview(scanInput);

        // Validate
        const validation = validateReport(report);
        if (!validation.valid) {
            // Validation failed - write error
            const writeResult = await writeWebsiteHealth(
                parseInt(companyId),
                {
                    status: 'error',
                    score: null,
                    label: null,
                    scannedAt: null,
                    error: `Scoring mismatch: computed=${report.score}, expected=${validation.expectedScore}`
                },
                'forensics-scan'
            );

            const after = await getWebsiteHealthCanonical(parseInt(companyId));

            return NextResponse.json({
                success: false,
                validationError: {
                    computed: report.score,
                    expected: validation.expectedScore,
                    factors: report.factors
                },
                before,
                after,
                writeTraceId: writeResult.writeTraceId,
                scanDurationMs: Date.now() - startTime
            });
        }

        // Write to DB using canonical writer
        const writeResult = await writeWebsiteHealth(
            parseInt(companyId),
            {
                status: 'success',
                score: report.score,
                label: report.statusLabel,
                scannedAt: new Date(),
                error: null,
                version: 1,
                report: {
                    ...report,
                    status: 'success',
                    domain: company.websiteDomain
                }
            },
            'forensics-scan'
        );

        // Get after state
        const after = await getWebsiteHealthCanonical(parseInt(companyId));

        return NextResponse.json({
            success: true,
            before,
            after,
            writeTraceId: writeResult.writeTraceId,
            scanDurationMs: Date.now() - startTime,
            report: {
                score: report.score,
                label: report.statusLabel,
                factors: report.factors,
                baseScore: report.baseScore
            }
        });
    } catch (error: any) {
        return NextResponse.json({
            error: error.message,
            stack: error.stack,
            scanDurationMs: Date.now() - startTime
        }, { status: 500 });
    }
}
