/**
 * Reset All Data Endpoint
 * 
 * POST /api/admin/reset-all-data
 * 
 * DESTRUCTIVE: Deletes all business data (companies, leads, emails, contacts).
 * PRESERVES: User accounts, auth sessions, Gmail connections, settings, list structures.
 * 
 * Required body:
 * {
 *   "confirm": "DELETE_ALL_BUSINESS_DATA"
 * }
 * 
 * Query params:
 *   ?dryRun=1 - Preview only, no deletes
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

// Check if production reset is allowed
const ALLOW_PROD_DATA_RESET = process.env.ALLOW_PROD_DATA_RESET === 'true';
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

interface ResetResult {
    deleted: {
        followUpQueueItems: number;
        sentEmails: number;
        outreachMessages: number;
        contacts: number;
        emailDrafts: number;
        leads: number;
        prospectEmails: number;
        listCompanies: number;
        scanJobs: number;
        companyProspects: number;
    };
    preserved: string[];
    timeMs: number;
    dryRun: boolean;
}

export async function POST(request: Request) {
    const startTime = Date.now();

    try {
        // Auth check
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if request is a dry run
        const { searchParams } = new URL(request.url);
        const dryRun = searchParams.get('dryRun') === '1' || searchParams.get('dryRun') === 'true';

        // Parse body
        const body = await request.json().catch(() => ({}));
        const { confirm } = body;

        // Production safety gate
        if (IS_PRODUCTION && !dryRun) {
            if (!ALLOW_PROD_DATA_RESET) {
                return NextResponse.json({
                    error: 'Production data reset not allowed',
                    message: 'Set ALLOW_PROD_DATA_RESET=true in Vercel env vars to enable',
                    hint: 'Use ?dryRun=1 to preview what would be deleted'
                }, { status: 403 });
            }
            if (confirm !== 'DELETE_ALL_BUSINESS_DATA') {
                return NextResponse.json({
                    error: 'Confirmation required for production reset',
                    message: 'Include { "confirm": "DELETE_ALL_BUSINESS_DATA" } in body'
                }, { status: 400 });
            }
        }

        // Non-production still requires confirmation for actual deletes
        if (!dryRun && confirm !== 'DELETE_ALL_BUSINESS_DATA') {
            return NextResponse.json({
                error: 'Confirmation required',
                message: 'Include { "confirm": "DELETE_ALL_BUSINESS_DATA" } in body, or use ?dryRun=1 to preview'
            }, { status: 400 });
        }

        console.log(`[ResetAllData] Starting reset (dryRun=${dryRun}, production=${IS_PRODUCTION})`);

        // Count all records that will be deleted
        const counts = {
            followUpQueueItems: await prisma.followUpQueueItem.count(),
            sentEmails: await prisma.sentEmail.count(),
            outreachMessages: await prisma.outreachMessage.count(),
            contacts: await prisma.contact.count(),
            emailDrafts: await prisma.emailDraft.count(),
            leads: await prisma.lead.count(),
            prospectEmails: await prisma.prospectEmail.count(),
            listCompanies: await prisma.listCompany.count(),
            scanJobs: await prisma.scanJob.count(),
            companyProspects: await prisma.companyProspect.count(),
        };

        const result: ResetResult = {
            deleted: { ...counts },
            preserved: [
                'Users & auth sessions',
                'Gmail accounts & tokens',
                'Settings & configuration',
                'Lists (structure only, memberships deleted)',
                'Suppression entries'
            ],
            timeMs: 0,
            dryRun
        };

        if (!dryRun) {
            // Delete in correct order to respect foreign key constraints
            // Start with the most dependent tables first

            // 1. Follow-up queue items (depends on SentEmail)
            await prisma.followUpQueueItem.deleteMany({});
            console.log(`[ResetAllData] Deleted ${counts.followUpQueueItems} follow-up queue items`);

            // 2. Sent emails (depends on Lead)
            await prisma.sentEmail.deleteMany({});
            console.log(`[ResetAllData] Deleted ${counts.sentEmails} sent emails`);

            // 3. Outreach messages (depends on Lead, Contact)
            await prisma.outreachMessage.deleteMany({});
            console.log(`[ResetAllData] Deleted ${counts.outreachMessages} outreach messages`);

            // 4. Contacts (depends on Lead)
            await prisma.contact.deleteMany({});
            console.log(`[ResetAllData] Deleted ${counts.contacts} contacts`);

            // 5. Email drafts (depends on Lead)
            await prisma.emailDraft.deleteMany({});
            console.log(`[ResetAllData] Deleted ${counts.emailDrafts} email drafts`);

            // 6. Leads (depends on CompanyProspect)
            await prisma.lead.deleteMany({});
            console.log(`[ResetAllData] Deleted ${counts.leads} leads`);

            // 7. Prospect emails (depends on CompanyProspect)
            await prisma.prospectEmail.deleteMany({});
            console.log(`[ResetAllData] Deleted ${counts.prospectEmails} prospect emails`);

            // 8. List company memberships (depends on CompanyProspect, List)
            await prisma.listCompany.deleteMany({});
            console.log(`[ResetAllData] Deleted ${counts.listCompanies} list memberships`);

            // 9. Scan jobs (depends on CompanyProspect)
            await prisma.scanJob.deleteMany({});
            console.log(`[ResetAllData] Deleted ${counts.scanJobs} scan jobs`);

            // 10. Company prospects (the main entity)
            await prisma.companyProspect.deleteMany({});
            console.log(`[ResetAllData] Deleted ${counts.companyProspects} company prospects`);

            console.log(`[ResetAllData] Reset complete`);
        }

        result.timeMs = Date.now() - startTime;

        const totalDeleted = Object.values(counts).reduce((a, b) => a + b, 0);

        return NextResponse.json({
            success: true,
            ...result,
            summary: dryRun
                ? `DRY RUN: Would delete ${totalDeleted} records across all tables`
                : `Deleted ${totalDeleted} records. Database reset to clean state.`,
            warning: 'This action is IRREVERSIBLE. All business data has been permanently deleted.'
        });

    } catch (error: any) {
        console.error('[ResetAllData] Error:', error);
        return NextResponse.json({
            error: 'Failed to reset data',
            details: error.message
        }, { status: 500 });
    }
}

export async function GET(request: Request) {
    // GET returns preview info
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const counts = {
            companyProspects: await prisma.companyProspect.count(),
            leads: await prisma.lead.count(),
            sentEmails: await prisma.sentEmail.count(),
            contacts: await prisma.contact.count(),
            emailDrafts: await prisma.emailDraft.count(),
            outreachMessages: await prisma.outreachMessage.count(),
            prospectEmails: await prisma.prospectEmail.count(),
            listCompanies: await prisma.listCompany.count(),
            scanJobs: await prisma.scanJob.count(),
            followUpQueueItems: await prisma.followUpQueueItem.count(),
        };

        const totalRecords = Object.values(counts).reduce((a, b) => a + b, 0);

        return NextResponse.json({
            info: 'Full Data Reset Preview',
            warning: '⚠️ This will DELETE all business data. This action is IRREVERSIBLE.',
            isProduction: IS_PRODUCTION,
            productionResetAllowed: ALLOW_PROD_DATA_RESET,
            willDelete: counts,
            totalRecords,
            willPreserve: [
                'Users & auth sessions',
                'Gmail accounts & OAuth tokens',
                'Settings & configuration',
                'Lists (empty, structure preserved)',
                'Suppression entries'
            ],
            usage: {
                dryRun: 'POST /api/admin/reset-all-data?dryRun=1',
                execute: 'POST /api/admin/reset-all-data with { "confirm": "DELETE_ALL_BUSINESS_DATA" }'
            }
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
