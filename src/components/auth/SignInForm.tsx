
'use client';

import { signIn, useSession } from 'next-auth/react';
import { startAuthentication } from '@simplewebauthn/browser';
import { useState, useEffect } from 'react';
import { Loader2, Key } from 'lucide-react';

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
                <div className="h-[52px] bg-gray-50 border border-gray-100 rounded-xl w-full"></div>
                <div className="h-[52px] bg-gray-50 border border-gray-100 rounded-xl w-full"></div>
            </div>
        );
    }

    return (
        <div className="w-full space-y-3">
            {/* Google Button - Premium styling */}
            <button
                onClick={handleGoogle}
                disabled={!!loading}
                className="w-full relative flex items-center justify-center gap-3 bg-white text-gray-700 font-semibold py-3.5 px-5 rounded-xl transition-all border border-gray-200 hover:border-gray-300 hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                    height: '52px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}
            >
                {loading === 'google' ? (
                    <Loader2 className="animate-spin w-5 h-5 text-gray-400" />
                ) : (
                    <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="" />
                )}
                Continue with Google
            </button>

            {/* Passkey Button - Blue accent styling */}
            <button
                onClick={handlePasskey}
                disabled={!!loading}
                className="w-full relative flex items-center justify-center gap-3 font-semibold py-3.5 px-5 rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                    height: '52px',
                    background: 'rgba(84, 130, 237, 0.08)',
                    color: '#5482ED',
                    border: '1px solid rgba(84, 130, 237, 0.25)',
                    boxShadow: '0 1px 3px rgba(84, 130, 237, 0.08)'
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(84, 130, 237, 0.12)';
                    e.currentTarget.style.borderColor = 'rgba(84, 130, 237, 0.35)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(84, 130, 237, 0.18)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(84, 130, 237, 0.08)';
                    e.currentTarget.style.borderColor = 'rgba(84, 130, 237, 0.25)';
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(84, 130, 237, 0.08)';
                }}
            >
                {loading === 'passkey' ? (
                    <Loader2 className="animate-spin w-5 h-5" />
                ) : (
                    <Key size={18} />
                )}
                Continue with Passkey
            </button>

            {error && (
                <div
                    className="text-xs text-center p-3 rounded-lg"
                    style={{
                        background: 'rgba(239, 68, 68, 0.08)',
                        color: '#DC2626',
                        border: '1px solid rgba(239, 68, 68, 0.15)'
                    }}
                >
                    {error}
                </div>
            )}
        </div>
    );
}
