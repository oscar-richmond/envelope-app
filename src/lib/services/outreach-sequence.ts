/**
 * Phase 7: Outreach Sequence Service
 * Multi-step email sequences with approval-first follow-ups
 */

// ============================================
// TYPES
// ============================================

export type SequenceChannel = 'email';
export type StopCondition = 'replied' | 'bounced' | 'unsubscribed' | 'manual_stop';
export type SequenceStatus = 'active' | 'paused' | 'completed' | 'stopped';
export type StepStatus = 'pending' | 'queued' | 'approved' | 'sent' | 'skipped' | 'stopped';

export interface SequenceStep {
    id: string;
    dayOffset: number;
    templateId: string;
    channel: SequenceChannel;
    subject?: string;
    bodyTemplate?: string;
}

export interface Sequence {
    id: string;
    name: string;
    userId: string;
    steps: SequenceStep[];
    stopConditions: StopCondition[];
    createdAt: string;
    updatedAt: string;
}

export interface SequenceEnrollment {
    id: string;
    sequenceId: string;
    companyId: string;
    contactId: string;
    contactEmail: string;
    contactName?: string;
    status: SequenceStatus;
    currentStepIndex: number;
    startedAt: string;
    completedAt?: string;
    stoppedReason?: StopCondition | 'manual';
    scheduleWindow: {
        weekdaysOnly: boolean;
        startHour: number; // 9
        endHour: number;   // 17
        timezone: string;
    };
    stepProgress: StepProgress[];
}

export interface StepProgress {
    stepIndex: number;
    status: StepStatus;
    scheduledFor: string;
    queuedAt?: string;
    approvedAt?: string;
    sentAt?: string;
    messageId?: string;
}

export interface FollowUpQueueItem {
    id: string;
    enrollmentId: string;
    stepIndex: number;
    companyName: string;
    contactName: string;
    contactEmail: string;
    threadSummary?: string;
    previousEmailPreview?: string;
    suggestedDrafts: {
        tone: 'friendly' | 'professional' | 'urgent';
        subject: string;
        body: string;
    }[];
    scheduledFor: string;
    priority: number;
}

// ============================================
// DEFAULT SEQUENCES
// ============================================

export const DEFAULT_SEQUENCES: Omit<Sequence, 'id' | 'userId' | 'createdAt' | 'updatedAt'>[] = [
    {
        name: 'Web Development Outreach',
        steps: [
            { id: 'step_1', dayOffset: 0, templateId: 'initial_outreach', channel: 'email' },
            { id: 'step_2', dayOffset: 3, templateId: 'follow_up_1', channel: 'email' },
            { id: 'step_3', dayOffset: 7, templateId: 'follow_up_2', channel: 'email' },
        ],
        stopConditions: ['replied', 'bounced', 'unsubscribed'],
    },
    {
        name: 'Quick Follow-up',
        steps: [
            { id: 'step_1', dayOffset: 0, templateId: 'initial_outreach', channel: 'email' },
            { id: 'step_2', dayOffset: 2, templateId: 'quick_bump', channel: 'email' },
        ],
        stopConditions: ['replied', 'bounced', 'unsubscribed'],
    },
];

// ============================================
// TIMING LOGIC
// ============================================

export function isWithinSendingWindow(
    date: Date,
    window: SequenceEnrollment['scheduleWindow']
): boolean {
    const hour = date.getHours();
    const day = date.getDay();

    // Check weekday
    if (window.weekdaysOnly && (day === 0 || day === 6)) {
        return false;
    }

    // Check hours
    return hour >= window.startHour && hour < window.endHour;
}

export function getNextSendTime(
    fromDate: Date,
    dayOffset: number,
    window: SequenceEnrollment['scheduleWindow']
): Date {
    const targetDate = new Date(fromDate);
    targetDate.setDate(targetDate.getDate() + dayOffset);

    // Adjust to sending window
    if (targetDate.getHours() < window.startHour) {
        targetDate.setHours(window.startHour, 0, 0, 0);
    } else if (targetDate.getHours() >= window.endHour) {
        // Move to next day
        targetDate.setDate(targetDate.getDate() + 1);
        targetDate.setHours(window.startHour, 0, 0, 0);
    }

    // Skip weekends if needed
    if (window.weekdaysOnly) {
        while (targetDate.getDay() === 0 || targetDate.getDay() === 6) {
            targetDate.setDate(targetDate.getDate() + 1);
        }
    }

    return targetDate;
}

export function shouldEnterQueue(
    enrollment: SequenceEnrollment,
    currentStep: StepProgress
): boolean {
    // Already in queue or sent
    if (currentStep.status !== 'pending') return false;

    // Check if scheduled time has passed
    const scheduledTime = new Date(currentStep.scheduledFor);
    if (new Date() < scheduledTime) return false;

    // Check stop conditions (would need external data for reply/bounce/unsub)
    if (enrollment.status !== 'active') return false;

    return true;
}

// ============================================
// ENROLLMENT MANAGEMENT
// ============================================

