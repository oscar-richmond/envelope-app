export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import {
    DEFAULT_SEQUENCES,
    createEnrollment,
    advanceEnrollment,
    buildQueueItem,
    type Sequence,
    type SequenceEnrollment,
    type FollowUpQueueItem
} from '@/lib/services/outreach-sequence';

// In-memory storage (use DB in production)
const sequences: Map<string, Sequence> = new Map();
const enrollments: Map<string, SequenceEnrollment> = new Map();

// Initialize default sequences
DEFAULT_SEQUENCES.forEach((seq, i) => {
    const id = `seq_default_${i}`;
    sequences.set(id, {
        ...seq,
        id,
        userId: 'system',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    });
});

function getHeaders(requestId: string) {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
        'X-Request-Id': requestId,
    };
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: getHeaders('opt') });
}

// GET /api/sequences - List sequences and queue
export async function GET(request: Request) {
    const requestId = `seq_${Date.now()}`;
    const headers = getHeaders(requestId);

    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    // Get follow-up queue
    if (action === 'queue') {
        const queue: FollowUpQueueItem[] = [];

        enrollments.forEach((enrollment) => {
            if (enrollment.status !== 'active') return;

            const sequence = sequences.get(enrollment.sequenceId);
            if (!sequence) return;

            const currentStep = sequence.steps[enrollment.currentStepIndex];
            const stepProgress = enrollment.stepProgress[enrollment.currentStepIndex];

            // Only include if scheduled time has passed
            if (new Date(stepProgress.scheduledFor) <= new Date() && stepProgress.status === 'pending') {
                queue.push(buildQueueItem(
                    enrollment,
                    currentStep,
                    'Company Name', // Would come from DB
                    undefined
                ));
            }
        });

        // Sort by priority
        queue.sort((a, b) => b.priority - a.priority);

        return NextResponse.json({
            success: true,
            requestId,
            queue,
            total: queue.length,
        }, { headers });
    }

    // List sequences
    return NextResponse.json({
        success: true,
        requestId,
        sequences: Array.from(sequences.values()),
    }, { headers });
}

// POST /api/sequences - Start sequence or process queue item
export async function POST(request: Request) {
    const requestId = `seq_${Date.now()}`;
    const headers = getHeaders(requestId);

    try {
        const body = await request.json();
        const { action } = body;

        // Start a new sequence
        if (action === 'start') {
            const { sequenceId, companyId, contact, scheduleWindow } = body;

            const sequence = sequences.get(sequenceId);
            if (!sequence) {
                return NextResponse.json({
                    success: false,
                    error: 'Sequence not found'
                }, { status: 404, headers });
            }

            const enrollment = createEnrollment(
                sequenceId,
                companyId,
                contact,
                sequence,
                scheduleWindow
            );

            enrollments.set(enrollment.id, enrollment);

            return NextResponse.json({
                success: true,
                requestId,
                enrollment: {
                    id: enrollment.id,
                    status: enrollment.status,
                    nextStep: enrollment.stepProgress[0],
                },
            }, { headers });
        }

        // Approve and send
        if (action === 'approve') {
            const { enrollmentId, subject, body: emailBody } = body;

            const enrollment = enrollments.get(enrollmentId);
            if (!enrollment) {
                return NextResponse.json({
                    success: false,
                    error: 'Enrollment not found'
                }, { status: 404, headers });
            }

            // Mark as approved and sent
            const updated = advanceEnrollment(enrollment, 'sent');
            enrollments.set(enrollmentId, updated);

            // TODO: Actually send email via Gmail API
            console.log(`[Sequence] Approved email to ${enrollment.contactEmail}: ${subject}`);

            return NextResponse.json({
                success: true,
                requestId,
                sent: true,
                nextStep: updated.currentStepIndex < updated.stepProgress.length
                    ? updated.stepProgress[updated.currentStepIndex]
                    : null,
                sequenceComplete: updated.status === 'completed',
            }, { headers });
        }

        // Skip step
        if (action === 'skip') {
            const { enrollmentId } = body;

            const enrollment = enrollments.get(enrollmentId);
            if (!enrollment) {
                return NextResponse.json({
                    success: false,
                    error: 'Enrollment not found'
                }, { status: 404, headers });
            }

            const updated = advanceEnrollment(enrollment, 'skipped');
            enrollments.set(enrollmentId, updated);

            return NextResponse.json({
                success: true,
                requestId,
                skipped: true,
            }, { headers });
        }

        // Stop sequence
        if (action === 'stop') {
            const { enrollmentId } = body;

            const enrollment = enrollments.get(enrollmentId);
            if (!enrollment) {
                return NextResponse.json({
                    success: false,
                    error: 'Enrollment not found'
                }, { status: 404, headers });
            }

            const updated = advanceEnrollment(enrollment, 'stopped');
            enrollments.set(enrollmentId, updated);

            return NextResponse.json({
                success: true,
                requestId,
                stopped: true,
            }, { headers });
        }

        return NextResponse.json({
            success: false,
            error: 'Unknown action'
        }, { status: 400, headers });

    } catch (error: any) {
        console.error('[Sequences] Error:', error);
        return NextResponse.json({
            success: false,
            error: 'Request failed',
            message: error.message
        }, { status: 500, headers });
    }
}
