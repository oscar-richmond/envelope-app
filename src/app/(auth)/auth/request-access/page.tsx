'use client';

import { requestAccess } from './actions';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';


function RequestForm() {
    const searchParams = useSearchParams();
    const success = searchParams.get('success');

    // We can use useActionState for better progressive enhancement, 
    // but standard form with error handling wrapper is fine for now.
    // Let's use simple form submission.

    if (success) {
        return (
            <div className="text-center space-y-4">
                <div className="bg-green-50 text-green-700 p-4 rounded-lg">
                    <h3 className="font-semibold">Request Received</h3>
                    <p className="text-sm">You have been added to the waitlist. We will notify you when your account is approved.</p>
                </div>
                <Link href="/auth/sign-in" className="text-blue-600 hover:underline block">
                    Back to Sign In
                </Link>
            </div>
        );
    }

    return (
        <form action={requestAccess} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input name="name" required placeholder="Jane Doe" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-hidden" />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input name="email" type="email" required placeholder="jane@company.com" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-hidden" />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company (Optional)</label>
                <input name="company" placeholder="Acme Inc." className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-hidden" />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Why do you need access? (Optional)</label>
                <textarea name="note" rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-hidden" />
            </div>

            <SubmitButton />

            <div className="text-center text-sm text-gray-500 mt-4">
                <Link href="/auth/sign-in" className="hover:underline">
                    Cancel
                </Link>
            </div>
        </form>
    );
}

import { useFormStatus } from 'react-dom';

function SubmitButton() {
    const { pending } = useFormStatus();

    return (
        <button
            type="submit"
            disabled={pending}
            className="w-full bg-gray-900 text-white font-medium py-2.5 rounded-lg hover:bg-gray-800 transition-colors flex justify-center items-center"
        >
            {pending ? <Loader2 className="animate-spin w-5 h-5" /> : "Request Access"}
        </button>
    );
}

export default function RequestAccessPage() {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <div className="text-center mb-8">
                <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Request Access</h1>
                <p className="text-sm text-gray-500 mt-2">
                    Join the waitlist to get started.
                </p>
            </div>

            <Suspense fallback={<div className="p-4 text-center">Loading...</div>}>
                <RequestForm />
            </Suspense>
        </div>
    );
}
