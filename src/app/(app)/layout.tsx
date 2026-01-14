
import Sidebar from "@/components/Sidebar";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { CompanyViewerProvider } from "@/components/modals/CompanyViewerProvider";
import { CompanyOverviewModalProvider } from "@/components/modals/CompanyOverviewModalProvider";
import CompanyInspectorWrapper from "@/components/CompanyInspectorWrapper";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DebugOverlayWrapper } from "@/components/debug/DebugOverlayWrapper";

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
        <div className="min-h-screen bg-[var(--background)]">
            <Sidebar />
            <main
                className="min-h-screen overflow-auto flex flex-col transition-all duration-300"
                style={{
                    marginLeft: 'var(--sidebar-width, 300px)',
                    paddingRight: '20px',
                    paddingTop: '20px',
                    paddingBottom: '20px'
                }}
            >
                <CompanyViewerProvider>
                    <CompanyOverviewModalProvider>
                        <CompanyInspectorWrapper>
                            <ErrorBoundary sectionName="Main App Area">
                                {children}
                            </ErrorBoundary>
                        </CompanyInspectorWrapper>
                    </CompanyOverviewModalProvider>
                </CompanyViewerProvider>
            </main>

            {/* CTA Debug Mode - toggle with Cmd+Shift+D */}
            <DebugOverlayWrapper />
        </div>
    );
}

