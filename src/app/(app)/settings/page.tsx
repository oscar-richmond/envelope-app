'use client';

import { useState, useEffect, Suspense } from 'react';
import { Mail, CheckCircle, XCircle, LogOut, Lock, Shield, AlertCircle, Trash2, Wrench } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

/**
 * Sender Health Indicator
 * Shows authentication status and volume guidance with calm language
 */
function SenderHealthIndicator() {
    const [health, setHealth] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/settings/sender-health')
            .then(res => res.json())
            .then(data => {
                if (data.health) {
                    setHealth(data.health);
                }
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="mt-4 animate-pulse h-20 bg-gray-50 rounded-lg"></div>
        );
    }

    if (!health) return null;

    const statusColors = {
        'VERIFIED_WARM': 'bg-green-50 border-green-100 text-green-700',
        'VERIFIED_WARMING': 'bg-amber-50 border-amber-100 text-amber-700',
        'UNVERIFIED': 'bg-gray-50 border-gray-200 text-gray-500'
    };

    return (
        <div className="mt-4 space-y-3">
            {/* Status Badge */}
            <div className={`rounded-lg border p-4 ${statusColors[health.status as keyof typeof statusColors] || statusColors.UNVERIFIED}`}>
                <div className="flex items-center gap-2 mb-2">
                    <Shield size={16} />
                    <span className="font-medium">{health.statusLabel}</span>
                </div>
                <p className="text-sm opacity-80">{health.statusDescription}</p>
            </div>

            {/* Authentication Checks */}
            <div className="flex gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                    {health.spf === 'pass' ? (
                        <CheckCircle size={12} className="text-green-600" />
                    ) : (
                        <XCircle size={12} className="text-gray-400" />
                    )}
                    <span className="text-gray-600">SPF</span>
                </div>
                <div className="flex items-center gap-1.5">
                    {health.dkim === 'pass' ? (
                        <CheckCircle size={12} className="text-green-600" />
                    ) : (
                        <XCircle size={12} className="text-gray-400" />
                    )}
                    <span className="text-gray-600">DKIM</span>
                </div>
                <div className="flex items-center gap-1.5">
                    {health.dmarc !== 'none' && health.dmarc !== 'unknown' ? (
                        <CheckCircle size={12} className="text-green-600" />
                    ) : (
                        <XCircle size={12} className="text-gray-400" />
                    )}
                    <span className="text-gray-600">DMARC</span>
                </div>
            </div>

            {/* Volume Guidance */}
            <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                    <span>Today: {health.todaySent || 0} sent</span>
                    <span>Recommended: {health.recommendedDailyVolume.min}-{health.recommendedDailyVolume.max}/day</span>
                </div>
                {health.volumeWarning && (
                    <div className="mt-2 flex items-center gap-1.5 text-amber-600">
                        <AlertCircle size={12} />
                        <span>{health.volumeWarning}</span>
                    </div>
                )}
            </div>
        </div>
    );
}

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

                            {/* Sender Health Indicator */}
                            <SenderHealthIndicator />
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

            {/* Developer Tools - only in dev mode */}
            <DeveloperTools />
        </div>
    );
}

/**
 * Developer Tools Section
 * Only visible in development mode or with ENABLE_DEV_TOOLS=1
 */
function DeveloperTools() {
    const [available, setAvailable] = useState(false);
    const [showResetModal, setShowResetModal] = useState(false);
    const [resetConfirmText, setResetConfirmText] = useState('');
    const [resetLoading, setResetLoading] = useState(false);
    const [resetResult, setResetResult] = useState<any>(null);

    useEffect(() => {
        // Check if dev tools are available
        fetch('/api/admin/reset-enrichment')
            .then(res => res.json())
            .then(data => setAvailable(data.available))
            .catch(() => setAvailable(false));
    }, []);

    const handleReset = async () => {
        if (resetConfirmText !== 'RESET') return;

        setResetLoading(true);
        try {
            const res = await fetch('/api/admin/reset-enrichment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scope: 'all' })
            });
            const data = await res.json();
            setResetResult(data);

            if (data.success) {
                // Show success and suggest refresh
                alert(`✅ Enrichment data cleared!\n\nProspects: ${data.prospectsAffected}\nLeads: ${data.leadsAffected}\nContacts: ${data.contactsCleared}\n\nRefresh the page to see clean state.`);
                setShowResetModal(false);
                setResetConfirmText('');
            }
        } catch (error) {
            alert('Failed to reset enrichment data');
        } finally {
            setResetLoading(false);
        }
    };

    if (!available) return null;

    return (
        <>
            <div className="bg-amber-50 rounded-xl shadow-sm border border-amber-200 p-6 mt-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-amber-800">
                    <Wrench size={18} /> Developer Tools
                </h2>
                <p className="text-sm text-amber-700 mb-4">
                    These tools are only available in development mode or with ENABLE_DEV_TOOLS=1.
                </p>

                <div className="border border-amber-200 rounded-lg p-4 bg-white flex items-center justify-between">
                    <div>
                        <h3 className="font-medium text-gray-900 flex items-center gap-2">
                            <Trash2 size={16} className="text-red-500" />
                            Reset Enrichment Data
                        </h3>
                        <p className="text-sm text-gray-500">
                            Clears derived scan/API data. Does not delete companies, leads, drafts, or manual contacts.
                        </p>
                    </div>
                    <button
                        onClick={() => setShowResetModal(true)}
                        className="bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 font-medium py-2 px-4 rounded-md text-sm transition"
                    >
                        Reset Data
                    </button>
                </div>
            </div>

            {/* Reset Confirmation Modal */}
            {showResetModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                            <AlertCircle className="text-red-500" size={20} />
                            Reset Enrichment Data
                        </h3>

                        <p className="text-sm text-gray-600 mb-4">
                            This will clear all derived scan data:
                        </p>

                        <ul className="text-sm text-gray-600 mb-4 list-disc list-inside space-y-1">
                            <li>Website Health scores & analysis</li>
                            <li>Financial Health scores & analysis</li>
                            <li>Auto-discovered contacts</li>
                            <li>Priority scores & breakdowns</li>
                        </ul>

                        <p className="text-sm text-gray-600 mb-4">
                            <strong>Not affected:</strong> Companies, leads, drafts, manual contacts, conversations.
                        </p>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Type <code className="bg-gray-100 px-1 rounded">RESET</code> to confirm:
                            </label>
                            <input
                                type="text"
                                value={resetConfirmText}
                                onChange={(e) => setResetConfirmText(e.target.value)}
                                placeholder="RESET"
                                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowResetModal(false);
                                    setResetConfirmText('');
                                }}
                                className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-md font-medium text-sm hover:bg-gray-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleReset}
                                disabled={resetConfirmText !== 'RESET' || resetLoading}
                                className={`flex-1 py-2 px-4 rounded-md font-medium text-sm transition ${resetConfirmText === 'RESET' && !resetLoading
                                    ? 'bg-red-600 text-white hover:bg-red-700'
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    }`}
                            >
                                {resetLoading ? 'Resetting...' : 'Confirm Reset'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default function SettingsPage() {
    return (
        <Suspense fallback={<div>Loading settings...</div>}>
            <SettingsContent />
        </Suspense>
    );
}
