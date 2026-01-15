import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { resolveCompanyIdentityOrError } from '@/lib/resolveCompanyIdentity';

// Job tracking (use Redis in production)
const jobs: Record<string, any> = (global as any).__contactScanJobs || {};
(global as any).__contactScanJobs = jobs;

/**
 * POST /api/companies/[id]/contacts/scan
 * 
 * Triggers contact discovery job
 */
export async function POST(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const rawId = params.id;

        // Use resolver for flexible company identification
        const resolved = await resolveCompanyIdentityOrError({
            companyId: !isNaN(parseInt(rawId)) ? parseInt(rawId) : undefined,
            companiesHouseNumber: isNaN(parseInt(rawId)) ? rawId : undefined
        });

        if (!resolved.success) {
            console.warn(`[ContactsScan] Company resolution failed for: ${rawId}`);
            return NextResponse.json({
                error: resolved.error,
                errorCode: resolved.errorCode,
                hint: resolved.hint
            }, { status: 400 });
        }

        const companyId = resolved.companyId;

        const body = await request.json().catch(() => ({}));
        const { domain: providedDomain, force = false } = body;

        console.log(`[ContactsScan] Starting scan for company ${companyId}, force=${force}`);

        // Get company prospect
        const prospect = await prisma.companyProspect.findUnique({
            where: { id: companyId },
            select: {
                id: true,
                companyName: true,
                websiteDomain: true,
                websiteUrl: true,
                enrichmentData: true,
                contactsLastScannedAt: true
            }
        });

        if (!prospect) {
            return NextResponse.json({ error: 'Company not found' }, { status: 404 });
        }

        // Determine domain
        let domain = providedDomain || prospect.websiteDomain || '';
        if (!domain && prospect.websiteUrl) {
            domain = prospect.websiteUrl
                .replace(/^https?:\/\//, '')
                .replace(/^www\./, '')
                .split('/')[0];
        }

        if (!domain) {
            return NextResponse.json({
                error: 'Add a website to find contacts',
                status: 'no_domain'
            }, { status: 400 });
        }

        // Create job
        const jobId = `contacts-${companyId}-${Date.now()}`;
        const job = {
            id: jobId,
            companyId,
            domain,
            status: 'running' as 'queued' | 'running' | 'done' | 'failed',
            progress: 0,
            contacts: [] as any[],
            error: null as string | null,
            startedAt: new Date()
        };
        jobs[jobId] = job;

        // Run scan and AWAIT completion (critical for serverless - don't fire-and-forget)
        console.log(`[ContactsScan] Running scan synchronously for company ${companyId}...`);
        await runContactScan(jobId, companyId, domain, prospect.companyName || '', force);

        // Get final result from job
        const finalJob = jobs[jobId];

        return NextResponse.json({
            success: finalJob?.status === 'done',
            jobId,
            status: finalJob?.status || 'done',
            domain,
            contactsFound: finalJob?.contacts?.length || 0
        });

    } catch (error: any) {
        console.error('[ContactsScan] Error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to start contact scan'
        }, { status: 500 });
    }
}

/**
 * GET /api/companies/[id]/contacts/scan?jobId=xxx
 * 
 * Get job status
 */
export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const { searchParams } = new URL(request.url);
        const jobId = searchParams.get('jobId');

        if (!jobId) {
            return NextResponse.json({ error: 'jobId required' }, { status: 400 });
        }

        const job = jobs[jobId];
        if (!job) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }

        return NextResponse.json({
            jobId: job.id,
            status: job.status,
            progress: job.progress,
            contactsFound: job.contacts?.length || 0,
            error: job.error
        });

    } catch (error: any) {
        console.error('[ContactsScan] GET error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to get job status'
        }, { status: 500 });
    }
}

