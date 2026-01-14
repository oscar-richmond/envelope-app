'use client';

/**
 * Reusable skeleton loading component for company profile modules.
 * Provides consistent shimmer animation across all module cards.
 */

interface ModuleSkeletonProps {
    /** Number of content lines to show */
    lines?: number;
    /** Whether to show a header skeleton */
    showHeader?: boolean;
    /** Custom class name */
    className?: string;
}

export default function ModuleSkeleton({
    lines = 3,
    showHeader = true,
    className = ''
}: ModuleSkeletonProps) {
    return (
        <div className={`bg-white rounded-2xl border border-gray-200 overflow-hidden ${className}`}>
            {showHeader && (
                <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
                    <div className="w-5 h-5 rounded bg-gray-200 animate-pulse" />
                    <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                </div>
            )}
            <div className="p-5 space-y-3">
                {Array.from({ length: lines }).map((_, i) => (
                    <div
                        key={i}
                        className="h-4 bg-gray-100 rounded animate-pulse"
                        style={{
                            width: `${Math.max(40, 100 - (i * 15))}%`,
                            animationDelay: `${i * 100}ms`
                        }}
                    />
                ))}
            </div>
        </div>
    );
}

/** Skeleton for the website preview card */
export function ScreenshotSkeleton() {
    return (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded bg-gray-200 animate-pulse" />
                    <div className="h-4 w-28 bg-gray-200 rounded animate-pulse" />
                </div>
                <div className="h-6 w-16 bg-gray-100 rounded animate-pulse" />
            </div>
            <div className="aspect-video bg-gray-100 animate-pulse flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-gray-200 animate-pulse" />
            </div>
        </div>
    );
}

/** Skeleton for the priority score card */
export function ScoreCardSkeleton() {
    return (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-5 h-5 rounded bg-gray-200 animate-pulse" />
                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="text-center py-4">
                <div className="w-20 h-14 mx-auto bg-gray-100 rounded-lg animate-pulse mb-3" />
                <div className="w-16 h-6 mx-auto bg-gray-100 rounded-full animate-pulse" />
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                <div className="flex justify-between">
                    <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
                    <div className="h-3 w-12 bg-gray-100 rounded animate-pulse" />
                </div>
                <div className="flex justify-between">
                    <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
                    <div className="h-3 w-12 bg-gray-100 rounded animate-pulse" />
                </div>
            </div>
        </div>
    );
}

/** Skeleton for contact rows */
export function ContactsSkeleton({ count = 3 }: { count?: number }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
                <div className="w-5 h-5 rounded bg-gray-200 animate-pulse" />
                <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="p-5 space-y-3">
                {Array.from({ length: count }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100">
                        <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                            <div className="h-3 w-48 bg-gray-100 rounded animate-pulse" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
