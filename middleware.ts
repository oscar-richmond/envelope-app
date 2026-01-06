
import { auth } from "@/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
    const { nextUrl } = req;
    const isLoggedIn = !!req.auth;
    const user = req.auth?.user;
    // @ts-ignore
    const status = user?.accessStatus;

    const isApiAuthRoute = nextUrl.pathname.startsWith("/api/auth");
    const isPublicRoute = nextUrl.pathname === "/auth/sign-in" || nextUrl.pathname === "/auth/request-access";
    const isAuthRoute = nextUrl.pathname.startsWith("/auth");

    if (isApiAuthRoute) {
        return NextResponse.next();
    }

    if (isLoggedIn) {
        // Gates
        if (status !== 'approved' && !nextUrl.pathname.startsWith('/auth/pending')) {
            return NextResponse.redirect(new URL("/auth/pending", nextUrl));
        }

        // Loop prevention: If approved and trying to go to pending, invoke logic to go home
        if (status === 'approved' && nextUrl.pathname.startsWith('/auth/pending')) {
            return NextResponse.redirect(new URL("/", nextUrl));
        }

        // Loop prevention: If approved and trying to go to sign-in
        if (status === 'approved' && isPublicRoute) {
            return NextResponse.redirect(new URL("/", nextUrl));
        }

        return NextResponse.next();
    }

    if (!isLoggedIn && !isPublicRoute) {
        // Redirect logic callback
        let callbackUrl = nextUrl.pathname;
        if (nextUrl.search) {
            callbackUrl += nextUrl.search;
        }

        const encodedCallbackUrl = encodeURIComponent(callbackUrl);
        return NextResponse.redirect(new URL(`/auth/sign-in?callbackUrl=${encodedCallbackUrl}`, nextUrl));
    }

    return NextResponse.next();
})

// Matcher: Everything except static files and images
export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
