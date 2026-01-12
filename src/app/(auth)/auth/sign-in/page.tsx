import { SignInForm } from '@/components/auth/SignInForm';
import Link from 'next/link';
import { Search, TrendingUp, Mail, Users, BarChart3 } from 'lucide-react';

export default function SignInPage() {
    return (
        <>
            {/* Left: Sign-In Card */}
            <div className="w-full lg:w-[420px] flex flex-col justify-center animate-in fade-in slide-in-from-bottom-2 duration-500">
                {/* Premium Sign-In Card */}
                <div
                    className="relative"
                    style={{
                        background: 'white',
                        borderRadius: '24px',
                        border: '1px solid rgba(84, 130, 237, 0.15)',
                        boxShadow: '0 4px 24px -4px rgba(0, 0, 0, 0.08), 0 24px 48px -12px rgba(84, 130, 237, 0.12)',
                        padding: '40px 36px',
                        overflow: 'hidden'
                    }}
                >
                    {/* Inner Highlight */}
                    <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.8) 0%, transparent 50%)',
                            borderRadius: '24px'
                        }}
                    />

                    {/* Content */}
                    <div className="relative z-10">
                        {/* Brand Header */}
                        <div className="flex items-center gap-3 mb-8">
                            <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                                style={{ background: 'var(--nav-bg, #1a1a2e)' }}
                            >
                                E
                            </div>
                            <div>
                                <span className="font-semibold text-gray-900 text-lg" style={{ fontFamily: 'var(--font-display)' }}>
                                    Envelope
                                </span>
                                <span className="text-gray-400 text-sm ml-1.5">by Selfhood</span>
                            </div>
                        </div>

                        {/* Title */}
                        <div className="mb-8">
                            <h1
                                className="text-2xl font-bold text-gray-900 mb-2"
                                style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}
                            >
                                Sign in
                            </h1>
                            <p className="text-gray-500 text-sm leading-relaxed">
                                Lead discovery, outreach, and follow-ups in one workspace.
                            </p>
                        </div>

                        {/* Sign-In Form */}
                        <SignInForm />

                        {/* Security Hint */}
                        <p className="text-center text-xs text-gray-400 mt-6">
                            Secure sign-in. No passwords stored.
                        </p>

                        {/* Divider */}
                        <div className="flex items-center gap-4 my-6">
                            <div className="flex-1 h-px bg-gray-200" />
                            <span className="text-xs text-gray-400">or</span>
                            <div className="flex-1 h-px bg-gray-200" />
                        </div>

                        {/* Request Access */}
                        <Link
                            href="/auth/request-access"
                            className="w-full flex items-center justify-center py-3 px-4 rounded-xl text-sm font-medium transition-all border-2 border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-900 hover:shadow-sm"
                        >
                            Request access
                        </Link>
                    </div>
                </div>
            </div>

            {/* Right: Product Preview (Desktop Only) */}
            <div className="hidden lg:flex flex-1 items-center justify-center animate-in fade-in slide-in-from-right-4 duration-700 delay-200">
                <div className="relative w-full max-w-lg">
                    {/* Blur Background */}
                    <div
                        className="absolute inset-0 -z-10 rounded-3xl"
                        style={{
                            background: 'rgba(255, 255, 255, 0.4)',
                            backdropFilter: 'blur(20px)',
                            border: '1px solid rgba(255, 255, 255, 0.6)'
                        }}
                    />

                    {/* Preview Content */}
                    <div className="p-8 space-y-4">
                        <h3
                            className="text-lg font-semibold text-gray-800 mb-6"
                            style={{ fontFamily: 'var(--font-display)' }}
                        >
                            Your lead generation workspace
                        </h3>

                        {/* Preview Card 1: Prospect Search */}
                        <PreviewCard
                            icon={<Search size={18} />}
                            title="Prospect Search"
                            subtitle="Find companies that need your services"
                            color="blue"
                        />

                        {/* Preview Card 2: Lead Opportunity */}
                        <PreviewCard
                            icon={<TrendingUp size={18} />}
                            title="Lead Opportunity"
                            subtitle="AI-scored priority signals"
                            color="lilac"
                        />

                        {/* Preview Card 3: Inbox Queue */}
                        <PreviewCard
                            icon={<Mail size={18} />}
                            title="Inbox Queue"
                            subtitle="Reply tracking & follow-up automation"
                            color="mint"
                        />

                        {/* Stats Preview */}
                        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
                            <StatBadge icon={<Users size={14} />} value="2,847" label="Prospects" />
                            <StatBadge icon={<BarChart3 size={14} />} value="94%" label="Response rate" />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

// Preview Card Component
function PreviewCard({
    icon,
    title,
    subtitle,
    color
}: {
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    color: 'blue' | 'lilac' | 'mint';
}) {
    const colors = {
        blue: { bg: 'rgba(84, 130, 237, 0.08)', border: 'rgba(84, 130, 237, 0.15)', iconBg: 'rgba(84, 130, 237, 0.12)', text: '#5482ED' },
        lilac: { bg: 'rgba(184, 166, 255, 0.08)', border: 'rgba(184, 166, 255, 0.15)', iconBg: 'rgba(184, 166, 255, 0.12)', text: '#8B5CF6' },
        mint: { bg: 'rgba(166, 244, 179, 0.08)', border: 'rgba(166, 244, 179, 0.2)', iconBg: 'rgba(166, 244, 179, 0.15)', text: '#059669' }
    };
    const c = colors[color];

    return (
        <div
            className="flex items-center gap-4 p-4 rounded-xl transition-all hover:translate-x-1"
            style={{
                background: c.bg,
                border: `1px solid ${c.border}`
            }}
        >
            <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: c.iconBg, color: c.text }}
            >
                {icon}
            </div>
            <div>
                <div className="font-semibold text-gray-800 text-sm">{title}</div>
                <div className="text-xs text-gray-500">{subtitle}</div>
            </div>
        </div>
    );
}

// Stat Badge Component
function StatBadge({
    icon,
    value,
    label
}: {
    icon: React.ReactNode;
    value: string;
    label: string;
}) {
    return (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
            <span className="text-gray-400">{icon}</span>
            <span className="font-semibold text-gray-800 text-sm">{value}</span>
            <span className="text-xs text-gray-400">{label}</span>
        </div>
    );
}
