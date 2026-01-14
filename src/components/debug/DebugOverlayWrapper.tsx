'use client';

import dynamic from 'next/dynamic';

const CTADebugOverlay = dynamic(
    () => import('./CTADebugOverlay'),
    { ssr: false }
);

export function DebugOverlayWrapper() {
    // Only render in development
    if (process.env.NODE_ENV !== 'development') {
        return null;
    }

    return <CTADebugOverlay />;
}
