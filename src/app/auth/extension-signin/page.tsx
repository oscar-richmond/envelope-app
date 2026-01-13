'use client';

import { useEffect, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';

/**
 * Extension Sign-In Page
 * Forces auth to stay on production domain for consistent localStorage access
 */

const PRODUCTION_URL = 'https://envelope-app-sage.vercel.app';

export default function ExtensionSignInPage() {
    const { data: session, status } = useSession();
    const [authStatus, setAuthStatus] = useState<string>('Checking...');
    const [tokenInjected, setTokenInjected] = useState(false);

    useEffect(() => {
        // Check if we're on the wrong domain
        if (typeof window !== 'undefined' && !window.location.origin.includes('envelope-app-sage')) {
            // Redirect to production domain
            setAuthStatus('Redirecting to production domain...');
            window.location.href = `${PRODUCTION_URL}/auth/extension-signin`;
            return;
        }

        if (status === 'loading') {
            setAuthStatus('Checking session...');
            return;
        }

        if (status === 'unauthenticated') {
            setAuthStatus('Signing in...');
            // Sign in with redirect back to this page on production
            signIn('google', { callbackUrl: `${PRODUCTION_URL}/auth/extension-signin` });
            return;
        }

        if (status === 'authenticated' && session?.user) {
            setAuthStatus('Generating token...');
            injectToken();
        }
    }, [status, session]);

    const injectToken = async () => {
        if (tokenInjected || !session?.user) return;
        setTokenInjected(true);

        try {
            // Generate token
            const token = btoa(JSON.stringify({
                email: session.user.email,
                name: session.user.name,
                id: session.user.id,
                exp: Date.now() + (7 * 24 * 60 * 60 * 1000)
            }));

            // Store in localStorage
            localStorage.setItem('envelope-extension-token', token);
            localStorage.setItem('envelope-extension-email', session.user.email || '');
            localStorage.setItem('envelope-extension-ready', Date.now().toString());

            console.log('[Envelope Auth] Token stored in localStorage');
            setAuthStatus('Token ready! Waiting for extension...');

            // Poll to check if extension picked it up
            let attempts = 0;
            const checkInterval = setInterval(() => {
                attempts++;
                const stillThere = localStorage.getItem('envelope-extension-token');

                if (!stillThere) {
                    clearInterval(checkInterval);
                    setAuthStatus('✓ Connected! You can close this tab.');
                    console.log('[Envelope Auth] Token picked up by extension!');
                } else if (attempts >= 30) {
                    clearInterval(checkInterval);
                    setAuthStatus('Extension not responding. Reload extension in chrome://extensions');
                }
            }, 500);

        } catch (err: any) {
            setAuthStatus(`Error: ${err.message}`);
        }
    };

    return (
        <div style={{
            fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
            background: '#f8f9fb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            margin: 0
        }}>
            <div style={{
                background: 'white',
                padding: '48px',
                borderRadius: '20px',
                textAlign: 'center',
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                maxWidth: '400px'
            }}>
                <div style={{
                    width: '64px',
                    height: '64px',
                    background: authStatus.includes('✓') ? 'rgba(16, 185, 129, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 24px'
                }}>
                    {authStatus.includes('✓') ? (
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                            <path d="M20 6L9 17l-5-5" />
                        </svg>
                    ) : (
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 6v6l4 2" />
                        </svg>
                    )}
                </div>

                <h1 style={{ fontSize: '24px', margin: '0 0 8px', color: '#1a1a1a' }}>
                    {status === 'authenticated' ? 'Extension Connected!' : 'Connecting Extension...'}
                </h1>

                <p style={{ color: '#6b7280', margin: '0 0 24px' }}>
                    {status === 'authenticated'
                        ? 'You can now close this tab and use the Envelope extension.'
                        : 'Please complete sign-in to connect the extension.'}
                </p>

                {session?.user?.email && (
                    <div style={{
                        background: '#f3f4f6',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        fontSize: '14px',
                        color: '#374151',
                        marginBottom: '16px'
                    }}>
                        {session.user.email}
                    </div>
                )}

                <div style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: authStatus.includes('✓') ? '#d1fae5' : '#fef3c7',
                    color: authStatus.includes('✓') ? '#065f46' : '#92400e',
                    fontSize: '13px'
                }}>
                    {authStatus}
                </div>
            </div>
        </div>
    );
}
