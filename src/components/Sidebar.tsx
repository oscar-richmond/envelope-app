'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    List, Settings, PlusCircle, Send, Users,
    LayoutDashboard, ChevronLeft, ChevronRight,
    Mail, LogOut, User as UserIcon, RefreshCw
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useSession, signOut } from "next-auth/react";

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

    if (!mounted) return <aside className="w-64 bg-[var(--sidebar-bg)]" />;

    return (
        <aside
            className={`
                ${isCollapsed ? 'w-[72px]' : 'w-64'} 
                bg-[var(--sidebar-bg)] text-[var(--sidebar-text)]
                h-screen sticky top-0 flex flex-col 
                transition-all duration-200 ease-out
                border-r border-[var(--sidebar-border)] 
                relative group z-20
            `}
        >
            {/* Logo */}
            <div className={`
                h-16 flex items-center shrink-0
                ${isCollapsed ? 'justify-center px-3' : 'px-5'}
            `}>
                {isCollapsed ? (
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                        <span className="font-bold text-white text-lg">E</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
                            <span className="font-bold text-white text-lg">E</span>
                        </div>
                        <span className="text-lg font-semibold text-white tracking-tight">Envelope</span>
                    </div>
                )}
            </div>

            {/* Toggle Button */}
            <button
                onClick={toggle}
                className="
                    absolute -right-3 top-7
                    w-6 h-6 rounded-full
                    bg-[var(--sidebar-bg)] border border-[var(--sidebar-border)]
                    text-[var(--sidebar-text)] hover:text-white
                    flex items-center justify-center
                    opacity-0 group-hover:opacity-100 
                    transition-all duration-200
                    hover:bg-[var(--sidebar-hover)]
                    shadow-md
                "
            >
                {isCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
            </button>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                <NavSection title="Main" collapsed={isCollapsed}>
                    <NavItem href="/" icon={<List size={18} />} label="Lead Board" collapsed={isCollapsed} isActive={pathname === '/'} />
                    <NavItem href="/prospects" icon={<Users size={18} />} label="Prospects" collapsed={isCollapsed} isActive={pathname === '/prospects'} />
                </NavSection>

                <NavSection title="Outreach" collapsed={isCollapsed}>
                    <NavItem href="/outreach/sent" icon={<Mail size={18} />} label="Inbox" collapsed={isCollapsed} isActive={pathname === '/outreach/sent'} />
                    <NavItem href="/conversations" icon={<LayoutDashboard size={18} />} label="Conversations" collapsed={isCollapsed} isActive={pathname === '/conversations'} />
                    <NavItem href="/outreach/follow-ups" icon={<RefreshCw size={18} />} label="Follow-Ups" collapsed={isCollapsed} isActive={pathname === '/outreach/follow-ups'} />
                    <NavItem href="/outreach" icon={<Send size={18} />} label="Queue" collapsed={isCollapsed} isActive={pathname === '/outreach' && !pathname.includes('/sent') && !pathname.includes('/follow-ups')} />
                </NavSection>

                <NavSection title="System" collapsed={isCollapsed}>
                    <NavItem href="/import" icon={<PlusCircle size={18} />} label="Import" collapsed={isCollapsed} isActive={pathname === '/import'} />
                    <NavItem href="/settings" icon={<Settings size={18} />} label="Settings" collapsed={isCollapsed} isActive={pathname === '/settings'} />
                </NavSection>
            </nav>

            {/* User Profile */}
            <div className={`
                p-3 border-t border-[var(--sidebar-border)] shrink-0
                ${isCollapsed ? 'flex justify-center' : ''}
            `}>
                {isCollapsed ? (
                    <button
                        onClick={handleSignOut}
                        className="
                            w-10 h-10 rounded-xl
                            flex items-center justify-center
                            text-[var(--sidebar-text)] hover:text-white
                            hover:bg-[var(--sidebar-hover)]
                            transition-colors
                        "
                        title="Sign Out"
                    >
                        <LogOut size={18} />
                    </button>
                ) : (
                    <div className="flex items-center gap-3 px-2">
                        <div className="w-9 h-9 rounded-xl bg-[var(--sidebar-hover)] flex items-center justify-center shrink-0 overflow-hidden">
                            {session?.user?.image ? (
                                <img src={session.user.image} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                <UserIcon size={16} className="text-[var(--sidebar-text)]" />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                                {session?.user?.name || 'User'}
                            </p>
                            <p className="text-xs text-[var(--sidebar-text)] truncate">
                                {session?.user?.email}
                            </p>
                        </div>
                        <button
                            onClick={handleSignOut}
                            className="
                                p-2 rounded-lg
                                text-[var(--sidebar-text)] hover:text-white
                                hover:bg-[var(--sidebar-hover)]
                                transition-colors
                            "
                            title="Sign Out"
                        >
                            <LogOut size={16} />
                        </button>
                    </div>
                )}
            </div>
        </aside>
    );
};

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
            <p className="px-3 mb-2 text-[10px] font-medium uppercase tracking-wider text-[var(--sidebar-text)] opacity-60">
                {title}
            </p>
        )}
        <div className="space-y-0.5">
            {children}
        </div>
    </div>
);

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
}) => (
    <Link
        href={href}
        className={`
            flex items-center gap-3 
            ${collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'}
            rounded-xl
            transition-all duration-150
            group relative
            ${isActive
                ? 'bg-[var(--sidebar-active)] text-white'
                : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-white'
            }
        `}
        title={collapsed ? label : undefined}
    >
        <div className={`shrink-0 ${isActive ? 'text-indigo-400' : ''}`}>
            {icon}
        </div>
        {!collapsed && (
            <span className="text-sm font-medium whitespace-nowrap">
                {label}
            </span>
        )}
        {isActive && !collapsed && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-indigo-500 rounded-r-full" />
        )}
    </Link>
);

export default Sidebar;
