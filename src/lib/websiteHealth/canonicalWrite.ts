/**
 * Canonical Write for Website Health
 * 
 * Single source of truth for all website health writes
 * Logs before/after state for forensics
 */

import prisma from '@/lib/prisma';
import { getWebsiteHealthCanonical } from './canonicalRead';

export interface WebsiteHealthWritePayload {
    status: 'success' | 'error' | 'scanning' | 'idle';
    score: number | null;
    label: string | null;
    scannedAt: Date | null;
    error: string | null;
    version?: number;
    report?: any; // Full report with factors
}

export interface WebsiteHealthWriteResult {
    writeTraceId: string;
    before: any;
    after: any;
    diff: {
        newFieldsChanged: string[];
        legacyFieldsChanged: string[];
    };
}

export async function writeWebsiteHealth(
    companyId: number,
    payload: WebsiteHealthWritePayload,
    sourceRoute: string
): Promise<WebsiteHealthWriteResult> {
    const writeTraceId = crypto.randomUUID();
    const isDev = process.env.NODE_ENV === 'development' || process.env.DEBUG_HEALTH === '1';

    // Read before state
    const before = await getWebsiteHealthCanonical(companyId);

    // Prepare update data
    const updateData: any = {
        // NEW canonical fields (always write)
        websiteHealthStatus: payload.status,
        websiteHealthScore: payload.score,
        websiteHealthLabel: payload.label,
        websiteHealthScannedAt: payload.scannedAt,
        websiteHealthError: payload.error,
        websiteHealthVersion: payload.version ?? 1,

        // Stored report (if provided)
        ...(payload.report && {
            webHealthData: JSON.stringify(payload.report)
        })
    };

    // DUAL WRITE: Also update legacy fields for rollback safety
    // This ensures backward compatibility during migration
    if (payload.status === 'success' && payload.score !== null) {
        updateData.stalenessScore = payload.score;
        updateData.lastAnalysedAt = payload.scannedAt;
        if (payload.report?.factors) {
            const signalStrings = payload.report.factors.map((f: any) => f.label);
            updateData.signals = JSON.stringify(signalStrings);
        }
    } else {
        // If not success, clear legacy scores too
        updateData.stalenessScore = null;
        updateData.lastAnalysedAt = null;
    }

    // Write to DB
    await prisma.companyProspect.update({
        where: { id: companyId },
        data: updateData
    });

    // Read after state
    const after = await getWebsiteHealthCanonical(companyId);

    // Calculate diff
    const newFieldsChanged: string[] = [];
    const legacyFieldsChanged: string[] = [];

    // Check new fields
    if (before.new.websiteHealthStatus !== after.new.websiteHealthStatus) newFieldsChanged.push('status');
    if (before.new.websiteHealthScore !== after.new.websiteHealthScore) newFieldsChanged.push('score');
    if (before.new.websiteHealthLabel !== after.new.websiteHealthLabel) newFieldsChanged.push('label');
    if (before.new.websiteHealthScannedAt?.getTime() !== after.new.websiteHealthScannedAt?.getTime()) newFieldsChanged.push('scannedAt');
    if (before.new.websiteHealthError !== after.new.websiteHealthError) newFieldsChanged.push('error');

    // Check legacy fields
    if (before.legacy.stalenessScore !== after.legacy.stalenessScore) legacyFieldsChanged.push('stalenessScore');
    if (before.legacy.lastAnalysedAt?.getTime() !== after.legacy.lastAnalysedAt?.getTime()) legacyFieldsChanged.push('lastAnalysedAt');

    // Log for forensics
    if (isDev) {
        console.log('[WRITE_WEB_HEALTH]', {
            writeTraceId,
            companyId,
            sourceRoute,
            before: {
                new: before.new,
                legacy: before.legacy
            },
            after: {
                new: after.new,
                legacy: after.legacy
            },
            diff: {
                newFieldsChanged,
                legacyFieldsChanged
            }
        });
    }

    return {
        writeTraceId,
        before: before.new,
        after: after.new,
        diff: {
            newFieldsChanged,
            legacyFieldsChanged
        }
    };
}
