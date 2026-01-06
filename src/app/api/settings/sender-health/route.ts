export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { senderHealthService } from '@/lib/services/sender-health';

/**
 * GET /api/settings/sender-health
 * Returns sender health status and guidance
 */
export async function GET(req: NextRequest) {
    try {
        // Get Gmail account status
        const gmailAccount = await prisma.gmailAccount.findFirst();
        const gmailConnected = !!gmailAccount?.accessToken;

        // Get domain from connected email
        const domain = gmailAccount?.email?.split('@')[1] || 'unknown';

        // Get sending stats (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const [totalSent, bounces, replies, todaySent] = await Promise.all([
            prisma.sentEmail.count({
                where: { sentAt: { gte: thirtyDaysAgo } }
            }),
            prisma.sentEmail.count({
                where: {
                    sentAt: { gte: thirtyDaysAgo },
                    status: 'BOUNCED'
                }
            }),
            prisma.sentEmail.count({
                where: {
                    sentAt: { gte: thirtyDaysAgo },
                    status: 'REPLIED'
                }
            }),
            prisma.sentEmail.count({
                where: {
                    sentAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
                }
            })
        ]);

        // Get sender health
        const health = await senderHealthService.getSenderHealth(
            gmailConnected,
            domain,
            { totalSent, bounces, replies }
        );

        // Check volume guidance for today
        const volumeWarning = senderHealthService.checkVolumeGuidance(
            todaySent,
            health.recommendedDailyVolume
        );

        return NextResponse.json({
            success: true,
            domain,
            gmailConnected,
            health: {
                ...health,
                volumeWarning,
                todaySent
            }
        });

    } catch (e: any) {
        console.error('Sender health check error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
