export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/company/[id]
 * Fetch full company profile with all related data
 */
export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const companyId = parseInt(params.id);

        if (isNaN(companyId)) {
            return NextResponse.json({ error: 'Invalid company ID' }, { status: 400 });
        }

        // Fetch company with all related data
        const company = await prisma.companyProspect.findUnique({
            where: { id: companyId },
            include: {
                leads: {
                    include: {
                        sentEmails: {
                            select: {
                                id: true,
                                subject: true,
                                status: true,
                                sentAt: true,
                                replyDetectedAt: true,
                                replyIntent: true,
                                conversationOutcome: true,
                                formattedTo: true
                            },
                            orderBy: { sentAt: 'desc' },
                            take: 10
                        }
                    }
                },
                discoveredEmails: {
                    orderBy: { confidence: 'desc' }
                }
            }
        });

        if (!company) {
            return NextResponse.json({ error: 'Company not found' }, { status: 404 });
        }

        // Parse JSON fields
        const financialSignals = company.financialSignals ? JSON.parse(company.financialSignals) : null;
        const stalenessSignals = company.signals ? JSON.parse(company.signals) : null;
        const scoreReasons = company.scoreReasons ? JSON.parse(company.scoreReasons) : null;
        const websiteMatchEvidence = company.websiteMatchEvidence ? JSON.parse(company.websiteMatchEvidence) : null;

        // Aggregate outreach timeline from all leads
        const outreachTimeline = company.leads.flatMap(lead =>
            lead.sentEmails.map(email => ({
                ...email,
                leadId: lead.id,
                contactName: lead.contactName,
                contactEmail: lead.email
            }))
        ).sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());

        // Get contacts from leads
        const contacts = company.leads.map(lead => ({
            id: lead.id,
            name: lead.contactName || lead.email.split('@')[0],
            email: lead.email,
            role: lead.role,
            status: lead.status,
            enrichedAt: lead.linkedinEnrichedAt
        }));

        return NextResponse.json({
            company: {
                id: company.id,
                name: company.displayBrandName || company.companyName,
                legalName: company.companyName,
                companyNumber: company.companyNumber,
                industry: company.industry,
                sicCodes: company.sicCodes,
                employeeSize: company.employeeSizeBand,
                location: company.registeredLocation,
                website: company.websiteUrl,
                websiteDomain: company.websiteDomain,
                status: company.status
            },
            financial: {
                score: company.financialActivityScore,
                band: company.financialActivityBand,
                signals: financialSignals,
                lastCheckedAt: company.financialLastCheckedAt
            },
            staleness: {
                score: company.stalenessScore,
                confidence: company.stalenessConfidence,
                signals: stalenessSignals,
                reasons: scoreReasons,
                lastAnalysedAt: company.lastAnalysedAt
            },
            priority: {
                score: company.contactPriorityScore,
                band: company.contactPriorityBand,
                lastCalculatedAt: company.contactPriorityLastCalculatedAt
            },
            places: company.placeId ? {
                displayName: company.placesDisplayName,
                category: company.placesCategory,
                address: company.placesFormattedAddress,
                phone: company.placesPhoneE164,
                mapsUrl: company.placesMapsUrl,
                rating: company.placesRating,
                reviewCount: company.placesReviewCount,
                businessStatus: company.placesBusinessStatus
            } : null,
            website: {
                url: company.websiteUrl,
                confidence: company.websiteConfidence,
                matchEvidence: websiteMatchEvidence,
                meta: {
                    title: company.websiteMetaTitle,
                    description: company.websiteMetaDescription,
                    fetchedAt: company.websiteMetaFetchedAt
                }
            },
            ai: company.aiGeneratedAt ? {
                oneLiner: company.aiOneLiner,
                overview: company.aiOverview,
                reputation: company.aiReputationSummary,
                generatedAt: company.aiGeneratedAt
            } : null,
            contacts,
            outreachTimeline,
            discoveredEmails: company.discoveredEmails
        });

    } catch (e: any) {
        console.error('[Company API] Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
