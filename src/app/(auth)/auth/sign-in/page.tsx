import { SignInForm } from '@/components/auth/SignInForm';
import Link from 'next/link';

export default function SignInPage() {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <div className="text-center mb-8">
                <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Sign in</h1>
                <p className="text-sm text-gray-500 mt-2">
                    Manage your lead generation pipeline
                </p>
            </div>

            <SignInForm />

            <div className="mt-6 text-center">
                <Link
                    href="/auth/request-access"
                    className="text-sm text-gray-400 hover:text-gray-900 transition-colors"
                >
                    Request access
                </Link>
            </div>
        </div>
    );
}
