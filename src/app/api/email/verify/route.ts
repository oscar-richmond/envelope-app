export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { emailVerifier } from '@/lib/services/email-verification';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { email, leadId } = body;

        if (!email) {
            return NextResponse.json({ error: "Email is required" }, { status: 400 });
        }

        // Run Verification
        const result = await emailVerifier.verify(email);

        // Store result if possible (we store on ProspectEmail usually, but if this is just a quick check for a Lead contact?)
        // The prompt says "Store per email". We have ProspectEmail model.
        // We should try to find the ProspectEmail and update it, OR create one if it matches a prospect context.
        // But the composer might be using a manual email or a Lead contact email.
        // For now, let's just return the result to the UI. The UI can display it.
        // Ideally we persist this. Let's see if we can find a ProspectEmail record with this email.

        const existingEmail = await prisma.prospectEmail.findFirst({ where: { email } });
        if (existingEmail) {
            await prisma.prospectEmail.update({
                where: { id: existingEmail.id },
                data: {
                    syntaxValid: result.syntaxValid,
                    mxValid: result.mxValid,
                    roleRisk: result.roleRisk,
                    sendabilityStatus: result.sendabilityStatus,
                    checkedAt: new Date()
                }
            });
        }

        return NextResponse.json(result);

    } catch (error: any) {
        console.error("Verification failed", error);
        return NextResponse.json({ error: "Verification failed" }, { status: 500 });
    }
}
