
import Sidebar from "@/components/Sidebar";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function AppLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const session = await auth();

    // 1. Enforce Authentication
    if (!session?.user) {
        redirect("/auth/sign-in");
    }

    // 2. Enforce Approval (Double Check)
    // @ts-ignore
    if (session.user.accessStatus !== "approved") {
        redirect("/auth/pending");
    }

    return (
        <div className="flex min-h-screen bg-[var(--background)]">
            <Sidebar />
            <main className="flex-1 overflow-auto">
                {children}
            </main>
        </div>
    );
}
