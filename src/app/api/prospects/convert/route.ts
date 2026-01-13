export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import {
    createJob,
    updateStep,
    completeJob,
    failJob,
    calculateOpportunityScore,
    determineAction,
    LeadConversionJob
} from '@/lib/services/lead-conversion';
import { verifyEmail } from '@/lib/services/email-verification';

function getHeaders(requestId: string) {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
        'X-Request-Id': requestId,
    };
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: getHeaders('opt') });
}

export async function POST(request: Request) {
    const requestId = `conv_${Date.now()}`;
    const headers = getHeaders(requestId);

    try {
        const body = await request.json();
        const { prospectId, companyName, domain, website } = body;

        if (!companyName || !domain) {
            return NextResponse.json({
                success: false,
                error: 'companyName and domain required'
            }, { status: 400, headers });
        }

        // Create job
        let job = createJob(prospectId || `prospect_${Date.now()}`, companyName, domain);
        job.status = 'running';

        console.log(`[Convert] Starting job ${job.id} for ${companyName}`);

        // Step 1: Website match (instant)
        job = updateStep(job, 'website_match', {
            status: 'running',
            startedAt: new Date().toISOString()
        });

        const websiteData = {
            lastUpdated: undefined as string | undefined,
            hasModernDesign: true, // Default assumption
            mobileResponsive: true,
        };

        job = updateStep(job, 'website_match', {
            status: 'done',
            finishedAt: new Date().toISOString(),
            data: websiteData,
        });

        // Step 2: Financial review (instant for now)
        job = updateStep(job, 'financial_review', {
            status: 'running',
            startedAt: new Date().toISOString()
        });

        const financialData = {
            isActive: true, // Assume active
            hasRecentFilings: false,
            estimatedRevenue: undefined as string | undefined,
        };

        job = updateStep(job, 'financial_review', {
            status: 'done',
            finishedAt: new Date().toISOString(),
            data: financialData,
        });

        // Step 3: Email discovery
        job = updateStep(job, 'discovery', {
            status: 'running',
            startedAt: new Date().toISOString()
        });

        let contacts: Array<{
            email: string;
            name?: string;
            role?: string;
            verified?: boolean;
            score?: number;
        }> = [];

        try {
            // Use internal discovery API
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://envelope-app-sage.vercel.app';
            const discoveryRes = await fetch(`${baseUrl}/api/email-discovery/v3`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ domain, seedUrl: website }),
            });

            const discoveryData = await discoveryRes.json();

            if (discoveryData.success) {
                contacts = (discoveryData.emails || []).slice(0, 25).map((e: any) => ({
                    email: e.email,
                    name: e.name,
                    role: e.role,
                    verified: false,
                    score: e.score,
                }));
            }

            job = updateStep(job, 'discovery', {
                status: 'done',
                finishedAt: new Date().toISOString(),
                data: {
                    contactsFound: contacts.length,
                    patterns: discoveryData.patterns,
                },
            });
        } catch (err: any) {
            job = updateStep(job, 'discovery', {
                status: 'failed',
                finishedAt: new Date().toISOString(),
                error: err.message,
            });
        }

        // Step 4: Verification (top 8)
        job = updateStep(job, 'verification', {
            status: 'running',
            startedAt: new Date().toISOString()
        });

        let verifiedCount = 0;
        let bestContact: typeof contacts[0] | null = null;

        try {
            const toVerify = contacts.slice(0, 8);

            for (const contact of toVerify) {
                try {
                    const result = await verifyEmail(contact.email);
                    contact.verified = result.status === 'valid';

                    if (contact.verified && !bestContact) {
                        bestContact = contact;
                    }

                    if (result.status === 'valid') verifiedCount++;
                } catch { }
            }

            job = updateStep(job, 'verification', {
                status: 'done',
                finishedAt: new Date().toISOString(),
                data: { verifiedCount },
            });
        } catch (err: any) {
            job = updateStep(job, 'verification', {
                status: 'failed',
                finishedAt: new Date().toISOString(),
                error: err.message,
            });
        }

        // Step 5: Scoring
        job = updateStep(job, 'scoring', {
            status: 'running',
            startedAt: new Date().toISOString()
        });

        const score = calculateOpportunityScore(
            websiteData,
            financialData,
            {
                hasVerifiedContact: verifiedCount > 0,
                bestContactName: bestContact?.name,
                bestContactRole: bestContact?.role,
                totalContacts: contacts.length,
            }
        );

        const action = determineAction(score, {
            hasVerifiedContact: verifiedCount > 0,
            bestContactName: bestContact?.name,
            bestContactRole: bestContact?.role,
        });

        job = updateStep(job, 'scoring', {
            status: 'done',
            finishedAt: new Date().toISOString(),
            data: { score, action },
        });

        // Complete job
        job = completeJob(job, score, action);

        console.log(`[Convert] Job ${job.id} complete - Score: ${score.total}, Action: ${action.type}`);

        return NextResponse.json({
            success: true,
            requestId,
            job: {
                id: job.id,
                status: job.status,
                companyName: job.companyName,
                domain: job.domain,
            },
            opportunityScore: score,
            recommendedAction: action,
            bestContacts: contacts.slice(0, 3),
            contacts: contacts.slice(0, 25),
            bestContact,
            summary: {
                contactsFound: contacts.length,
                contactsVerified: verifiedCount,
                durationMs: Date.now() - new Date(job.startedAt).getTime(),
            },
        }, { headers });

    } catch (error: any) {
        console.error('[Convert] Error:', error);
        return NextResponse.json({
            success: false,
            error: 'Conversion failed',
            message: error.message
        }, { status: 500, headers });
    }
}
