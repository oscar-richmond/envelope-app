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

    const navWidth = isCollapsed ? 72 : 256;

    return (
        <>
            {/* CSS variable for layout offset */}
            <style>{`:root { --sidebar-width: ${navWidth + 40}px; }`}</style>

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
                <div
                    className="h-full flex flex-col relative group"
                    style={{
                        background: 'var(--nav-bg-opacity)',
                        backdropFilter: 'blur(24px)',
                        WebkitBackdropFilter: 'blur(24px)',
                        borderRadius: '28px',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25), 0 4px 12px rgba(0, 0, 0, 0.15)',
                        border: '0.5px solid',
                        borderImage: 'linear-gradient(180deg, var(--nav-border-start), var(--nav-border-end)) 1',
                        overflow: 'hidden'
                    }}
                >
                    {/* Logo Section - Figma branding style */}
                    <div
                        className={`
                            flex items-center shrink-0 transition-all duration-300
                            ${isCollapsed ? 'justify-center px-4 py-6' : 'px-5 py-5'}
                        `}
                        style={{ borderBottom: '1px solid var(--nav-divider)' }}
                    >
                        {isCollapsed ? (
                            <div
                                className="w-9 h-9 rounded-[10px] flex items-center justify-center"
                                style={{ background: 'rgba(255, 255, 255, 0.08)' }}
                            >
                                <span className="font-bold text-white text-base">E</span>
                            </div>
                        ) : (
                            <div className="flex flex-col">
                                <span
                                    className="text-sm font-bold tracking-[0.08em] uppercase"
                                    style={{ color: 'var(--nav-text-active)' }}
                                >
                                    ENVELOPE
                                </span>
                                <span
                                    className="text-[11px] mt-0.5"
                                    style={{ color: 'var(--nav-text)' }}
                                >
                                    by Selfhood
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Collapse Toggle - Hover-only, premium styling */}
                    <button
                        onClick={toggle}
                        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        className="
                            absolute -right-4 top-10
                            w-8 h-8 rounded-full
                            flex items-center justify-center
                            transition-all duration-200
                            cursor-pointer z-20
                            opacity-0 group-hover:opacity-100
                            pointer-events-none group-hover:pointer-events-auto
                            focus:outline-none focus:ring-2 focus:ring-white/40
                        "
                        style={{
                            background: 'rgba(255, 255, 255, 0.22)',
                            border: '1px solid rgba(255, 255, 255, 0.18)',
                            color: 'rgba(255, 255, 255, 0.95)',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3), 0 2px 6px rgba(0, 0, 0, 0.15)'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.30)';
                            e.currentTarget.style.transform = 'scale(1.08)';
                            e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.4), 0 3px 8px rgba(0, 0, 0, 0.2)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.22)';
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3), 0 2px 6px rgba(0, 0, 0, 0.15)';
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
    <div className="py-2">
        {!collapsed && (
            <p
                className="px-4 mb-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
                style={{ color: 'var(--nav-text)' }}
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
            return {
                background: 'var(--nav-active-bg)',
                color: 'var(--nav-text-active)',
                iconColor: 'var(--nav-icon-active)'
            };
        }
        if (isHovered) {
            return {
                background: 'var(--nav-hover-bg)',
                color: '#CCCCCC',
                iconColor: '#BBBBBB'
            };
        }
        return {
            background: 'transparent',
            color: 'var(--nav-text)',
            iconColor: 'var(--nav-icon)'
        };
    };

    const styles = getStyles();

    return (
        <Link
            href={href}
            className={`
                flex items-center gap-3 
                ${collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'}
                rounded-[12px]
                transition-all duration-200
                relative
            `}
            style={{
                background: styles.background,
                color: styles.color
            }}
            title={collapsed ? label : undefined}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Active indicator - Figma uses pill background only, no accent bar */}

            {/* Icon */}
            <div
                className="shrink-0 transition-colors duration-200"
                style={{ color: styles.iconColor }}
            >
                {icon}
            </div>

            {/* Label */}
            {!collapsed && (
                <span className="text-sm font-medium whitespace-nowrap">
                    {label}
                </span>
            )}
        </Link>
    );
};

export default Sidebar;
