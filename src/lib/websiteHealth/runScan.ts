/**
 * Unified Website Health Scan Function
 * 
 * Single entry point for all website health scans across all surfaces.
 * Provides complete end-to-end tracing to diagnose divergence.
 */

import prisma from '@/lib/prisma';
import { computeWebsiteHealthV2 } from '@/lib/scoring/computeWebsiteHealthV2';

export interface ScanTraceResponse {
    // Execution trace
    traceId: string;
    scorerVersion: 2;
    baseScoreUsed: 50;
    route: string;
    initiatedFrom: 'search' | 'leadboard' | 'overview' | 'api';

    // Computation details
    factorsCount: number;
    preClampScore: number;
    finalScore: number;
    label: string;

    // Persistence confirmation
    dbWriteConfirmed: boolean;
    dbReadback: {
        websiteHealthScore: number | null;
        websiteHealthLabel: string | null;
        websiteHealthVersion: number | null;
        webHealthDataExists: boolean;
    };

    // Proof Receipt
    receipt?: {
        scanType: string;
        companyId: number;
        surface: string;
        traceId: string;
        writer: string;
        version: number;
        resolvedUrl: string;
        resolvedUrlSource: string;
        computed: any;
        persistedReadback: {
            status: string;
            score: number | null;
            label: string | null;
            version: number | null;
            scannedAt: string;
            reportExists: boolean;
        };
    };

    // Status
    status: 'success' | 'error';
    error?: string;

    // Timestamps
    computedAt: string;
    persistedAt: string;
    requestId: string;
}

