'use client';

import { useEffect, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';

/**
 * Extension Auth Page
 * 
 * Handles sign-in and communicates success back to extension
 * Uses postMessage for cross-origin communication
 */

export default function ExtensionAuthPage() {
    const { data: session, status } = useSession();
    const [authStatus, setAuthStatus] = useState<string>('Initializing...');
    const [authComplete, setAuthComplete] = useState(false);

    useEffect(() => {
        if (status === 'loading') {
            setAuthStatus('Checking session...');
            return;
        }

        if (status === 'unauthenticated') {
            setAuthStatus('Redirecting to sign in...');
            // Sign in and return to this page
            signIn('google', {
                callbackUrl: window.location.href
            });
            return;
        }

        if (status === 'authenticated' && session?.user && !authComplete) {
            setAuthComplete(true);
            handleAuthSuccess();
        }
    }, [status, session, authComplete]);

    const handleAuthSuccess = () => {
        setAuthStatus('✓ Signed in! Notifying extension...');

        console.log('[ExtensionAuth] Auth successful:', session?.user?.email);

        // Store success marker in localStorage for extension to detect
        try {
            localStorage.setItem('envelope-auth-success', JSON.stringify({
                success: true,
                email: session?.user?.email,
                timestamp: Date.now()
            }));
            console.log('[ExtensionAuth] Success marker stored');
        } catch (e) {
            console.error('[ExtensionAuth] localStorage error:', e);
        }

        // Also broadcast via postMessage (for any listening windows)
        try {
            window.postMessage({
                type: 'ENVELOPE_AUTH_SUCCESS',
                email: session?.user?.email,
                timestamp: Date.now()
            }, '*');
            console.log('[ExtensionAuth] postMessage sent');
        } catch (e) {
            console.error('[ExtensionAuth] postMessage error:', e);
        }

        // After 2 seconds, show manual close message
        setTimeout(() => {
            setAuthStatus('✓ Connected! You can close this tab and use the extension.');
        }, 1500);
    };

    const getStatusColor = () => {
        if (authStatus.includes('✓')) return { bg: '#d1fae5', color: '#065f46' };
        if (authStatus.includes('Error')) return { bg: '#fee2e2', color: '#991b1b' };
        return { bg: '#fef3c7', color: '#92400e' };
    };

    const colors = getStatusColor();

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
                maxWidth: '420px',
                width: '90%'
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
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                            <path d="M20 6L9 17l-5-5" />
                        </svg>
                    ) : (
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 6v6l4 2" />
                        </svg>
                    )}
                </div>

                <h1 style={{ fontSize: '24px', margin: '0 0 12px', color: '#1a1a1a', fontWeight: 600 }}>
                    {authStatus.includes('✓') ? 'Extension Connected!' : 'Connecting Extension'}
                </h1>

                <p style={{ color: '#6b7280', margin: '0 0 24px', fontSize: '15px', lineHeight: 1.5 }}>
                    {authStatus.includes('✓')
                        ? 'Your Envelope extension is now signed in.'
                        : 'Please wait while we connect your extension...'}
                </p>

                {session?.user?.email && (
                    <div style={{
                        background: '#f3f4f6',
                        padding: '10px 16px',
                        borderRadius: '10px',
                        fontSize: '14px',
                        color: '#374151',
                        marginBottom: '20px',
                        fontWeight: 500
                    }}>
                        {session.user.email}
                    </div>
                )}

                <div style={{
                    padding: '12px 16px',
                    borderRadius: '10px',
                    background: colors.bg,
                    color: colors.color,
                    fontSize: '14px',
                    fontWeight: 500
                }}>
                    {authStatus}
                </div>

                {authStatus.includes('✓') && (
                    <p style={{
                        marginTop: '24px',
                        fontSize: '13px',
                        color: '#9ca3af'
                    }}>
                        You can now close this tab.
                    </p>
                )}
            </div>
        </div>
    );
}
