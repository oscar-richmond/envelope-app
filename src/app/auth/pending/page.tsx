
'use client';

import { signOut } from 'next-auth/react';
import { useSession } from 'next-auth/react';
import { Loader2 } from 'lucide-react';

export default function PendingPage() {
    const { data: session } = useSession();

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 w-full max-w-sm text-center">
                <div className="mb-6 flex justify-center">
                    <div className="h-12 w-12 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center text-xl">
                        ⏳
                    </div>
                </div>

                <h2 className="text-lg font-semibold text-gray-800 mb-2">Access Pending</h2>

                <p className="text-gray-500 text-sm mb-6">
                    Your account (<span className="font-medium text-gray-700">{session?.user?.email}</span>) is currently on the waitlist.
                    <br /><br />
                    We will notify you via email once an administrator has approved your request.
                </p>

                <div className="bg-gray-50 rounded-lg p-4 mb-6 text-xs text-gray-500">
                    Status: <span className="font-mono font-medium text-gray-700 uppercase">{
                        // @ts-ignore
                        session?.user?.accessStatus || 'WAITLISTED'
                    }</span>
                </div>

                <button
                    onClick={() => signOut({ callbackUrl: '/auth/sign-in' })}
                    className="w-full border border-gray-300 text-gray-700 font-medium py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                    Sign Out
                </button>
            </div>
        </div>
    );
}