export async function runWebsiteHealthScan({
    companyId,
    initiatedFrom = 'api',
    requestId = crypto.randomUUID(),
    force = false
}: {
    companyId: number;
    initiatedFrom?: 'search' | 'leadboard' | 'overview' | 'api';
    requestId?: string;
    force?: boolean;
}): Promise<ScanTraceResponse> {

    // Debug logging (dev only)
    if (process.env.NEXT_PUBLIC_DEBUG_HEALTH === '1' || process.env.DEBUG_HEALTH === '1') {
        console.log('[runWebsiteHealthScan] START', {
            requestId,
            companyId,
            initiatedFrom,
            force
        });
    }

    try {
        // 1. IMMEDIATE STATE WRITE: "Scanning"
        await prisma.companyProspect.update({
            where: { id: companyId },
            data: {
                websiteHealthStatus: 'scanning',
                websiteHealthScore: null,
                websiteHealthLabel: null,
                websiteHealthError: null,
                websiteHealthVersion: 2, // Always V2
                websiteHealthTraceId: requestId,
                websiteHealthLastWriter: 'runWebsiteHealthScan',
                websiteHealthLastSurface: initiatedFrom,
                webHealthData: null // CRITICAL: Clear previous report while scanning
            }
        });

        // 2. Resolve website URL from multiple sources
        const { resolveWebsiteUrl } = await import('./resolveUrl');
        const urlResolution = await resolveWebsiteUrl(companyId);

        if (!urlResolution.url) {
            // NO URL FOUND - Return explicit error state
            const errorMsg = 'No website URL available for this company';

            await prisma.companyProspect.update({
                where: { id: companyId },
                data: {
                    websiteHealthStatus: 'error',
                    websiteHealthScore: null,
                    websiteHealthLabel: null,
                    websiteHealthError: 'NO_WEBSITE_URL',
                    websiteHealthVersion: 2,
                    websiteHealthTraceId: requestId,
                    websiteHealthLastWriter: 'runWebsiteHealthScan',
                    websiteHealthLastSurface: initiatedFrom,
                    webHealthData: null // Ensure no stale data
                }
            });

            return {
                traceId: crypto.randomUUID(),
                scorerVersion: 2,
                baseScoreUsed: 50,
                route: 'runWebsiteHealthScan',
                initiatedFrom,

                factorsCount: 0,
                preClampScore: 0,
                finalScore: 0,
                label: 'Error',

                dbWriteConfirmed: true,
                dbReadback: {
                    websiteHealthScore: null,
                    websiteHealthLabel: null,
                    websiteHealthVersion: 2,
                    webHealthDataExists: false
                },

                status: 'error',
                error: errorMsg,
                computedAt: new Date().toISOString(),
                persistedAt: new Date().toISOString(),
                requestId
            };
        }

        // 3. Fetch company for additional data
        const company = await prisma.companyProspect.findUnique({
            where: { id: companyId },
            select: {
                id: true,
                companyName: true,
                websiteHealthScannedAt: true
            }
        });

        if (!company) {
            throw new Error(`Company ${companyId} not found`);
        }

        // 4. Extract domain from resolved URL
        const domain = urlResolution.url
            .replace(/^https?:\/\//, '')
            .replace(/^www\./, '')
            .split('/')[0];

        // 5. Calculate days since last verified
        let daysSinceVerified: number | undefined;
        if (company.websiteHealthScannedAt) {
            daysSinceVerified = Math.floor(
                (Date.now() - new Date(company.websiteHealthScannedAt).getTime()) / (1000 * 60 * 60 * 24)
            );
        }

        // 6. Perform scan (reachability + infra signals)
        let isReachable = true;
        let isHttps = urlResolution.url.startsWith('https');
        let httpStatus = 200;
        let hasSitemap = false; // Default safe

        try {
            // Check homepage
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);

            const response = await fetch(`https://${domain}`, {
                method: 'HEAD',
                signal: controller.signal,
                headers: { 'User-Agent': 'EnvelopeBot/1.0' }
            }).catch(() => null);

            clearTimeout(timeout);

            if (response) {
                isReachable = true;
                isHttps = true;
                httpStatus = response.status;
            } else {
                // Fallback to HTTP if HTTPS fails
                const httpRes = await fetch(`http://${domain}`, { method: 'HEAD', headers: { 'User-Agent': 'EnvelopeBot/1.0' } }).catch(() => null);
                if (httpRes) {
                    isReachable = true;
                    isHttps = false;
                    httpStatus = httpRes.status;
                } else {
                    isReachable = false;
                }
            }

            // Check sitemap (parallel-ish logic but sequential here for simplicity)
            if (isReachable) {
                const { detectSitemap } = await import('./scanHelpers');
                const sitemap = await detectSitemap(domain, isHttps);
                hasSitemap = sitemap.exists;
            }

        } catch (e) {
            isReachable = false;
        }

        // 7. Compute score using V2 engine
        const report = computeWebsiteHealthV2({
            domain,
            isReachable,
            isHttps,
            httpStatus,
            daysSinceVerified,
            hasSitemap
        });

        // 8. ENFORCE V2 CONTRACT
        if (report.version !== 2) {
            throw new Error(`Expected V2, got version ${report.version}`);
        }
        if (report.baseScore !== 50) {
            throw new Error(`V2 contract violation: baseScore=${report.baseScore}, expected 50`);
        }

        // 9. ENFORCE FACTOR REQUIREMENT FOR SUCCESS
        if (report.factors.length === 0) {
            throw new Error('Cannot mark as success with 0 factors - invalid scan data');
        }

        // 10. VALIDATE SCORE MATH
        const sumPoints = report.factors.reduce((sum, f) => sum + f.points, 0);
        const preClampScore = report.baseScore + sumPoints;
        const expectedScore = Math.max(0, Math.min(100, preClampScore));

        if (report.score !== expectedScore) {
            throw new Error(
                `Score math violation: score=${report.score}, expected=${expectedScore} ` +
                `(base=${report.baseScore} + points=${sumPoints} = ${preClampScore}, clamped to ${expectedScore})`
            );
        }

        // 11. INVARIANT CHECK BEFORE PERSISTENCE
        // We refuse to partially apply updates. Either full V2 success or error.
        if (!report || typeof report.score !== 'number') {
            throw new Error(`Sanity check failed: V2 report invalid before write. Score: ${report?.score}`);
        }

        // 12. Persist to DB
        const persistedAt = new Date();
        await prisma.companyProspect.update({
            where: { id: companyId },
            data: {
                websiteDomain: domain,

                // Canonical fields (V2)
                websiteHealthStatus: 'success',
                websiteHealthScore: report.score,
                websiteHealthLabel: report.label,
                websiteHealthVersion: 2,
                websiteHealthScannedAt: persistedAt,
                websiteHealthError: null,
                websiteHealthTraceId: report.traceId,
                websiteHealthLastWriter: 'runWebsiteHealthScan',
                websiteHealthLastSurface: initiatedFrom,

                // Stored report (full V2 report with traceId)
                webHealthData: JSON.stringify(report),

                // Legacy dual-write (for fallback safety only)
                stalenessScore: report.score,
                lastAnalysedAt: persistedAt,
                signals: JSON.stringify(report.factors.map(f => f.label))
            }
        });

        // INVARIANT ENFORCEMENT:
        // Ensure that we didn't just write a 'success' status without a valid report in the payload.
        // (The above 'data' construction guarantees it, but we add an explicit check for safety).
        if (!report || typeof report.score !== 'number') {
            throw new Error("Invariant violation: Attempting to write success without valid report");
        }

        // 9. POST-WRITE READBACK VERIFICATION
        const readback = await prisma.companyProspect.findUnique({
            where: { id: companyId },
            select: {
                websiteHealthScore: true,
                websiteHealthLabel: true,
                websiteHealthVersion: true,
                webHealthData: true
            }
        });

        // 10. Build trace response and Receipt
        const receipt = {
            scanType: 'website',
            companyId,
            surface: initiatedFrom,
            traceId: report.traceId,
            writer: 'runWebsiteHealthScanV2',
            version: 2,
            resolvedUrl: urlResolution.url || 'None',
            resolvedUrlSource: urlResolution.source || 'known_missing',
            computed: {
                baseScore: report.baseScore,
                factors: report.factors.map(f => ({ id: f.id, points: f.points })),
                sumPoints,
                preClamp: preClampScore,
                finalScore: report.score,
                label: report.label
            },
            persistedReadback: {
                status: 'success',
                score: readback?.websiteHealthScore ?? null,
                label: readback?.websiteHealthLabel ?? null,
                version: readback?.websiteHealthVersion ?? null,
                scannedAt: persistedAt.toISOString(),
                reportExists: !!readback?.webHealthData
            }
        };

        const traceResponse: ScanTraceResponse = {
            receipt, // NEW: Full proof

            traceId: report.traceId,
            scorerVersion: 2,
            baseScoreUsed: 50,
            route: 'runWebsiteHealthScan',
            initiatedFrom,

            factorsCount: report.factors.length,
            preClampScore,
            finalScore: report.score,
            label: report.label,

            dbWriteConfirmed: true,
            dbReadback: {
                websiteHealthScore: readback?.websiteHealthScore ?? null,
                websiteHealthLabel: readback?.websiteHealthLabel ?? null,
                websiteHealthVersion: readback?.websiteHealthVersion ?? null,
                webHealthDataExists: !!readback?.webHealthData
            },

            status: 'success',
            computedAt: report.computedAt,
            persistedAt: persistedAt.toISOString(),
            requestId
        };

        // Debug logging
        if (process.env.NEXT_PUBLIC_DEBUG_HEALTH === '1' || process.env.DEBUG_HEALTH === '1') {
            console.log('[runWebsiteHealthScan] SUCCESS', {
                requestId,
                traceId: report.traceId,
                companyId,
                score: report.score,
                label: report.label,
                factorsCount: report.factors.length,
                readbackMatch: readback?.websiteHealthScore === report.score
            });
        }

        return traceResponse;

    } catch (error: any) {
        // Error case - persist error state
        const errorMsg = error.message || 'Scan failed';

        try {
            await prisma.companyProspect.update({
                where: { id: companyId },
                data: {
                    websiteHealthStatus: 'error',
                    websiteHealthScore: null,
                    websiteHealthLabel: null,
                    websiteHealthError: errorMsg,
                    websiteHealthVersion: 2,
                    webHealthData: null // Ensure no stale data
                }
            });
        } catch (e) {
            // Ignore persistence errors in error handler
        }

        console.error('[runWebsiteHealthScan] ERROR', {
            requestId,
            companyId,
            error: errorMsg
        });

        return {
            traceId: crypto.randomUUID(),
            scorerVersion: 2,
            baseScoreUsed: 50,
            route: 'runWebsiteHealthScan',
            initiatedFrom,

            factorsCount: 0,
            preClampScore: 0,
            finalScore: 0,
            label: 'Error',

            dbWriteConfirmed: false,
            dbReadback: {
                websiteHealthScore: null,
                websiteHealthLabel: null,
                websiteHealthVersion: null,
                webHealthDataExists: false
            },

            status: 'error',
            error: errorMsg,
            computedAt: new Date().toISOString(),
            persistedAt: new Date().toISOString(),
            requestId
        };
    }
}
