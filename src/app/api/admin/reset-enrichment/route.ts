/**
 * Reset Enrichment Data API
 * 
 * Clears derived scan/API data without deleting core objects.
 * Protected: only works in development or with ENABLE_DEV_TOOLS=1
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface ResetRequest {
    scope: 'all' | 'companies';
    companyIds?: string[];
    includeDerivedWebsiteUrl?: boolean;
}

interface ResetResult {
    success: boolean;
    companiesAffected: number;
    leadsAffected: number;
    prospectsAffected: number;
    contactsCleared: number;
    timestamp: string;
    scope: string;
    errors?: string[];
}

// Check if reset is allowed
function isResetAllowed(): boolean {
    // Allow in development
    if (process.env.NODE_ENV === 'development') return true;
    // Allow with feature flag
    if (process.env.ENABLE_DEV_TOOLS === '1') return true;
    return false;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        // Check permission
        if (!isResetAllowed()) {
            return NextResponse.json(
                { error: 'Reset enrichment is only available in development mode or with ENABLE_DEV_TOOLS=1' },
                { status: 403 }
            );
        }

        // Parse request
        const body: ResetRequest = await request.json();
        const { scope, companyIds, includeDerivedWebsiteUrl } = body;

        // For audit log (simplified - in dev mode we don't need full auth)
        const userId = 'dev-reset';

        console.log(`[ResetEnrichment] Starting reset - scope: ${scope}, user: ${userId}`);

        const result: ResetResult = {
            success: false,
            companiesAffected: 0,
            leadsAffected: 0,
            prospectsAffected: 0,
            contactsCleared: 0,
            timestamp: new Date().toISOString(),
            scope,
            errors: []
        };

        // Build where clause for scoped reset
        const prospectWhere = scope === 'companies' && companyIds?.length
            ? { companyNumber: { in: companyIds } }
            : {};
        const leadWhere = scope === 'companies' && companyIds?.length
            ? { id: { in: companyIds.map(id => parseInt(id)).filter(n => !isNaN(n)) } }
            : {};

        // Reset CompanyProspect enrichment fields
        const prospectUpdate = await prisma.companyProspect.updateMany({
            where: prospectWhere,
            data: {
                // Website Health
                stalenessScore: null,
                stalenessConfidence: null,
                scoreReasons: null,
                signals: null,
                lastAnalysedAt: null,
                webHealthData: null,

                // Financial Health
                financialActivityScore: null,
                financialActivityBand: null,
                financialSignals: null,
                financialLastCheckedAt: null,
                finHealthData: null,

                // Website matching (optional)
                ...(includeDerivedWebsiteUrl ? {
                    websiteUrl: null,
                    websiteDomain: null,
                    websiteConfidence: null,
                    websiteMatchEvidence: null,
                    websiteLastMatchedAt: null,
                    websiteMatchStatus: null,
                    websiteMatchFailureReason: null,
                    websiteDiscoveryMethod: null
                } : {}),

                // Priority scores
                contactPriorityScore: null,
                contactPriorityBand: null,
                contactPriorityEvidence: null
            }
        });
        result.prospectsAffected = prospectUpdate.count;

        // Reset Lead enrichment fields
        const leadUpdate = await prisma.lead.updateMany({
            where: leadWhere,
            data: {
                // Website Health
                stalenessScore: 0, // Lead uses non-nullable Int, so reset to 0
                scoreConfidence: 'LOW',
                scoreReasons: null,
                lastAnalyzedAt: null,

                // Analysis signals
                copyrightYear: null,
                hasSitemap: false,
                sitemapLastMod: null,
                blogLastPost: null,
                metaViewport: false,
                generatorTag: null
            }
        });
        result.leadsAffected = leadUpdate.count;

        // Clear discovered contacts (keep manually added ones)
        // Assuming contacts have a 'source' field to differentiate
        const contactDelete = await prisma.contact.deleteMany({
            where: {
                source: { not: 'manual' }, // Only delete auto-discovered contacts
                ...(scope === 'companies' && companyIds?.length
                    ? { companyId: { in: companyIds.map(id => parseInt(id)).filter(n => !isNaN(n)) } }
                    : {})
            }
        });
        result.contactsCleared = contactDelete.count;

        result.success = true;
        result.companiesAffected = result.prospectsAffected + result.leadsAffected;

        // Audit log
        console.log(`[ResetEnrichment] Complete - prospects: ${result.prospectsAffected}, leads: ${result.leadsAffected}, contacts: ${result.contactsCleared}, user: ${userId}`);

        return NextResponse.json(result);

    } catch (error) {
        console.error('[ResetEnrichment] Error:', error);
        return NextResponse.json(
            {
                error: 'Failed to reset enrichment data',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

// GET - check if reset is available
export async function GET(): Promise<NextResponse> {
    return NextResponse.json({
        available: isResetAllowed(),
        environment: process.env.NODE_ENV,
        devToolsEnabled: process.env.ENABLE_DEV_TOOLS === '1'
    });
}
