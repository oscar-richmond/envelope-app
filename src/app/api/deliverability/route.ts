export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import {
    getSendingStats,
    checkThrottle,
    assessRisk,
    scanContent,
    cleanContent,
    recordSend,
    recordBounce,
    recordReply,
    recordSpamWarning,
    DEFAULT_THROTTLE_CONFIG
} from '@/lib/services/deliverability';

function getHeaders(requestId: string) {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
        'X-Request-Id': requestId,
    };
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: getHeaders('opt') });
}

// GET /api/deliverability - Get stats and risk status
export async function GET(request: Request) {
    const requestId = `del_${Date.now()}`;
    const headers = getHeaders(requestId);
    const userId = 'default'; // TODO: Get from auth

    const stats = getSendingStats(userId);
    const throttle = checkThrottle(userId);
    const risk = assessRisk(userId);

    return NextResponse.json({
        success: true,
        requestId,
        stats: {
            todaySent: stats.todaySent,
            hourSent: stats.hourSent,
            totalSent: stats.totalSent,
            bounceCount: stats.bounceCount,
            replyCount: stats.replyCount,
            spamWarnings: stats.spamWarnings,
            lastSentAt: stats.lastSentAt,
        },
        throttle: {
            canSend: throttle.canSend,
            reason: throttle.reason,
            nextAvailableAt: throttle.nextAvailableAt,
            limits: DEFAULT_THROTTLE_CONFIG,
        },
        risk: {
            level: risk.level,
            isPaused: risk.isPaused,
            pauseReason: risk.pauseReason,
            bounceRate: risk.bounceRate,
            replyRate: risk.replyRate,
            verificationPassRate: risk.verificationPassRate,
            recommendations: risk.recommendations,
        },
    }, { headers });
}

// POST /api/deliverability - Scan content or record events
export async function POST(request: Request) {
    const requestId = `del_${Date.now()}`;
    const headers = getHeaders(requestId);
    const userId = 'default';

    try {
        const body = await request.json();
        const { action } = body;

        // Scan content before sending
        if (action === 'scan') {
            const { subject, emailBody } = body;
            const result = scanContent(subject || '', emailBody || '');

            return NextResponse.json({
                success: true,
                requestId,
                ...result,
                cleanedBody: cleanContent(emailBody || ''),
            }, { headers });
        }

        // Check if can send
        if (action === 'check') {
            const throttle = checkThrottle(userId);
            const risk = assessRisk(userId);

            const canSend = throttle.canSend && !risk.isPaused;

            return NextResponse.json({
                success: true,
                requestId,
                canSend,
                reason: !throttle.canSend ? throttle.reason :
                    risk.isPaused ? risk.pauseReason : undefined,
                nextAvailableAt: throttle.nextAvailableAt,
            }, { headers });
        }

        // Record send
        if (action === 'record_send') {
            recordSend(userId);
            return NextResponse.json({ success: true, requestId }, { headers });
        }

        // Record bounce
        if (action === 'record_bounce') {
            recordBounce(userId);
            const risk = assessRisk(userId);
            return NextResponse.json({
                success: true,
                requestId,
                risk: { level: risk.level, isPaused: risk.isPaused },
            }, { headers });
        }

        // Record reply
        if (action === 'record_reply') {
            recordReply(userId);
            return NextResponse.json({ success: true, requestId }, { headers });
        }

        // Record spam warning
        if (action === 'record_spam') {
            recordSpamWarning(userId);
            const risk = assessRisk(userId);
            return NextResponse.json({
                success: true,
                requestId,
                risk: { level: risk.level, isPaused: risk.isPaused },
            }, { headers });
        }

        return NextResponse.json({
            success: false,
            error: 'Unknown action'
        }, { status: 400, headers });

    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500, headers });
    }
}
