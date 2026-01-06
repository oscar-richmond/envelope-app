'use client';

import { useState, useEffect, Suspense } from 'react';
import { Mail, CheckCircle, XCircle, LogOut, Lock } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

function SettingsContent() {
    const searchParams = useSearchParams();
    const [connection, setConnection] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/settings/gmail')
            .then(res => res.json())
            .then(data => {
                setConnection(data.connected ? data : null);
                setLoading(false);
            });
    }, []);

    const handleDisconnect = async () => {
        if (!confirm("Disconnect Gmail?")) return;
        await fetch('/api/settings/gmail', { method: 'DELETE' });
        setConnection(null);
    };

    const handleAddPasskey = async () => {
        try {
            // 1. Get options
            const res = await fetch('/api/auth/passkey/register-start', { method: 'POST' });
            if (!res.ok) throw new Error('Failed to init passkey registration');
            const options = await res.json();

            // 2. Start ceremony
            // Dynamic import to avoid SSR issues if not handled by component structure, but client component is fine usually.
            const { startRegistration } = await import('@simplewebauthn/browser');

            let attResp;
            try {
                attResp = await startRegistration(options);
            } catch (error: any) {
                if (error.name === 'InvalidStateError') {
                    throw new Error('Authenticator was probably already registered by this user');
                }
                throw error;
            }

            // 3. Verify
            const verRes = await fetch('/api/auth/passkey/register-finish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(attResp),
            });

            if (verRes.ok) {
                alert('Passkey added successfully!');
            } else {
                const data = await verRes.json();
                throw new Error(data.error || 'Verification failed');
            }
        } catch (e: any) {
            console.error(e);
            alert(e.message || "Failed to add passkey");
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-8">Settings</h1>

            {/* Notifications */}
            {searchParams.get('connected') && (
                <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md flex items-center gap-2">
                    <CheckCircle size={18} />
                    Gmail connected successfully as {searchParams.get('connected')}
                </div>
            )}

            {/* Gmail Connection Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
                <div className="p-6 border-b border-gray-100">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Mail className="text-gray-500" /> Gmail Integration
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">Connect your workspace account to send outreach emails directly.</p>
                </div>

                <div className="p-6">
                    {loading ? (
                        <div className="animate-pulse h-10 bg-gray-100 rounded w-1/3"></div>
                    ) : connection ? (
                        <div>
                            <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg p-4 mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                                        {connection.email[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="font-medium text-gray-900">{connection.email}</div>
                                        <div className="text-xs text-blue-600 font-medium">Connected • {connection.sentToday}/{connection.limit} sends today</div>
                                    </div>
                                </div>
                                <button onClick={handleDisconnect} className="text-gray-400 hover:text-red-600 transition">
                                    <LogOut size={18} />
                                </button>
                            </div>
                            <p className="text-xs text-gray-400">
                                Using the primary connected account for all outbound prospect emails.
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-start gap-4">
                            <a
                                href={typeof window !== 'undefined' ? `/api/auth/google?origin=${encodeURIComponent(window.location.origin)}` : '/api/auth/google'}
                                className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium py-2 px-4 rounded-md shadow-sm flex items-center gap-2 transition"
                            >
                                <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
                                Connect Gmail Account
                            </a>
                            <div className="flex flex-col gap-2 mt-2 p-3 bg-gray-50 rounded border border-gray-200 w-full text-xs">
                                <div>
                                    <span className="font-bold text-gray-500 uppercase text-[10px]">Your Current URL (Dynamic)</span>
                                    <code className="block bg-white border border-gray-100 p-1 rounded mt-1 break-all">
                                        {typeof window !== 'undefined' ? `${window.location.origin}/api/auth/google/callback` : '...'}
                                    </code>
                                </div>
                                <div className="text-gray-400 text-[10px] leading-tight">
                                    <strong>Fix:</strong> This URL ^ must match exactly what is in your Google Cloud Console &gt; Authorized Redirect URIs.
                                    <br />
                                    <strong>Alternative:</strong> Set <code>GOOGLE_REDIRECT_URI</code> in Vercel to override this.
                                    <div className="mt-2 text-amber-600 bg-amber-50 p-1 rounded border border-amber-100">
                                        <strong>⚠️ IMPORTANT:</strong> Paste into "Authorized <u>Redirect URIs</u>", NOT "JavaScript Origins".
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Security Settings */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Lock size={18} className="text-gray-500" /> Security
                </h2>
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 flex items-center justify-between">
                    <div>
                        <h3 className="font-medium text-gray-900">Passkeys</h3>
                        <p className="text-sm text-gray-500">Sign in securely with Touch ID, Face ID, or device PIN.</p>
                    </div>
                    <button
                        onClick={handleAddPasskey}
                        className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium py-2 px-4 rounded-md shadow-sm text-sm transition"
                    >
                        Add Passkey
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function SettingsPage() {
    return (
        <Suspense fallback={<div>Loading settings...</div>}>
            <SettingsContent />
        </Suspense>
    );
}
