
'use client';

import { signIn } from 'next-auth/react';
import { startAuthentication } from '@simplewebauthn/browser';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

export function SignInForm() {
    const [loading, setLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleGoogle = async () => {
        setLoading('google');
        await signIn('google', { callbackUrl: '/' });
    };

    const handlePasskey = async () => {
        setLoading('passkey');
        setError(null);
        try {
            // 1. Get options
            const res = await fetch('/api/auth/passkey/auth-start', { method: 'POST' });
            if (!res.ok) throw new Error('Failed to init passkey');
            const options = await res.json();

            // 2. Start ceremony
            let asseResp;
            try {
                asseResp = await startAuthentication(options);
            } catch (error) {
                // Format cleaner error?
                throw error;
            }

            // 3. Submit to NextAuth
            // We pass the structure to our custom Credentials provider
            const result = await signIn('passkey', {
                redirect: true,
                callbackUrl: '/',
                id: asseResp.id,
                rawId: asseResp.rawId,
                response: JSON.stringify(asseResp.response),
                type: asseResp.type,
                clientExtensionResults: JSON.stringify(asseResp.clientExtensionResults),
                authenticatorAttachment: asseResp.authenticatorAttachment
            });

            if (result?.error) {
                throw new Error("Invalid passkey");
            }
        } catch (e: any) {
            console.error(e);
            setError(e.message || "Passkey failed");
            setLoading(null);
        }
    };

    return (
        <div className="w-full max-w-sm space-y-6">
            <div className="space-y-4">
                <button
                    onClick={handleGoogle}
                    disabled={!!loading}
                    className="w-full flex items-center justify-center gap-2 bg-white text-gray-900 border border-gray-300 hover:bg-gray-50 font-medium py-2.5 px-4 rounded-lg transition-colors"
                >
                    {loading === 'google' ? <Loader2 className="animate-spin w-5 h-5" /> : (
                        // Simple G logo or icon
                        <span className="font-bold">G</span>
                    )}
                    Continue with Google
                </button>

                <button
                    onClick={handlePasskey}
                    disabled={!!loading}
                    className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white hover:bg-gray-800 font-medium py-2.5 px-4 rounded-lg transition-colors"
                >
                    {loading === 'passkey' ? <Loader2 className="animate-spin w-5 h-5" /> : (
                        <span className="text-xl leading-none">🔑</span>
                    )}
                    Sign in with Passkey
                </button>
            </div>

            {error && (
                <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">
                    {error}
                </div>
            )}

            <div className="text-center text-sm text-gray-500">
                Don&apos;t have access?{' '}
                <Link href="/auth/request-access" className="text-blue-600 hover:underline">
                    Request access
                </Link>
            </div>
        </div>
    );
}
