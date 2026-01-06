
'use server';

import prisma from '@/lib/prisma';
import { redirect } from 'next/navigation';

export async function requestAccess(formData: FormData) {
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const note = formData.get('note') as string;
    const company = formData.get('company') as string;

    if (!email) {
        return { error: 'Email is required' };
    }

    try {
        const existing = await prisma.user.findUnique({
            where: { email },
        });

        if (existing) {
            // Already exists.
            if (existing.accessStatus === 'approved') {
                return { error: 'Account already exists and is active. Please sign in.' };
            } else if (existing.accessStatus === 'denied') {
                return { error: 'Unable to grant access at this time.' };
            } else {
                return { error: 'You are already on the waitlist.' };
            }
        }

        await prisma.user.create({
            data: {
                name,
                email,
                requestNote: note,
                company,
                accessStatus: 'waitlisted',
            },
        });

    } catch (e) {
        console.error(e);
        return { error: 'Failed to process request.' };
    }

    // Success redirect
    redirect('/auth/request-access?success=true');
}
