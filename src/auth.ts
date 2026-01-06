
import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import prisma from "@/lib/prisma"
import { authConfig } from "./auth.config"
import { cookies } from "next/headers"
import { PasskeyService } from "@/lib/auth/passkeys"
import Credentials from "next-auth/providers/credentials"

// We need to merge the providers carefully because we want to enable the real Credentials logic here
// which relies on the DB, unavailable in auth.config.ts
const fullConfig = {
    ...authConfig,
    adapter: PrismaAdapter(prisma),
    providers: [
        ...authConfig.providers.filter(p => p.id !== 'credentials'), // Remove mock
        Credentials({
            id: "passkey",
            name: "Passkey",
            credentials: {
                id: { label: "Credential ID", type: "text" },
                rawId: { label: "Raw ID", type: "text" },
                response: { label: "Response", type: "text" },
                type: { label: "Type", type: "text" },
                clientExtensionResults: { label: "Ext", type: "text" },
                authenticatorAttachment: { label: "Auth Attachment", type: "text" },
            },
            authorize: async (credentials: any) => {
                const challenge = (await cookies()).get('auth-challenge')?.value;
                if (!challenge) throw new Error("Missing challenge");

                const credId = credentials.id;

                const dbCred = await prisma.passkeyCredential.findFirst({
                    where: { credentialId: credId },
                    include: { user: true }
                });

                if (!dbCred) throw new Error("Credential not found");

                const verification = await PasskeyService.verifyAuthResponse(
                    credentials,
                    challenge,
                    dbCred.publicKey,
                    Number(dbCred.counter),
                    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
                );

                if (verification.verified && verification.authenticationInfo) {
                    const { newCounter } = verification.authenticationInfo;

                    await prisma.passkeyCredential.update({
                        where: { id: dbCred.id },
                        data: {
                            counter: BigInt(newCounter),
                            lastUsedAt: new Date()
                        }
                    });

                    (await cookies()).delete('auth-challenge');

                    // Return user object for JWT
                    return {
                        id: dbCred.user.id,
                        name: dbCred.user.name,
                        email: dbCred.user.email,
                        // Custom fields need to be handled in jwt callback via user arg
                        // But Adapter 'user' differs from 'authorize' return.
                        // We attach them to the returned object:
                        accessStatus: dbCred.user.accessStatus,
                        isAdmin: dbCred.user.isAdmin
                    };
                }

                return null;
            }
        })
    ],
    session: { strategy: "jwt" }, // Ensure consistency
    events: {
        async createUser({ user }) {
            const adminEmail = process.env.INITIAL_ADMIN_EMAIL;
            if (adminEmail && user.email === adminEmail) {
                console.log(`Bootstrapping Initial Admin: ${user.email}`);
                await prisma.user.update({
                    where: { id: user.id },
                    data: {
                        isAdmin: true,
                        accessStatus: 'approved',
                        approvedAt: new Date(),
                        approvedByUserId: 'system'
                    }
                });
            }
        }
    },
    callbacks: {
        ...authConfig.callbacks,
        // Extend JWT callback to fetch latest status from DB if possible?
        // Or just rely on initial login.
        // For robustness, usually we want to check DB on each session?
        // But doing so in JWT callback might run on Edge if not careful?
        // Actually auth.ts is not Edge.
        // But session() callback in auth.config runs on Edge in Middleware.

        async jwt({ token, user, trigger, session }) {
            if (user) {
                token.id = user.id;
                // @ts-ignore
                token.accessStatus = user.accessStatus || 'waitlisted';
                // @ts-ignore
                token.isAdmin = user.isAdmin || false;
            }
            // On update trigger?
            return token;
        }
    }
}

export const { handlers, auth, signIn, signOut } = NextAuth(fullConfig as any)
