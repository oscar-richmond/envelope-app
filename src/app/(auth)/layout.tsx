
export default function AuthLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <div className="w-full max-w-md">
                {/* Optional: Brand Logo could go here above the card */}
                <div className="mb-8 flex justify-center">
                    <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center text-white font-bold text-xl">
                        E
                    </div>
                </div>
                {children}
            </div>
        </div>
    );
}
