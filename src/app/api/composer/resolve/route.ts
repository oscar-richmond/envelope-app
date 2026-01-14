export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

/**
 * GET /api/composer/resolve
 * 
 * Unified resolver endpoint for the Composer modal.
 * Accepts leadId, companyId, or threadId and returns all data needed to render.
 * 
 * Query params:
 *   - leadId: number (preferred)
 *   - companyId: number (fallback - finds/creates lead)
 *   - threadId: number (for existing thread)
 *   - createLeadIfMissing: boolean (default false)
 *   - source: string (for logging)
 */
export async function GET(request: Request) {
    const startTime = Date.now();
    const url = new URL(request.url);

    // Parse params
    const leadId = url.searchParams.get('leadId');
    const companyId = url.searchParams.get('companyId');
    const threadId = url.searchParams.get('threadId');
    const createLeadIfMissing = url.searchParams.get('createLeadIfMissing') === 'true';
    const source = url.searchParams.get('source') || 'unknown';

    console.log(`[ComposerResolve] Request from ${source}:`, {
        leadId, companyId, threadId, createLeadIfMissing
    });

    try {
        // Auth check
        const session = await auth();
        const userId = session?.user?.id;

        console.log(`[ComposerResolve] Auth: userId=${userId}`);

        // Validate we have at least one identifier
        if (!leadId && !companyId && !threadId) {
            console.error('[ComposerResolve] No identifier provided');
            return NextResponse.json({
                error: 'Missing required parameter: leadId, companyId, or threadId',
                code: 'MISSING_PARAMS'
            }, { status: 400 });
        }

        let lead: any = null;
        let company: any = null;
        let thread: any = null;
        let contacts: any[] = [];

        // Case 1: leadId provided
        if (leadId) {
            const leadIdNum = parseInt(leadId, 10);

            if (isNaN(leadIdNum)) {
                return NextResponse.json({
                    error: 'Invalid leadId format',
                    code: 'INVALID_LEAD_ID'
                }, { status: 400 });
            }

            console.log(`[ComposerResolve] Fetching lead ${leadIdNum}`);

            lead = await prisma.lead.findUnique({
                where: { id: leadIdNum },
                include: {
                    companyProspect: {
                        select: {
                            id: true,
                            companyName: true,
                            websiteUrl: true,
                            websiteDomain: true,
                            websiteBrandName: true,
                            manualContacts: true,
                            enrichmentData: true
                        }
                    },
                    sentEmails: {
                        orderBy: { sentAt: 'desc' },
                        take: 10,
                        select: {
                            id: true,
                            subject: true,
                            toEmail: true,
                            sentAt: true,
                            status: true
                        }
                    }
                }
            });

            if (!lead) {
                console.error(`[ComposerResolve] Lead ${leadIdNum} not found`);
                return NextResponse.json({
                    error: 'Lead not found',
                    code: 'LEAD_NOT_FOUND',
                    leadId: leadIdNum
                }, { status: 404 });
            }

            company = lead.companyProspect;
            console.log(`[ComposerResolve] Found lead ${leadIdNum} with company ${company?.companyName}`);
        }

        // Case 2: companyId provided (no leadId)
        else if (companyId) {
            const companyIdNum = parseInt(companyId, 10);

            if (isNaN(companyIdNum)) {
                return NextResponse.json({
                    error: 'Invalid companyId format',
                    code: 'INVALID_COMPANY_ID'
                }, { status: 400 });
            }

            console.log(`[ComposerResolve] Fetching company ${companyIdNum}`);

            company = await prisma.companyProspect.findUnique({
                where: { id: companyIdNum },
                select: {
                    id: true,
                    companyName: true,
                    websiteUrl: true,
                    websiteDomain: true,
                    websiteBrandName: true,
                    manualContacts: true,
                    enrichmentData: true
                }
            });

            if (!company) {
                console.error(`[ComposerResolve] Company ${companyIdNum} not found`);
                return NextResponse.json({
                    error: 'Company not found',
                    code: 'COMPANY_NOT_FOUND',
                    companyId: companyIdNum
                }, { status: 404 });
            }

            // Find existing lead for this company
            lead = await prisma.lead.findFirst({
                where: {
                    companyProspectId: companyIdNum,
                    archivedAt: null
                },
                include: {
                    sentEmails: {
                        orderBy: { sentAt: 'desc' },
                        take: 10
                    }
                }
            });

            if (!lead && createLeadIfMissing) {
                console.log(`[ComposerResolve] Creating new lead for company ${companyIdNum}`);

                lead = await prisma.lead.create({
                    data: {
                        companyName: company.companyName || 'Company',
                        companyProspectId: companyIdNum,
                        websiteUrl: company.websiteUrl,
                        status: 'NEW'
                    }
                });

                console.log(`[ComposerResolve] Created lead ${lead.id}`);
            }

            if (!lead) {
                console.log(`[ComposerResolve] No lead exists for company ${companyIdNum}`);
                // Still return company data so composer can show company context
            }
        }

        // Case 3: threadId provided
        else if (threadId) {
            const threadIdNum = parseInt(threadId, 10);

            // Threads are typically stored as sent emails
            const email = await prisma.sentEmail.findUnique({
                where: { id: threadIdNum },
                include: {
                    lead: {
                        include: {
                            companyProspect: true
                        }
                    }
                }
            });

            if (email?.lead) {
                lead = email.lead;
                company = lead.companyProspect;
                thread = email;
            }
        }

        // Parse contacts from company
        if (company) {
            try {
                // Manual contacts
                if (company.manualContacts) {
                    const data = typeof company.manualContacts === 'string'
                        ? JSON.parse(company.manualContacts)
                        : company.manualContacts;
                    if (Array.isArray(data)) {
                        contacts.push(...data.map((c: any) => ({ ...c, source: 'manual' })));
                    }
                }
            } catch (e) {
                console.warn('[ComposerResolve] Failed to parse manualContacts:', e);
            }

            try {
                // Scanned contacts
                if (company.enrichmentData) {
                    const data = typeof company.enrichmentData === 'string'
                        ? JSON.parse(company.enrichmentData)
                        : company.enrichmentData;

                    const scanned = [
                        ...(data.bestContacts || []),
                        ...(data.moreContacts || []),
                        ...(data.contacts || [])
                    ];

                    for (const c of scanned) {
                        if (c.email && !contacts.some((x: any) => x.email?.toLowerCase() === c.email?.toLowerCase())) {
                            contacts.push({ ...c, source: 'scanned' });
                        }
                    }
                }
            } catch (e) {
                console.warn('[ComposerResolve] Failed to parse enrichmentData:', e);
            }
        }

        // Build response
        const response = {
            success: true,
            lead: lead ? {
                id: lead.id,
                companyName: lead.companyName,
                companyProspectId: lead.companyProspectId,
                websiteUrl: lead.websiteUrl,
                emailDraft: lead.emailDraft,
                emailDraftHtml: lead.emailDraftHtml,
                subjectLine1: lead.subjectLine1,
                status: lead.status,
                createdAt: lead.createdAt,
                sentEmails: lead.sentEmails || []
            } : null,
            company: company ? {
                id: company.id,
                name: company.companyName || company.websiteBrandName || 'Company',
                domain: company.websiteDomain || company.websiteUrl?.replace(/^https?:\/\/(www\.)?/, '').split('/')[0],
                websiteUrl: company.websiteUrl
            } : null,
            contacts: contacts.slice(0, 20), // Limit to 20
            thread: thread,
            hasLead: !!lead,
            hasThread: !!thread || (lead?.sentEmails?.length || 0) > 0,
            source,
            resolvedAt: new Date().toISOString(),
            timing: Date.now() - startTime
        };

        console.log(`[ComposerResolve] Success in ${response.timing}ms:`, {
            hasLead: response.hasLead,
            hasCompany: !!response.company,
            contactCount: contacts.length,
            hasThread: response.hasThread
        });

        return NextResponse.json(response);

    } catch (error: any) {
        console.error('[ComposerResolve] Error:', error);

        return NextResponse.json({
            error: error.message || 'Failed to resolve composer data',
            code: 'INTERNAL_ERROR',
            timing: Date.now() - startTime
        }, { status: 500 });
    }
}