// Background contact scan
async function runContactScan(
    jobId: string,
    companyId: number,
    domain: string,
    companyName: string,
    force: boolean
) {
    const job = jobs[jobId];
    if (!job) return;

    console.log(`[ContactsScan] Running scan for ${domain} (company ${companyId})`);
    const startTime = Date.now();
    const allContacts: any[] = [];

    try {
        job.status = 'running';
        job.progress = 10;

        // 1. Hunter API (if available)
        const hunterKey = process.env.HUNTER_API_KEY;
        if (hunterKey) {
            job.progress = 20;
            try {
                // Get domain search - request ALL results (no limit=3!)
                const hunterRes = await fetch(
                    `https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${hunterKey}&limit=100`
                );

                if (hunterRes.ok) {
                    const hunterData = await hunterRes.json();
                    const emails = hunterData.data?.emails || [];

                    console.log(`[ContactsScan] Hunter returned ${emails.length} contacts for ${domain}`);

                    for (const e of emails) {
                        allContacts.push({
                            email: e.value,
                            name: [e.first_name, e.last_name].filter(Boolean).join(' '),
                            role: e.position || '',
                            confidence: (e.confidence || 50) / 100,
                            source: 'hunter',
                            deliverability: e.verification?.status || 'unknown',
                            type: e.type || 'personal'
                        });
                    }
                }
            } catch (e) {
                console.error('[ContactsScan] Hunter error:', e);
            }
        }

        job.progress = 40;

        // 2. Website scraping (simplified - look for mailto links)
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);

            const pageRes = await fetch(`https://${domain}`, {
                signal: controller.signal,
                headers: { 'User-Agent': 'EnvelopeBot/1.0' }
            }).catch(() => null);

            clearTimeout(timeout);

            if (pageRes?.ok) {
                const html = await pageRes.text();

                // Extract mailto links
                const mailtoRegex = /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
                let match;
                while ((match = mailtoRegex.exec(html)) !== null) {
                    const email = match[1].toLowerCase();
                    if (!allContacts.some(c => c.email.toLowerCase() === email)) {
                        allContacts.push({
                            email,
                            name: '',
                            role: '',
                            confidence: 0.6,
                            source: 'website',
                            deliverability: 'unknown',
                            type: isGenericEmail(email) ? 'generic' : 'personal'
                        });
                    }
                }

                console.log(`[ContactsScan] Found ${allContacts.filter(c => c.source === 'website').length} emails from website`);
            }
        } catch (e) {
            console.error('[ContactsScan] Website scrape error:', e);
        }

        job.progress = 60;

        // 3. Deduplicate by email
        const seen = new Set<string>();
        const dedupedContacts = allContacts.filter(c => {
            const email = c.email.toLowerCase();
            if (seen.has(email)) return false;
            seen.add(email);
            return true;
        });

        // 4. Sort by confidence (highest first)
        dedupedContacts.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

        job.progress = 80;
        job.contacts = dedupedContacts;

        // 5. Persist to database
        const enrichmentData = {
            contacts: dedupedContacts,
            bestContacts: dedupedContacts.filter(c => c.type !== 'generic' && c.confidence > 0.7).slice(0, 5),
            moreContacts: dedupedContacts.filter(c => c.type !== 'generic' && c.confidence <= 0.7),
            genericContacts: dedupedContacts.filter(c => c.type === 'generic'),
            lastScannedAt: new Date().toISOString(),
            totalFound: dedupedContacts.length
        };

        await prisma.companyProspect.update({
            where: { id: companyId },
            data: {
                websiteDomain: domain,
                enrichmentData: JSON.stringify(enrichmentData),
                contactsLastScannedAt: new Date()
            }
        });

        job.progress = 100;
        job.status = 'done';

        const duration = Date.now() - startTime;
        console.log(`[ContactsScan] Complete for ${domain}: ${dedupedContacts.length} contacts found in ${duration}ms`);

    } catch (e: any) {
        console.error('[ContactsScan] Job error:', e);
        job.status = 'failed';
        job.error = e.message || 'Scan failed';
    }
}

function isGenericEmail(email: string): boolean {
    const genericPrefixes = [
        'info', 'contact', 'hello', 'support', 'admin', 'sales', 'marketing',
        'team', 'office', 'enquiries', 'inquiries', 'help', 'careers', 'jobs',
        'press', 'media', 'hr', 'recruitment', 'billing', 'accounts'
    ];
    const prefix = email.split('@')[0].toLowerCase();
    return genericPrefixes.includes(prefix);
}
