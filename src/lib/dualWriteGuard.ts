/**
 * Dual-Write Consistency Guard
 * 
 * Utility functions to ensure new and legacy website health fields stay in sync.
 * Used in scan routes after writing to verify consistency.
 */

import prisma from '@/lib/prisma';

export interface DualWriteConsistencyResult {
    isConsistent: boolean;
    companyId: number;
    routeName: string;
    newFields: {
        status: string | null;
        score: number | null;
        scannedAt: Date | null;
    };
    legacyFields: {
        score: number | null;
        scannedAt: Date | null;
    };
    mismatch?: string;
}

/**
 * Verify that new and legacy fields are consistent after a write
 * 
 * @param companyId - The company ID that was just updated
 * @param routeName - Name of the route for logging
 * @param expectedScore - The score that should have been written
 * @returns Consistency check result
 */
export async function verifyDualWriteConsistency(
    companyId: number,
    routeName: string,
    expectedScore: number | null
): Promise<DualWriteConsistencyResult> {
    // Read back the record
    const prospect = await prisma.companyProspect.findUnique({
        where: { id: companyId },
        select: {
            websiteHealthStatus: true,
            websiteHealthScore: true,
            websiteHealthScannedAt: true,
            stalenessScore: true,
            lastAnalysedAt: true
        }
    });

    if (!prospect) {
        console.error(`[DualWriteGuard] Company ${companyId} not found after write in ${routeName}`);
        return {
            isConsistent: false,
            companyId,
            routeName,
            newFields: { status: null, score: null, scannedAt: null },
            legacyFields: { score: null, scannedAt: null },
            mismatch: 'Company not found after write'
        };
    }

    const result: DualWriteConsistencyResult = {
        isConsistent: true,
        companyId,
        routeName,
        newFields: {
            status: prospect.websiteHealthStatus,
            score: prospect.websiteHealthScore,
            scannedAt: prospect.websiteHealthScannedAt
        },
        legacyFields: {
            score: prospect.stalenessScore,
            scannedAt: prospect.lastAnalysedAt
        }
    };

    // Check consistency
    const mismatches: string[] = [];

    // Status consistency: if new is success, legacy should have lastAnalysedAt
    if (prospect.websiteHealthStatus === 'success' && !prospect.lastAnalysedAt) {
        mismatches.push('new=success but legacy lastAnalysedAt is null');
    }

    // Score consistency: if both should be set, they must match
    if (prospect.websiteHealthStatus === 'success' && prospect.lastAnalysedAt) {
        if (prospect.websiteHealthScore !== prospect.stalenessScore) {
            mismatches.push(`score mismatch: new=${prospect.websiteHealthScore}, legacy=${prospect.stalenessScore}`);
        }
    }

    // Expected score check
    if (expectedScore !== null && prospect.websiteHealthScore !== expectedScore) {
        mismatches.push(`expected score ${expectedScore} but got ${prospect.websiteHealthScore}`);
    }
    if (expectedScore !== null && prospect.stalenessScore !== expectedScore) {
        mismatches.push(`expected legacy score ${expectedScore} but got ${prospect.stalenessScore}`);
    }

    if (mismatches.length > 0) {
        result.isConsistent = false;
        result.mismatch = mismatches.join('; ');
        console.error(`[DualWriteGuard] MISMATCH in ${routeName} for company ${companyId}: ${result.mismatch}`);
    }

    return result;
}

/**
 * Log a dual-write operation for debugging
 */
export function logDualWrite(
    routeName: string,
    companyId: number,
    score: number | null,
    status: string = 'success'
) {
    console.log(`[DualWrite] ${routeName} → company ${companyId}: status=${status}, score=${score}`);
}
