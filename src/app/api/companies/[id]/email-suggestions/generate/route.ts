import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { generateEmailFromPattern, patternRequiresLastName, PatternKey } from '@/lib/services/email-pattern';

/**
 * POST /api/companies/[id]/email-suggestions/generate
 * 
 * Generate suggested emails for name-only contacts
 */
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const companyId = parseInt(id);
        if (isNaN(companyId)) {
            return NextResponse.json({ error: 'Invalid company ID' }, { status: 400 });
        }

        console.log(`[EmailSuggestions] Generating suggestions for company ${companyId}...`);

        // Get prospect
        const prospect = await prisma.companyProspect.findUnique({
            where: { id: companyId },
            select: {
                id: true,
                manualContacts: true,
                enrichmentData: true
            }
        });

        if (!prospect) {
            return NextResponse.json({ error: 'Company not found' }, { status: 404 });
        }

        // Pattern field removed from schema - this route needs refactoring
        return NextResponse.json({
            error: 'Email pattern functionality temporarily unavailable - schema field removed',
            noPattern: true
        }, { status: 503 });

    } catch (error: any) {
        console.error('[EmailSuggestions] Error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to generate email suggestions'
        }, { status: 500 });
    }
}

/**
 * GET /api/companies/[id]/email-suggestions
 * 
 * Get existing suggestions
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const companyId = parseInt(id);
        if (isNaN(companyId)) {
            return NextResponse.json({ error: 'Invalid company ID' }, { status: 400 });
        }

        const prospect = await prisma.companyProspect.findUnique({
            where: { id: companyId },
            select: {
                enrichmentData: true
            }
        });

        if (!prospect) {
            return NextResponse.json({ error: 'Company not found' }, { status: 404 });
        }

        // Pattern field removed from schema
        const pattern = null;
        const suggestions: any[] = [];

        return NextResponse.json({
            hasPattern: !!pattern,
            pattern,
            suggestions,
            count: suggestions.length
        });

    } catch (error: any) {
        console.error('[EmailSuggestions] GET error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to get email suggestions'
        }, { status: 500 });
    }
}