export function createEnrollment(
    sequenceId: string,
    companyId: string,
    contact: { id: string; email: string; name?: string },
    sequence: Sequence,
    scheduleWindow?: Partial<SequenceEnrollment['scheduleWindow']>
): SequenceEnrollment {
    const now = new Date();
    const window: SequenceEnrollment['scheduleWindow'] = {
        weekdaysOnly: true,
        startHour: 9,
        endHour: 17,
        timezone: 'Europe/London',
        ...scheduleWindow,
    };

    const stepProgress: StepProgress[] = sequence.steps.map((step, index) => ({
        stepIndex: index,
        status: 'pending',
        scheduledFor: getNextSendTime(now, step.dayOffset, window).toISOString(),
    }));

    return {
        id: `enroll_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        sequenceId,
        companyId,
        contactId: contact.id,
        contactEmail: contact.email,
        contactName: contact.name,
        status: 'active',
        currentStepIndex: 0,
        startedAt: now.toISOString(),
        scheduleWindow: window,
        stepProgress,
    };
}

export function advanceEnrollment(
    enrollment: SequenceEnrollment,
    action: 'sent' | 'skipped' | 'stopped'
): SequenceEnrollment {
    const updated = { ...enrollment };
    const currentProgress = updated.stepProgress[updated.currentStepIndex];

    if (action === 'stopped') {
        updated.status = 'stopped';
        updated.stoppedReason = 'manual';
        currentProgress.status = 'stopped';
        return updated;
    }

    currentProgress.status = action;
    if (action === 'sent') {
        currentProgress.sentAt = new Date().toISOString();
    }

    // Move to next step
    if (updated.currentStepIndex < updated.stepProgress.length - 1) {
        updated.currentStepIndex++;
    } else {
        updated.status = 'completed';
        updated.completedAt = new Date().toISOString();
    }

    return updated;
}

// ============================================
// FOLLOW-UP QUEUE
// ============================================

export function buildQueueItem(
    enrollment: SequenceEnrollment,
    step: SequenceStep,
    companyName: string,
    previousEmail?: { subject: string; body: string }
): FollowUpQueueItem {
    const stepProgress = enrollment.stepProgress[enrollment.currentStepIndex];

    return {
        id: `queue_${enrollment.id}_${enrollment.currentStepIndex}`,
        enrollmentId: enrollment.id,
        stepIndex: enrollment.currentStepIndex,
        companyName,
        contactName: enrollment.contactName || enrollment.contactEmail,
        contactEmail: enrollment.contactEmail,
        threadSummary: previousEmail ? `Re: ${previousEmail.subject}` : undefined,
        previousEmailPreview: previousEmail?.body.slice(0, 150),
        suggestedDrafts: generateDrafts(companyName, enrollment.contactName, enrollment.currentStepIndex),
        scheduledFor: stepProgress.scheduledFor,
        priority: calculatePriority(enrollment, stepProgress),
    };
}

function generateDrafts(
    companyName: string,
    contactName: string | undefined,
    stepIndex: number
): FollowUpQueueItem['suggestedDrafts'] {
    const name = contactName?.split(' ')[0] || 'there';

    if (stepIndex === 0) {
        return [
            {
                tone: 'friendly',
                subject: `Quick question about ${companyName}'s website`,
                body: `Hi ${name},\n\nI came across ${companyName} and noticed your website could benefit from a refresh.\n\nWould you be open to a quick chat about how we could help?\n\nBest,`,
            },
            {
                tone: 'professional',
                subject: `Web development opportunity for ${companyName}`,
                body: `Dear ${name},\n\nI hope this email finds you well. I'm reaching out regarding potential improvements to ${companyName}'s web presence.\n\nWould you have 15 minutes to discuss?\n\nKind regards,`,
            },
            {
                tone: 'urgent',
                subject: `${companyName} - Quick website question`,
                body: `Hi ${name},\n\nI wanted to quickly reach out about ${companyName}'s website.\n\nI have some ideas that could help - do you have 5 minutes?\n\nThanks,`,
            },
        ];
    }

    // Follow-up drafts
    return [
        {
            tone: 'friendly',
            subject: `Following up - ${companyName}`,
            body: `Hi ${name},\n\nJust wanted to follow up on my previous email about ${companyName}'s website.\n\nLet me know if you'd like to chat!\n\nBest,`,
        },
        {
            tone: 'professional',
            subject: `Re: Web development opportunity for ${companyName}`,
            body: `Dear ${name},\n\nI wanted to follow up on my previous message regarding ${companyName}'s web presence.\n\nI'd welcome the opportunity to discuss this further at your convenience.\n\nKind regards,`,
        },
        {
            tone: 'urgent',
            subject: `Re: ${companyName} - Following up`,
            body: `Hi ${name},\n\nJust checking in - did you get a chance to see my previous email?\n\nHappy to jump on a quick call whenever works.\n\nThanks,`,
        },
    ];
}

function calculatePriority(enrollment: SequenceEnrollment, step: StepProgress): number {
    let priority = 50;

    // Higher priority for overdue
    const scheduledTime = new Date(step.scheduledFor);
    const hoursSinceScheduled = (Date.now() - scheduledTime.getTime()) / (1000 * 60 * 60);
    if (hoursSinceScheduled > 24) priority += 20;
    else if (hoursSinceScheduled > 0) priority += 10;

    // Higher priority for first step
    if (enrollment.currentStepIndex === 0) priority += 15;

    return priority;
}
