import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Forensic endpoint to debug ID resolution for Website Health scans
 * 
 * GET /api/dev/resolve-health-ids?companyId=788
 * 
 * Returns all matching prospect rows and shows which one would be used for scans
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const companyIdParam = searchParams.get('companyId');

        if (!companyIdParam) {
            return NextResponse.json({
                error: 'companyId parameter required'
            }, { status: 400 });
        }

        const companyId = parseInt(companyIdParam);
        if (isNaN(companyId)) {
            return NextResponse.json({
                error: 'companyId must be a number'
            }, { status: 400 });
        }

        // Find ALL prospects matching this companyId
        const allMatches = await prisma.companyProspect.findMany({
            where: { id: companyId },
            select: {
                id: true,
                companyName: true,
                websiteUrl: true,
                websiteHealthVersion: true,
                websiteHealthStatus: true,
                websiteHealthScore: true,
                websiteHealthLabel: true,
                websiteHealthScannedAt: true,
                websiteHealthError: true,
                websiteHealthTraceId: true,
                websiteHealthLastWriter: true,
                websiteHealthLastSurface: true,
                webHealthData: true,
                createdAt: true,
                updatedAt: true
            }
        });

        // The record that would be used by scan endpoint
        const primaryRecord = await prisma.companyProspect.findUnique({
            where: { id: companyId },
            select: {
                id: true,
                companyName: true,
                websiteHealthVersion: true,
                websiteHealthStatus: true,
                websiteHealthScore: true,
                webHealthData: true
            }
        });

        return NextResponse.json({
            query: {
                companyId,
                method: 'findUnique with id: ' + companyId
            },
            matchCount: allMatches.length,
            allMatches,
            primaryRecord,
            scanWouldUse: primaryRecord ? primaryRecord.id : null,
            diagnosis: {
                hasMultipleMatches: allMatches.length > 1,
                primaryExists: !!primaryRecord,
                primaryMatchesQuery: primaryRecord ? allMatches.some(m => m.id === primaryRecord.id) : false,
                recommendation: allMatches.length === 0
                    ? '❌ No records found - ID does not exist'
                    : allMatches.length === 1
                        ? '✅ Single record found - scan will write to this record'
                        : '⚠️ Multiple records found - potential ID conflict'
            }
        });

    } catch (error: any) {
        console.error('[ResolveHealthIds] Error:', error);
        return NextResponse.json({
            error: 'Failed to resolve IDs',
            detail: error.message
        }, { status: 500 });
    }
}
