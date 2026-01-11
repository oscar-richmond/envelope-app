'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    List, Settings, PlusCircle, Send, Users,
    LayoutDashboard, ChevronLeft, ChevronRight,
    Mail, LogOut, User as UserIcon, RefreshCw, MessageCircle
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useSession, signOut } from "next-auth/react";

// ─────────────────────────────────────────
// Navigation Configuration
// ─────────────────────────────────────────

interface NavItemConfig {
    label: string;
    icon: React.ComponentType<{ size?: number }>;
    route: string;
    group: string;
}

const navItems: NavItemConfig[] = [
    // Main
    { label: 'Dashboard', icon: LayoutDashboard, route: '/dashboard', group: 'Main' },
    { label: 'Lead Board', icon: List, route: '/leads', group: 'Main' },
    { label: 'Prospects', icon: Users, route: '/prospects', group: 'Main' },
    // Outreach
    { label: 'Inbox', icon: Mail, route: '/outreach/sent', group: 'Outreach' },
    { label: 'Conversations', icon: MessageCircle, route: '/conversations', group: 'Outreach' },
    { label: 'Follow-Ups', icon: RefreshCw, route: '/outreach/follow-ups', group: 'Outreach' },
    { label: 'Queue', icon: Send, route: '/outreach', group: 'Outreach' },
    // System
    { label: 'Import', icon: PlusCircle, route: '/import', group: 'System' },
    { label: 'Settings', icon: Settings, route: '/settings', group: 'System' },
];

// Group nav items by their group
const groupedNavItems = navItems.reduce((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
}, {} as Record<string, NavItemConfig[]>);

// ─────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────

