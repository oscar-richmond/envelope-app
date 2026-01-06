
'use client';

import { signIn, useSession } from 'next-auth/react';
import { startAuthentication } from '@simplewebauthn/browser';
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

export function SignInForm() {
    const [mounted, setMounted] = useState(false);
    const [loading, setLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

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
                throw error;
            }

            // 3. Submit to NextAuth
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

    if (!mounted) {
        return (
            <div className="w-full space-y-4 animate-pulse">
                <div className="h-12 bg-gray-50 border border-gray-100 rounded-xl w-full"></div>
                <div className="h-12 bg-gray-50 border border-gray-100 rounded-xl w-full"></div>
            </div>
        );
    }

    return (
        <div className="w-full space-y-4">
            <button
                onClick={handleGoogle}
                disabled={!!loading}
                className="w-full relative flex items-center justify-center gap-3 bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 font-medium py-3 px-4 rounded-xl transition-all shadow-sm active:scale-[0.98]"
            >
                {loading === 'google' ? <Loader2 className="animate-spin w-5 h-5 text-gray-400" /> : (
                    <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="" />
                )}
                Continue with Google
            </button>

            <button
                onClick={handlePasskey}
                disabled={!!loading}
                className="w-full relative flex items-center justify-center gap-3 bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 font-medium py-3 px-4 rounded-xl transition-all shadow-sm active:scale-[0.98]"
            >
                {loading === 'passkey' ? <Loader2 className="animate-spin w-5 h-5 text-gray-400" /> : (
                    <span className="text-lg">🔑</span>
                )}
                Continue with Passkey
            </button>

            {error && (
                <div className="text-red-500 text-xs text-center p-2">
                    {error}
                </div>
            )}
        </div>
    );
}
