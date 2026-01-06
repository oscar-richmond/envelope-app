
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { PasskeyService } from '@/lib/auth/passkeys';
import { cookies } from 'next/headers';

// Challenge Cookie Config
const CHALLENGE_COOKIE = 'auth-challenge';

export async function POST(req: NextRequest, props: { params: Promise<{ action: string[] }> }) {
    const params = await props.params;
    const action = params.action[0]; // 'register-start', 'register-finish', 'auth-start'

    // --- AUTH OPTION (Public) ---
    if (action === 'auth-start') {
        const options = await PasskeyService.generateAuthOptions(req.url);

        // Store challenge
        (await cookies()).set(CHALLENGE_COOKIE, options.challenge, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 5 // 5 mins
        });

        return NextResponse.json(options);
    }

    // --- REGISTRATION (Protected) ---
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (action === 'register-start') {
        // Get user's existing credentials to exclude
        const userPasskeys = await prisma.passkeyCredential.findMany({
            where: { userId: session.user.id },
            select: { credentialId: true }
        });

        const options = await PasskeyService.generateRegisterOptions(
            session.user.id,
            session.user.email || 'user',
            userPasskeys.map(p => p.credentialId),
            req.url
        );

        (await cookies()).set(CHALLENGE_COOKIE, options.challenge, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 5
        });

        return NextResponse.json(options);
    }

    if (action === 'register-finish') {
        const body = await req.json();
        const challenge = (await cookies()).get(CHALLENGE_COOKIE)?.value;

        if (!challenge) {
            return NextResponse.json({ error: "Challenge expired" }, { status: 400 });
        }

        let verification;
        try {
            verification = await PasskeyService.verifyRegisterResponse(body, challenge, req.url);
        } catch (e: any) {
            console.error(e);
            return NextResponse.json({ error: e.message }, { status: 400 });
        }

        if (verification.verified && verification.registrationInfo) {
            const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;

            // Save to DB
            const b64Id = Buffer.from(credentialID).toString('base64url');

            await prisma.passkeyCredential.create({
                data: {
                    userId: session.user.id,
                    credentialId: b64Id,
                    publicKey: Buffer.from(credentialPublicKey),
                    counter: BigInt(counter),
                    transports: JSON.stringify(body.response.transports || [])
                }
            });

            // Clear challenge
            (await cookies()).delete(CHALLENGE_COOKIE);

            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ error: "Verification failed" }, { status: 400 });
        }
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 404 });
}
