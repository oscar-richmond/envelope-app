export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
    const leads = await prisma.lead.findMany({
        orderBy: { createdAt: 'desc' },
    });

    const headers = [
        'Company',
        'Website',
        'Industry',
        'Location',
        'Score',
        'Confidence',
        'Status',
        'Subject Line 1',
        'Subject Line 2',
        'Email Draft'
    ];

    const csvContent = [
        headers.join(','),
        ...leads.map((lead: any) => {
            // Escape CSV fields
            const escape = (str: string | null) => {
                if (!str) return '';
                const escaped = str.replace(/"/g, '""');
                return `"${escaped}"`;
            };

            return [
                escape(lead.companyName),
                escape(lead.websiteUrl),
                escape(lead.industry),
                escape(lead.location),
                lead.stalenessScore,
                escape(lead.scoreConfidence),
                escape(lead.emailStatus),
                escape(lead.subjectLine1),
                escape(lead.subjectLine2),
                escape(lead.emailDraft)
            ].join(',');
        })
    ].join('\n');

    return new NextResponse(csvContent, {
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="leads_export_${new Date().toISOString().split('T')[0]}.csv"`,
        },
    });
}
