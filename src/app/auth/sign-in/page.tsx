
import { SignInForm } from "@/components/auth/SignInForm";

export default function SignInPage() {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">LeadGen Pro</h1>
                <p className="text-gray-500 text-sm mt-1 text-center">Authentication</p>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 w-full max-w-sm">
                <h2 className="text-lg font-semibold text-gray-800 mb-6 tracking-tight">Sign in to your account</h2>
                <SignInForm />
            </div>
        </div>
    );
}
