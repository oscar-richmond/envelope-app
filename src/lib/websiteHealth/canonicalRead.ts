/**
 * Canonical Read for Website Health
 * 
 * Reads ALL website health data from DB without any caching or transformations
 * Returns everything needed for forensics analysis
 */

import prisma from '@/lib/prisma';
import { validateReport } from '@/lib/scoring/types';

export interface WebsiteHealthCanonical {
    companyId: number;
    companyName: string;

    // NEW canonical fields
    new: {
        websiteHealthStatus: string | null;
        websiteHealthScore: number | null;
        websiteHealthScannedAt: Date | null;
        websiteHealthError: string | null;
        websiteHealthVersion: number | null;
        websiteHealthLabel: string | null;
    };

    // LEGACY fields
    legacy: {
        stalenessScore: number | null;
        lastAnalysedAt: Date | null;
        signals: string | null;
    };

    // Stored report (JSON)
    storedReport: {
        exists: boolean;
        raw: any;
        parsed: {
            score?: number;
            statusLabel?: string;
            factors?: any[];
            baseScore?: number;
            computedAt?: string;
        } | null;
    };

    // Integrity checks
    integrity: {
        hasNewSuccess: boolean;
        hasLegacy: boolean;
        reportHasFactors: boolean;
        mathCheck: {
            pass: boolean;
            expectedScore: number | null;
            actualScore: number | null;
            message: string;
        };
        labelCheck: {
            pass: boolean;
            expectedLabel: string | null;
            actualLabel: string | null;
            message: string;
        };
    };
}

export async function getWebsiteHealthCanonical(companyId: number): Promise<WebsiteHealthCanonical> {
    const company = await prisma.companyProspect.findUnique({
        where: { id: companyId },
        select: {
            id: true,
            companyName: true,
            // New fields
            websiteHealthStatus: true,
            websiteHealthScore: true,
            websiteHealthScannedAt: true,
            websiteHealthError: true,
            websiteHealthVersion: true,
            websiteHealthLabel: true,
            // Legacy fields
            stalenessScore: true,
            lastAnalysedAt: true,
            signals: true,
            // Stored report
            webHealthData: true
        }
    });

    if (!company) {
        throw new Error(`Company ${companyId} not found`);
    }

    // Parse stored report
    let parsedReport = null;
    let reportRaw = null;
    if (company.webHealthData) {
        try {
            reportRaw = JSON.parse(company.webHealthData);
            parsedReport = {
                score: reportRaw.score,
                statusLabel: reportRaw.statusLabel,
                factors: reportRaw.factors,
                baseScore: reportRaw.baseScore,
                computedAt: reportRaw.computedAt
            };
        } catch (e) {
            // Parse failed
        }
    }

    // Math check
    let mathCheck = {
        pass: true,
        expectedScore: null as number | null,
        actualScore: parsedReport?.score ?? null,
        message: 'No report to validate'
    };

    if (parsedReport && parsedReport.factors) {
        try {
            const validation = validateReport({
                score: parsedReport.score ?? 0,
                statusLabel: parsedReport.statusLabel ?? '',
                factors: parsedReport.factors ?? [],
                computedAt: parsedReport.computedAt ?? '',
                confidence: 'high',
                baseScore: parsedReport.baseScore ?? 50
            });
            mathCheck = {
                pass: validation.valid,
                expectedScore: validation.expectedScore,
                actualScore: parsedReport.score ?? null,
                message: validation.valid
                    ? 'Score matches formula'
                    : `Mismatch: expected ${validation.expectedScore}, got ${parsedReport.score}`
            };
        } catch (e: any) {
            mathCheck.message = `Validation error: ${e.message}`;
            mathCheck.pass = false;
        }
    }

    // Label check (using NEW staleness thresholds)
    let labelCheck = {
        pass: true,
        expectedLabel: null as string | null,
        actualLabel: company.websiteHealthLabel,
        message: 'No score to check'
    };

    const score = company.websiteHealthScore;
    if (score !== null && score !== undefined) {
        // NEW staleness labels: higher score = more outdated
        let expected = 'Fresh';
        if (score >= 75) expected = 'Very Outdated';
        else if (score >= 50) expected = 'Outdated';
        else if (score >= 25) expected = 'Aging';
        else expected = 'Fresh';

        labelCheck = {
            pass: company.websiteHealthLabel === expected,
            expectedLabel: expected,
            actualLabel: company.websiteHealthLabel,
            message: company.websiteHealthLabel === expected
                ? 'Label matches threshold'
                : `Mismatch: expected "${expected}", got "${company.websiteHealthLabel}"`
        };
    }

    return {
        companyId: company.id,
        companyName: company.companyName,
        new: {
            websiteHealthStatus: company.websiteHealthStatus,
            websiteHealthScore: company.websiteHealthScore,
            websiteHealthScannedAt: company.websiteHealthScannedAt,
            websiteHealthError: company.websiteHealthError,
            websiteHealthVersion: company.websiteHealthVersion,
            websiteHealthLabel: company.websiteHealthLabel
        },
        legacy: {
            stalenessScore: company.stalenessScore,
            lastAnalysedAt: company.lastAnalysedAt,
            signals: company.signals
        },
        storedReport: {
            exists: !!company.webHealthData,
            raw: reportRaw,
            parsed: parsedReport
        },
        integrity: {
            hasNewSuccess: company.websiteHealthStatus === 'success' && company.websiteHealthScore !== null,
            hasLegacy: company.stalenessScore !== null,
            reportHasFactors: parsedReport?.factors?.length > 0,
            mathCheck,
            labelCheck
        }
    };
}
