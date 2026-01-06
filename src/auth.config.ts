
import type { NextAuthConfig } from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"

export const authConfig = {
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true,
        }),
        Credentials({
            id: "passkey",
            name: "Passkey",
            credentials: {},
            authorize: async () => null // Passkeys handled in full auth.ts or API
        })
    ],
    pages: {
        signIn: "/auth/sign-in",
        error: "/auth/error",
    },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const user = auth?.user;
            // @ts-ignore
            const status = user?.accessStatus;

            const isApiAuthRoute = nextUrl.pathname.startsWith("/api/auth");
            const isPublicRoute = nextUrl.pathname === "/auth/sign-in" || nextUrl.pathname === "/auth/request-access";
            const isPendingPage = nextUrl.pathname.startsWith('/auth/pending');

            if (isApiAuthRoute) return true;

            if (isLoggedIn) {
                // Main Gate: If not approved, must be on pending page
                if (status !== 'approved' && !isPendingPage) {
                    return Response.redirect(new URL("/auth/pending", nextUrl));
                }

                // Loop prevention: If approved, keep them out of auth pages
                if (status === 'approved' && (isPendingPage || isPublicRoute)) {
                    return Response.redirect(new URL("/", nextUrl));
                }
                return true;
            }

            // Not Logged In
            if (!isLoggedIn && !isPublicRoute) {
                let callbackUrl = nextUrl.pathname;
                if (nextUrl.search) {
                    callbackUrl += nextUrl.search;
                }
                return Response.redirect(new URL(`/auth/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`, nextUrl));
            }

            return true;
        },
        async session({ session, token }) {
            // In Edge (JWT strategy), we use token
            if (session.user && token) {
                session.user.id = token.sub as string;
                // @ts-ignore
                session.user.accessStatus = token.accessStatus;
                // @ts-ignore
                session.user.isAdmin = token.isAdmin;
            }
            return session
        },
        async jwt({ token, user, trigger, session }) {
            // Initial sign in
            if (user) {
                token.id = user.id;
                // @ts-ignore
                token.accessStatus = user.accessStatus;
                // @ts-ignore
                token.isAdmin = user.isAdmin;
            }
            // Refetch logic would go here if we want real-time updates without DB in middleware
            // (Not possible without DB, so middleware relies on stored JWT state)
            return token;
        }
    },
    session: { strategy: "jwt" } // Force JWT for Edge compatibility middleware reading
} satisfies NextAuthConfig
