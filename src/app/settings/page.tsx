'use client';

import { useState, useEffect, Suspense } from 'react';
import { Mail, CheckCircle, XCircle, LogOut } from 'lucide-react';
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
                                href="/api/auth/google"
                                className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium py-2 px-4 rounded-md shadow-sm flex items-center gap-2 transition"
                            >
                                <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
                                Connect Gmail Account
                            </a>
                            <p className="text-xs text-gray-400">
                                Requires Google OAuth Client ID & Secret configuration.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* General Settings */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold mb-4">LLM Configuration</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">OpenAI API Key</label>
                        <input type="password" placeholder="sk-..." className="w-full border rounded-md px-3 py-2 text-sm" />
                    </div>
                    <button className="bg-gray-900 text-white px-4 py-2 rounded-md text-sm">Save Changes</button>
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
