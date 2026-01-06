
'use client';

import { signOut } from 'next-auth/react';
import { useSession } from 'next-auth/react';
import { Loader2 } from 'lucide-react';

export default function PendingPage() {
    const { data: session } = useSession();

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
            <div className="mb-6 flex justify-center">
                <div className="h-12 w-12 bg-yellow-50 text-yellow-600 rounded-full flex items-center justify-center text-xl">
                    ⏳
                </div>
            </div>

            <h2 className="text-xl font-semibold text-gray-900 mb-2">Awaiting Approval</h2>

            <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                Your account (<span className="font-medium text-gray-900">{session?.user?.email}</span>) is currently on the waitlist.
                We'll notify you once an administrator has approved your request.
            </p>

            <button
                onClick={() => signOut({ callbackUrl: '/auth/sign-in' })}
                className="w-full border border-gray-200 text-gray-600 font-medium py-2.5 rounded-xl hover:bg-gray-50 hover:text-gray-900 transition-colors text-sm"
            >
                Sign Out
            </button>
        </div>
    );
}
