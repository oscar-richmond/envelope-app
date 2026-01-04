import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { leads } = body; // Expects array of { companyName, websiteUrl, ... }

        if (!Array.isArray(leads) || leads.length === 0) {
            return NextResponse.json({ error: 'Invalid input: expected array of leads' }, { status: 400 });
        }

        let createdCount = 0;
        let errors = [];

        // Prisma createMany is not supported nicely with SQLite for "skipDuplicates" in all versions/modes,
        // so we'll use a transaction or loop with try/catch to handle individual dupes politely.
        // Ideally we'd use `upsert` or `createMany({ skipDuplicates: true })` if supported.
        // SQLite doesn't strictly support `skipDuplicates` in Prisma createMany until recently.
        // Safe approach for MVP: Sequential loop or Promise.allSettled

        // We'll perform a transaction for speed, but dupes might fail the whole transaction. 
        // Best effort: Iterative create.

        for (const lead of leads) {
            // Basic normalization
            let url = lead.websiteUrl;
            if (!url) continue;
            if (!url.startsWith('http')) url = 'https://' + url;

            try {
                await prisma.lead.create({
                    data: {
                        companyName: lead.companyName || "Unknown Company",
                        websiteUrl: url,
                        industry: lead.industry,
                        location: lead.location,
                        emailStatus: 'NEW'
                    }
                });
                createdCount++;
            } catch (e: any) {
                if (e.code === 'P2002') {
                    // Duplicate URL, ignore
                } else {
                    errors.push({ url, error: e.message });
                }
            }
        }

        return NextResponse.json({
            message: 'Bulk import processed',
            created: createdCount,
            total: leads.length,
            errors
        });
    } catch (error) {
        console.error("Bulk import error:", error);
        return NextResponse.json({ error: 'Failed to process bulk import' }, { status: 500 });
    }
}
