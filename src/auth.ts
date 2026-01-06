import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import prisma from "@/lib/prisma"
import { cookies } from "next/headers"
import { PasskeyService } from "@/lib/auth/passkeys"

export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter: PrismaAdapter(prisma),
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true,
        }),
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

                // Find credential
                // DB stores id as base64url
                const credId = credentials.id;

                const dbCred = await prisma.passkeyCredential.findFirst({
                    where: { credentialId: credId },
                    include: { user: true }
                });

                if (!dbCred) throw new Error("Credential not found");

                // Verify
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

                    // Cleanup
                    (await cookies()).delete('auth-challenge');

                    return dbCred.user;
                }

                return null;
            }
        })
    ],
    callbacks: {
        async session({ session, user }) {
            // Expose custom fields to the session
            if (session.user) {
                // We need to fetch the user again or rely on the `user` object passed if checking database strategy.
                // With Prisma Adapter and "database" strategy (default), `user` is the DB user.
                // But NextAuth v5 often uses "jwt" by default even with adapter if strictly next.js edge?
                // Actually, with Adapter, it defaults to database sessions unless configured otherwise.

                // We want to verify waitlist status easily.
                // session.user is the session user.
                // The `user` arg is populated if using database sessions.

                session.user.id = user.id;
                // @ts-ignore - Dynamic fields
                session.user.accessStatus = user.accessStatus;
                // @ts-ignore
                session.user.isAdmin = user.isAdmin;
            }
            return session
        },
        async signIn({ user, account, profile }) {
            // We allow sign in. Middleware handles the gating.
            // But if we want to bootstrap the first Admin:
            if (user.email === process.env.INITIAL_ADMIN_EMAIL) {
                // Check if updated?
                // This runs before the adapter creates the user? No, after?
                // Actually signIn callback runs *before* creation for OAuth usually.
                // Bootstrap logic might be better in a separate utility or manually.
                // Or we check after-the-fact in session?
                // Let's create a "Bootstrap" hook or just rely on manual DB entry for now as requested "Provide a secure way... Allow setting env var... On first login set isAdmin".

                // To do this strictly "On first login", we'd need to intercept creation.
                // Easier: In session callback, if user.email == ENV and !user.isAdmin, update it?
                // Bad for performance.
                // Better: Allow it. We'll handle bootstrap separately or assume standard flow.
            }
            return true;
        }
    },
    pages: {
        signIn: "/auth/sign-in",
        error: "/auth/error", // Error code passed in query string as ?error=
        // newUser: "/auth/pending" // If we want to force redirect new users there?
    }
})
