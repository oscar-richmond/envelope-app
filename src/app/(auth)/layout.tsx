
export default function AuthLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <div className="min-h-screen flex items-center justify-center p-4 md:p-8 relative overflow-hidden">
            {/* Premium Background - uses --hero-gradient token */}
            <div
                className="absolute inset-0 -z-10"
                style={{
                    background: 'var(--hero-gradient)'
                }}
            />

            {/* Gradient Blobs - use --blob-* tokens */}
            <div
                className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full -z-10 animate-in fade-in duration-1000"
                style={{
                    background: 'var(--blob-brand)',
                    filter: 'blur(80px)'
                }}
            />
            <div
                className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] rounded-full -z-10 animate-in fade-in duration-1000 delay-200"
                style={{
                    background: 'var(--blob-mint)',
                    filter: 'blur(80px)'
                }}
            />
            <div
                className="absolute top-[30%] right-[20%] w-[30%] h-[30%] rounded-full -z-10 animate-in fade-in duration-1000 delay-300"
                style={{
                    background: 'var(--blob-lilac)',
                    filter: 'blur(60px)'
                }}
            />

            {/* Subtle Noise Overlay */}
            <div
                className="absolute inset-0 -z-10 opacity-[0.02] pointer-events-none"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'repeat'
                }}
            />

            {/* Main Content */}
            <div className="w-full max-w-6xl flex flex-col items-start gap-6">
                {/* Logo - Left-aligned with Sign in heading */}
                <div className="w-full lg:w-[420px] pl-0 animate-in fade-in duration-500">
                    <img
                        src="/brand/envelope-logo-dark.png"
                        alt="Envelope"
                        style={{ height: '72px', width: 'auto' }}
                    />
                </div>

                {/* Two-card layout */}
                <div className="w-full flex flex-col lg:flex-row items-center lg:items-stretch gap-8 lg:gap-16">
                    {children}
                </div>
            </div>
        </div>
    );
}
