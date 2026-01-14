'use client';

import { useState, useEffect, useCallback } from 'react';
import { Eye, EyeOff, MousePointer, Info } from 'lucide-react';

/**
 * CTA Debug Mode - Developer tool for highlighting and inspecting CTAs
 * 
 * Activated via:
 * 1. localStorage.setItem('ctaDebugMode', 'true')
 * 2. Keyboard shortcut: Ctrl+Shift+D (Mac: Cmd+Shift+D)
 * 
 * Features:
 * - Highlights all clickable elements
 * - Shows tooltip with CTA metadata on hover
 * - Logs all clicks to console
 */

interface CTAInfo {
    element: HTMLElement;
    type: string;
    label: string;
    handler: string | null;
    destination: string | null;
    rect: DOMRect;
}

export function CTADebugOverlay() {
    const [isActive, setIsActive] = useState(false);
    const [hoveredCTA, setHoveredCTA] = useState<CTAInfo | null>(null);
    const [ctaCount, setCTACount] = useState(0);

    // Toggle debug mode
    const toggleDebugMode = useCallback(() => {
        const newState = !isActive;
        setIsActive(newState);
        localStorage.setItem('ctaDebugMode', String(newState));
        if (newState) {
            document.body.classList.add('cta-debug-mode');
            console.log('[CTA Debug Mode] Activated');
        } else {
            document.body.classList.remove('cta-debug-mode');
            console.log('[CTA Debug Mode] Deactivated');
        }
    }, [isActive]);

    // Initialize from localStorage and keyboard shortcut
    useEffect(() => {
        const stored = localStorage.getItem('ctaDebugMode');
        if (stored === 'true') {
            setIsActive(true);
            document.body.classList.add('cta-debug-mode');
        }

        const handleKeydown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
                e.preventDefault();
                toggleDebugMode();
            }
        };

        window.addEventListener('keydown', handleKeydown);
        return () => window.removeEventListener('keydown', handleKeydown);
    }, [toggleDebugMode]);

    // Count CTAs on page
    useEffect(() => {
        if (!isActive) return;

        const countCTAs = () => {
            const selectors = [
                'button',
                '[role="button"]',
                'a[href]',
                '[onClick]',
                '.cursor-pointer',
                '.btn',
                '.icon-btn'
            ];
            const elements = document.querySelectorAll(selectors.join(','));
            setCTACount(elements.length);
        };

        countCTAs();
        const observer = new MutationObserver(countCTAs);
        observer.observe(document.body, { childList: true, subtree: true });
        return () => observer.disconnect();
    }, [isActive]);

    // Hover tracking
    useEffect(() => {
        if (!isActive) return;

        const handleMouseMove = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const cta = findClickableAncestor(target);

            if (cta) {
                const info = extractCTAInfo(cta);
                setHoveredCTA(info);
            } else {
                setHoveredCTA(null);
            }
        };

        const handleClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const cta = findClickableAncestor(target);

            if (cta) {
                const info = extractCTAInfo(cta);
                console.log('[CTA Debug] Click:', {
                    type: info.type,
                    label: info.label,
                    handler: info.handler,
                    destination: info.destination,
                    element: cta
                });
            }
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('click', handleClick, true);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('click', handleClick, true);
        };
    }, [isActive]);

    function findClickableAncestor(el: HTMLElement | null): HTMLElement | null {
        while (el) {
            if (
                el.tagName === 'BUTTON' ||
                el.tagName === 'A' ||
                el.getAttribute('role') === 'button' ||
                el.hasAttribute('onclick') ||
                el.classList.contains('cursor-pointer') ||
                el.classList.contains('btn') ||
                el.classList.contains('icon-btn')
            ) {
                return el;
            }
            el = el.parentElement;
        }
        return null;
    }

    function extractCTAInfo(el: HTMLElement): CTAInfo {
        const type = el.tagName === 'BUTTON' ? 'button' :
            el.tagName === 'A' ? 'link' :
                el.classList.contains('icon-btn') ? 'icon-button' :
                    'interaction';

        const label = el.textContent?.trim()?.slice(0, 50) ||
            el.getAttribute('aria-label') ||
            el.getAttribute('title') ||
            el.className.split(' ').find(c => c.includes('btn-')) ||
            'Unknown';

        const handler = el.getAttribute('onclick') ||
            (el as any).__reactFiber$?.__reactProps$?.onClick?.name ||
            null;

        const destination = el.getAttribute('href') || null;

        return {
            element: el,
            type,
            label,
            handler,
            destination,
            rect: el.getBoundingClientRect()
        };
    }

    if (!isActive) {
        return (
            <button
                onClick={toggleDebugMode}
                className="fixed bottom-4 left-4 z-[9999] p-2 rounded-full shadow-lg opacity-30 hover:opacity-100 transition-opacity"
                style={{ background: '#6366f1', color: 'white' }}
                title="Enable CTA Debug Mode (Cmd+Shift+D)"
            >
                <Eye size={16} />
            </button>
        );
    }

    return (
        <>
            {/* Debug Mode Indicator */}
            <div
                className="fixed top-4 right-4 z-[9999] flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg text-sm font-medium"
                style={{
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    color: 'white'
                }}
            >
                <MousePointer size={14} />
                <span>CTA Debug Mode</span>
                <span className="px-1.5 py-0.5 rounded text-xs" style={{ background: 'rgba(255,255,255,0.2)' }}>
                    {ctaCount} CTAs
                </span>
                <button onClick={toggleDebugMode} className="ml-2 hover:opacity-80">
                    <EyeOff size={14} />
                </button>
            </div>

            {/* Hover Tooltip */}
            {hoveredCTA && (
                <div
                    className="fixed z-[9999] px-3 py-2 rounded-lg shadow-lg text-xs"
                    style={{
                        left: Math.min(hoveredCTA.rect.left, window.innerWidth - 250),
                        top: Math.max(hoveredCTA.rect.top - 80, 10),
                        background: 'rgba(15, 23, 42, 0.95)',
                        color: 'white',
                        maxWidth: '240px',
                        border: '1px solid rgba(99, 102, 241, 0.5)'
                    }}
                >
                    <div className="flex items-center gap-2 mb-1 font-semibold" style={{ color: '#a5b4fc' }}>
                        <Info size={12} />
                        {hoveredCTA.type.toUpperCase()}
                    </div>
                    <div className="space-y-1">
                        <div><span className="opacity-60">Label:</span> {hoveredCTA.label}</div>
                        {hoveredCTA.destination && (
                            <div><span className="opacity-60">Href:</span> {hoveredCTA.destination}</div>
                        )}
                        {hoveredCTA.handler && (
                            <div><span className="opacity-60">Handler:</span> {hoveredCTA.handler}</div>
                        )}
                    </div>
                </div>
            )}

            {/* Global CSS for highlighting */}
            <style jsx global>{`
                .cta-debug-mode button,
                .cta-debug-mode a[href],
                .cta-debug-mode [role="button"],
                .cta-debug-mode .cursor-pointer,
                .cta-debug-mode .btn,
                .cta-debug-mode .icon-btn {
                    outline: 2px dashed rgba(99, 102, 241, 0.6) !important;
                    outline-offset: 2px !important;
                }

                .cta-debug-mode button:hover,
                .cta-debug-mode a[href]:hover,
                .cta-debug-mode [role="button"]:hover,
                .cta-debug-mode .cursor-pointer:hover,
                .cta-debug-mode .btn:hover,
                .cta-debug-mode .icon-btn:hover {
                    outline-color: rgb(99, 102, 241) !important;
                    outline-style: solid !important;
                }
            `}</style>
        </>
    );
}

export default CTADebugOverlay;