const Sidebar = () => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [mounted, setMounted] = useState(false);
    const { data: session } = useSession();
    const pathname = usePathname();

    useEffect(() => {
        setMounted(true);
        const stored = localStorage.getItem('sidebar-collapsed');
        if (stored) setIsCollapsed(stored === 'true');
    }, []);

    const toggle = () => {
        const newState = !isCollapsed;
        setIsCollapsed(newState);
        localStorage.setItem('sidebar-collapsed', String(newState));
    };

    const handleSignOut = () => {
        signOut({ callbackUrl: '/auth/sign-in?signedOut=1' });
    };

    const isActive = (route: string) => {
        if (route === '/outreach') {
            return pathname === '/outreach' && !pathname.includes('/sent') && !pathname.includes('/follow-ups');
        }
        return pathname === route || pathname.startsWith(route + '/');
    };

    if (!mounted) return (
        <aside
            style={{
                position: 'fixed',
                top: '20px',
                left: '20px',
                bottom: '20px',
                width: '256px',
                zIndex: 50
            }}
        >
            <div
                className="h-full rounded-[28px]"
                style={{ background: 'var(--nav-bg)' }}
            />
        </aside>
    );

    const navWidth = isCollapsed ? 72 : 280;

    return (
        <>
            {/* CSS variable for layout offset */}
            <style>{`:root { --sidebar-width: ${navWidth + 40}px; }`}</style>

            {/* Sidebar CSS for gradient bloom - uses tokens from globals.css */}
            <style>{`
                .sidebar-container {
                    position: relative;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    background: var(--nav-bg);
                    border-radius: 28px;
                    border: 1px solid var(--nav-border);
                    box-shadow: var(--nav-shadow);
                    overflow: hidden;
                }
                
                /* Radial gradient bloom overlay - matches Figma purple/blue glow */
                .sidebar-container::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    border-radius: 28px;
                    background: 
                        var(--nav-bloom-purple),
                        var(--nav-bloom-blue);
                    pointer-events: none;
                    z-index: 0;
                }
                
                .sidebar-content {
                    position: relative;
                    z-index: 1;
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                }
            `}</style>

            <aside
                style={{
                    position: 'fixed',
                    top: '20px',
                    left: '20px',
                    bottom: '20px',
                    width: `${navWidth}px`,
                    zIndex: 50,
                    transition: 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)'
                }}
            >
                <div className="sidebar-container group">
                    <div className="sidebar-content">
                        {/* Logo Section - New brand logo */}
                        <Link
                            href="/dashboard"
                            className={`
                                flex items-center shrink-0 transition-all duration-300 cursor-pointer
                                ${isCollapsed ? 'justify-center px-3 py-4' : 'px-5 py-5'}
                                hover:opacity-90
                            `}
                            style={{ borderBottom: '1px solid var(--nav-divider)' }}
                        >
                            {isCollapsed ? (
                                <img
                                    src="/branding/envelope-icon.png"
                                    alt="Envelope"
                                    style={{
                                        height: '36px',
                                        width: '36px',
                                        objectFit: 'contain',
                                        borderRadius: '10px'
                                    }}
                                />
                            ) : (
                                <img
                                    src="/branding/envelope-logo.png"
                                    alt="Envelope"
                                    style={{
                                        height: '32px',
                                        width: 'auto',
                                        objectFit: 'contain'
                                    }}
                                />
                            )}
                        </Link>

                        {/* Collapse Toggle - Hover-only, high opacity background */}
                        <button
                            onClick={toggle}
                            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                            className="
                            absolute -right-4 top-12
                            w-7 h-7 rounded-full
                            flex items-center justify-center
                            transition-all duration-200
                            cursor-pointer z-20
                            opacity-0 group-hover:opacity-100
                            pointer-events-none group-hover:pointer-events-auto
                            focus:outline-none focus:ring-2 focus:ring-white/30
                        "
                            style={{
                                background: 'rgba(28, 33, 47, 0.95)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                color: 'rgba(255, 255, 255, 0.9)',
                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4), 0 2px 6px rgba(0, 0, 0, 0.2)'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(40, 45, 60, 0.98)';
                                e.currentTarget.style.transform = 'scale(1.08)';
                                e.currentTarget.style.color = '#FFFFFF';
                                e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.5), 0 3px 8px rgba(0, 0, 0, 0.3)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(28, 33, 47, 0.95)';
                                e.currentTarget.style.transform = 'scale(1)';
                                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.4), 0 2px 6px rgba(0, 0, 0, 0.2)';
                            }}
                            onMouseDown={(e) => {
                                e.currentTarget.style.transform = 'scale(0.96) translateY(1px)';
                                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.25)';
                            }}
                            onMouseUp={(e) => {
                                e.currentTarget.style.transform = 'scale(1.08)';
                                e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.4), 0 3px 8px rgba(0, 0, 0, 0.2)';
                            }}
                        >
                            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                        </button>

                        {/* Navigation - Scrollable middle section */}
                        <nav
                            className="flex-1 px-3 py-4 overflow-y-auto"
                            style={{
                                minHeight: 0, // Important for flex child overflow
                                scrollbarWidth: 'thin',
                                scrollbarColor: 'rgba(255,255,255,0.2) transparent'
                            }}
                        >
                            {Object.entries(groupedNavItems).map(([group, items]) => (
                                <NavSection key={group} title={group} collapsed={isCollapsed}>
                                    {items.map((item) => (
                                        <NavItem
                                            key={item.route}
                                            href={item.route}
                                            icon={<item.icon size={18} />}
                                            label={item.label}
                                            collapsed={isCollapsed}
                                            isActive={isActive(item.route)}
                                        />
                                    ))}
                                </NavSection>
                            ))}
                        </nav>

                        {/* User Profile Section - Fixed at bottom */}
                        <div
                            className={`
                            p-3 shrink-0 transition-all duration-300
                            ${isCollapsed ? 'flex flex-col items-center gap-2' : ''}
                        `}
                            style={{ borderTop: '1px solid var(--nav-divider)' }}
                        >
                            {isCollapsed ? (
                                <>
                                    <div
                                        className="w-10 h-10 rounded-[12px] flex items-center justify-center overflow-hidden"
                                        style={{ background: 'rgba(255, 255, 255, 0.08)' }}
                                        title={session?.user?.name || 'User'}
                                    >
                                        {session?.user?.image ? (
                                            <img src={session.user.image} alt="Avatar" className="w-full h-full object-cover" />
                                        ) : (
                                            <UserIcon size={16} style={{ color: 'rgba(255, 255, 255, 0.6)' }} />
                                        )}
                                    </div>
                                    <button
                                        onClick={handleSignOut}
                                        className="
                                        w-10 h-10 rounded-[12px]
                                        flex items-center justify-center
                                        transition-all duration-200
                                    "
                                        style={{
                                            color: 'rgba(255, 255, 255, 0.5)',
                                            background: 'transparent'
                                        }}
                                        title="Sign Out"
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                                            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = 'transparent';
                                            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)';
                                        }}
                                    >
                                        <LogOut size={18} />
                                    </button>
                                </>
                            ) : (
                                <div
                                    className="flex items-center gap-3 px-3 py-2 rounded-[14px] transition-all duration-200"
                                    style={{ background: 'rgba(255, 255, 255, 0.04)' }}
                                >
                                    <div
                                        className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 overflow-hidden"
                                        style={{ background: 'rgba(255, 255, 255, 0.08)' }}
                                    >
                                        {session?.user?.image ? (
                                            <img src={session.user.image} alt="Avatar" className="w-full h-full object-cover" />
                                        ) : (
                                            <UserIcon size={16} style={{ color: 'rgba(255, 255, 255, 0.6)' }} />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p
                                            className="text-sm font-medium truncate"
                                            style={{ color: 'rgba(255, 255, 255, 0.95)' }}
                                        >
                                            {session?.user?.name || 'User'}
                                        </p>
                                        <p
                                            className="text-xs truncate"
                                            style={{ color: 'rgba(255, 255, 255, 0.5)' }}
                                        >
                                            {session?.user?.email}
                                        </p>
                                    </div>
                                    <button
                                        onClick={handleSignOut}
                                        className="
                                        p-2 rounded-[10px]
                                        transition-all duration-200
                                    "
                                        style={{
                                            color: 'rgba(255, 255, 255, 0.5)',
                                            background: 'transparent'
                                        }}
                                        title="Sign Out"
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                                            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = 'transparent';
                                            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)';
                                        }}
                                    >
                                        <LogOut size={16} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                    {/* End sidebar-content */}
                </div>
                {/* End sidebar-container */}
            </aside>
        </>
    );
};

