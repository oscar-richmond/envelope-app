
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { placesDetailsService } from '@/lib/services/places-details';
import { profileAIService } from '@/lib/services/profile-ai';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const prospectId = parseInt(id, 10);

    if (isNaN(prospectId)) {
        return NextResponse.json({ error: 'Invalid prospect ID' }, { status: 400 });
    }

    try {
        let prospect = await prisma.companyProspect.findUnique({
            where: { id: prospectId },
            include: { discoveredEmails: true }
        });

        if (!prospect) {
            return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });
        }

        // Auto-refresh Places if stale (don't reassign since prospect has includes)
        if (prospect.placeId && placesDetailsService.shouldRefresh(prospect)) {
            await placesDetailsService.fetchAndUpdate(prospectId).catch(err => {
                console.error(`Places refresh failed for ${prospectId}:`, err);
            });
        }

        // Update display name if missing
        if (!prospect.displayBrandName) {
            await placesDetailsService.updateDisplayName(prospectId);
            prospect = await prisma.companyProspect.findUnique({
                where: { id: prospectId },
                include: { discoveredEmails: true }
            }) || prospect;
        }

        // Generate AI if missing or stale
        if (profileAIService.needsRegeneration(prospect)) {
            await profileAIService.generateSummaries(prospect);
            prospect = await prisma.companyProspect.findUnique({
                where: { id: prospectId },
                include: { discoveredEmails: true }
            }) || prospect;
        }

        // Build profile response
        const profile = {
            id: prospect.id,

            // Identity
            displayName: prospect.displayBrandName || prospect.companyName,
            displayNameSource: prospect.displayBrandNameSource,
            companyNumber: prospect.companyNumber,

            // Category & Location
            category: formatCategory(prospect.placesCategory),
            location: extractCity(prospect.placesFormattedAddress || prospect.registeredLocation),
            fullAddress: prospect.placesFormattedAddress || prospect.registeredLocation,

            // Contact
            websiteUrl: prospect.websiteUrl,
            phone: prospect.placesPhoneE164,
            mapsUrl: prospect.placesMapsUrl,

            // Operational
            businessStatus: prospect.placesBusinessStatus,
            openingHours: parseJSON(prospect.placesOpeningHours),

            // Reputation
            rating: prospect.placesRating,
            reviewCount: prospect.placesReviewCount,

            // AI Content
            aiOneLiner: prospect.aiOneLiner,
            aiOverview: prospect.aiOverview,
            aiReputationSummary: prospect.aiReputationSummary,
            aiGeneratedAt: prospect.aiGeneratedAt,

            // Internal Signals
            signals: {
                staleness: {
                    score: prospect.stalenessScore,
                    confidence: prospect.stalenessConfidence,
                    reasons: parseJSON(prospect.scoreReasons)
                },
                financial: {
                    score: prospect.financialActivityScore,
                    band: prospect.financialActivityBand,
                    signals: parseJSON(prospect.financialSignals)
                },
                leadOpportunity: {
                    score: prospect.contactPriorityScore,
                    band: prospect.contactPriorityBand
                }
            },

            // Emails
            emails: prospect.discoveredEmails?.map(e => ({
                email: e.email,
                type: e.type,
                confidence: e.confidence,
                name: e.name,
                role: e.roleTitle
            })) || [],

            // Meta
            placeId: prospect.placeId,
            placesLastFetched: prospect.placesDetailsFetchedAt,
            updatedAt: prospect.updatedAt
        };

        return NextResponse.json(profile);

    } catch (error) {
        console.error('Profile fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
    }
}

function formatCategory(category: string | null): string | null {
    if (!category) return null;
    return category
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}

function extractCity(address: string | null): string | null {
    if (!address) return null;
    const parts = address.split(',').map(p => p.trim());
    if (parts.length >= 2) {
        return parts[parts.length - 2] || parts[0];
    }
    return parts[0];
}

function parseJSON(str: string | null): any {
    if (!str) return null;
    try {
        return JSON.parse(str);
    } catch {
        return null;
    }
}
