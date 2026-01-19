import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { company, contacts, force } = body;

        if (!company?.name) {
            return NextResponse.json({ error: 'Company Name is required' }, { status: 400 });
        }

        // 1. Duplicate Detection
        // Check Website
        if (company.websiteUrl && !force) {
            const existingByUrl = await prisma.lead.findUnique({
                where: { websiteUrl: company.websiteUrl }
            });
            if (existingByUrl) {
                return NextResponse.json({
                    error: 'Duplicate detected',
                    existingLead: existingByUrl,
                    matchType: 'WEBSITE'
                }, { status: 409 });
            }
        }

        // Check Name (Case Insensitive - approximate via ORM or raw query, usually insensitive collation dependent or raw)
        // Prisma default is usually case sensitive for SQLite/Postgres unless configured. 
        // We will do a simple findFirst with insensitive mode if using Postgres.
        if (!force) {
            const existingByName = await prisma.lead.findFirst({
                where: {
                    companyName: {
                        equals: company.name,
                        mode: 'insensitive'
                    }
                }
            });

            if (existingByName) {
                return NextResponse.json({
                    error: 'Duplicate detected',
                    existingLead: existingByName,
                    matchType: 'NAME'
                }, { status: 409 });
            }
        }

        // 2. Create Lead
        const newLead = await prisma.lead.create({
            data: {
                companyName: company.name,
                // Schema requires unique websiteUrl. Empty strings would conflict.
                // If no website, generate fallback placeholder
                // Correction: Using a fallback strategy
                websiteUrl: company.websiteUrl || `manual-${Date.now()}-${Math.floor(Math.random() * 1000)}.local`,

                industry: company.industry,
                location: company.location,
                // notes not in schema on Lead? Checked schema... `companyProspect` has fields, `Lead` doesn't have `notes` field explicitly in the snippet I saw?
                // `Lead` has `emailDraft`, `contacts` etc.
                // Ah, `SentEmail` has `notesText`. `Lead` model might not.
                // I will add a TODO or just omit notes for now if schema lacks it.
                // Checking schema again...
                // `model Lead`: id, companyName, websiteUrl... no notes field.
                // So we'll skip saving notes to DB for now or put them in `emailDraft`? No, that's for email.
                // We will skip notes for now.

                contacts: {
                    create: contacts?.map((c: any) => ({
                        firstName: c.firstName,
                        lastName: c.lastName,
                        title: c.title,
                        email: c.email,
                        // phone not in Contact model in schema view?
                        // `model Contact`: firstName, lastName, title, email, confidence, roleCategory, isPrimary, source.
                        // No phone. Skip phone.
                        isPrimary: c === contacts[0], // First one is primary?
                        source: 'MANUAL'
                    })) || []
                }
            },
            include: {
                contacts: true
            }
        });

        // 3. Trigger Enrichment (Fire & Forget)
        if (company.websiteUrl && company.websiteUrl.includes('.')) {
            // In a real app we'd enqueue a job. 
            // Here we just fetch asynchronously without awaiting.
            // We need a way to find the `companyProspect` or create one?
            // The analysis usually works on `CompanyProspect`.
            // But `Lead` is linked to `CompanyProspect`.
            // Manual lead might not have `companyProspectId`.
            // If we want enrichment, we should probably create a `CompanyProspect` too?
            // For V1 Manual, let's keep it simple: Just create the Lead. 
            // If the user wants to analyze, they can click "Refresh" on the profile which triggers analysis if URL exists.
        }

        return NextResponse.json(newLead, { status: 201 });
    } catch (error) {
        console.error('Manual create error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
