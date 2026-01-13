'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

/**
 * Auth Extension Success Page
 * 
 * After successful login, this page:
 * 1. Confirms session is active
 * 2. Notifies extension via localStorage marker
 * 3. Shows clear success message
 */

export default function ExtensionSuccessPage() {
    const { data: session, status } = useSession();
    const [message, setMessage] = useState('Verifying session...');
    const [verified, setVerified] = useState(false);

    useEffect(() => {
        if (status === 'loading') {
            return;
        }

        if (status === 'unauthenticated') {
            setMessage('Session not found. Please try signing in again.');
            return;
        }

        if (status === 'authenticated' && session?.user) {
            // Session is valid - notify extension
            setMessage('✓ Signed in successfully!');
            setVerified(true);

            console.log('[ExtensionSuccess] Session confirmed:', session.user.email);

            // Store success marker
            try {
                localStorage.setItem('envelope-auth-complete', JSON.stringify({
                    success: true,
                    email: session.user.email,
                    timestamp: Date.now()
                }));
            } catch (e) {
                console.error('[ExtensionSuccess] localStorage error:', e);
            }
        }
    }, [status, session]);

    return (
        <div style={{
            fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
            background: '#f8f9fb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '20px'
        }}>
            <div style={{
                background: 'white',
                padding: '48px',
                borderRadius: '20px',
                textAlign: 'center',
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                maxWidth: '420px',
                width: '100%'
            }}>
                <div style={{
                    width: '64px',
                    height: '64px',
                    background: verified ? 'rgba(16, 185, 129, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 24px'
                }}>
                    {verified ? (
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                            <path d="M20 6L9 17l-5-5" />
                        </svg>
                    ) : (
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" style={{
                            animation: 'spin 1s linear infinite'
                        }}>
                            <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" />
                        </svg>
                    )}
                </div>

                <h1 style={{ fontSize: '24px', margin: '0 0 12px', color: '#1a1a1a', fontWeight: 600 }}>
                    {verified ? 'Extension Connected!' : 'Connecting...'}
                </h1>

                <p style={{
                    color: verified ? '#059669' : '#6b7280',
                    margin: '0 0 24px',
                    fontSize: '15px',
                    fontWeight: verified ? 500 : 400
                }}>
                    {message}
                </p>

                {session?.user?.email && (
                    <div style={{
                        background: '#f3f4f6',
                        padding: '10px 16px',
                        borderRadius: '10px',
                        fontSize: '14px',
                        color: '#374151',
                        marginBottom: '24px',
                        fontWeight: 500
                    }}>
                        {session.user.email}
                    </div>
                )}

                {verified && (
                    <>
                        <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '16px' }}>
                            You can now close this tab and return to the extension.
                        </p>
                        <p style={{ fontSize: '12px', color: '#9ca3af' }}>
                            The extension will automatically detect your session.
                        </p>
                    </>
                )}
            </div>

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