// ─────────────────────────────────────────
// NavSection Component
// ─────────────────────────────────────────

const NavSection = ({
    title,
    collapsed,
    children
}: {
    title: string;
    collapsed: boolean;
    children: React.ReactNode;
}) => (
    <div className="py-3">
        {!collapsed && (
            <p
                className="px-4 mb-2 text-[10px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: 'var(--nav-text-label)' }}
            >
                {title}
            </p>
        )}
        <div className="space-y-0.5 px-2">
            {children}
        </div>
    </div>
);

// ─────────────────────────────────────────
// NavItem Component (Premium Styling)
// ─────────────────────────────────────────

const NavItem = ({
    href,
    icon,
    label,
    collapsed,
    isActive
}: {
    href: string;
    icon: React.ReactNode;
    label: string;
    collapsed: boolean;
    isActive: boolean;
}) => {
    const [isHovered, setIsHovered] = useState(false);

    const getStyles = () => {
        if (isActive) {
            // Active pill: taller, larger radius, soft glassy background, premium shadow
            return {
                background: 'rgba(255, 255, 255, 0.07)',
                border: '1px solid rgba(255, 255, 255, 0.09)',
                color: 'rgba(255, 255, 255, 0.94)',
                iconColor: 'rgba(255, 255, 255, 0.96)',
                boxShadow: '0 10px 24px rgba(0, 0, 0, 0.28), 0 4px 8px rgba(0, 0, 0, 0.15)'
            };
        }
        if (isHovered) {
            return {
                background: 'var(--nav-hover-bg)',
                border: '1px solid transparent',
                color: 'var(--nav-text)',
                iconColor: 'rgba(255, 255, 255, 0.75)',
                boxShadow: 'none'
            };
        }
        return {
            background: 'transparent',
            border: '1px solid transparent',
            color: 'var(--nav-text-muted)',
            iconColor: 'rgba(255, 255, 255, 0.38)',
            boxShadow: 'none'
        };
    };

    const styles = getStyles();

    // Active pill uses larger padding for "card-like" feel
    const paddingClass = isActive
        ? (collapsed ? 'justify-center px-3 py-3.5' : 'px-4 py-3.5')
        : (collapsed ? 'justify-center px-3 py-3' : 'px-4 py-3');

    return (
        <Link
            href={href}
            className={`
                flex items-center gap-3.5 
                ${paddingClass}
                rounded-[20px]
                transition-all duration-200
                relative
            `}
            style={{
                background: styles.background,
                border: styles.border,
                color: styles.color,
                boxShadow: styles.boxShadow
            }}
            title={collapsed ? label : undefined}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Icon */}
            <div
                className="shrink-0 transition-colors duration-200"
                style={{ color: styles.iconColor }}
            >
                {icon}
            </div>

            {/* Label */}
            {!collapsed && (
                <span
                    className="text-[13px] whitespace-nowrap"
                    style={{ fontWeight: isActive ? 500 : 450 }}
                >
                    {label}
                </span>
            )}
        </Link>
    );
};

export default Sidebar;
