
'use client';

import Link from 'next/link';
import { Home, List, Settings, PlusCircle, Send, Users, Upload, LayoutDashboard, ChevronLeft, ChevronRight, Mail, LogOut, User as UserIcon } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useSession, signOut } from "next-auth/react";

const Sidebar = () => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [mounted, setMounted] = useState(false);
    const { data: session } = useSession();

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

    if (!mounted) return <aside className="w-64 bg-gray-900 border-r border-gray-800" />;

    return (
        <aside
            className={`${isCollapsed ? 'w-20' : 'w-64'} bg-gray-900 text-white h-screen sticky top-0 flex flex-col transition-all duration-300 ease-in-out border-r border-gray-800 relative group z-20`}
        >
            {/* Header */}
            <div className={`h-16 flex items-center ${isCollapsed ? 'justify-center' : 'px-6'} border-b border-gray-800 shrink-0`}>
                {isCollapsed ? (
                    <span className="font-bold text-xl text-blue-400">E</span>
                ) : (
                    <h1 className="text-xl font-bold tracking-tight whitespace-nowrap overflow-hidden">
                        Envelope
                    </h1>
                )}
            </div>

            {/* Toggle Button */}
            <button
                onClick={toggle}
                className="absolute -right-3 top-20 bg-gray-800 text-gray-400 hover:text-white p-1 rounded-full border border-gray-700 opacity-0 group-hover:opacity-100 transition-opacity z-50"
            >
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>

            {/* Nav */}
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                <NavItem href="/" icon={<List size={20} />} label="Lead Board" collapsed={isCollapsed} />
                <NavItem href="/prospects" icon={<Users size={20} />} label="Prospect Search" collapsed={isCollapsed} />
                <NavItem href="/outreach/sent" icon={<Mail size={20} />} label="Inbox" collapsed={isCollapsed} />
                <NavItem href="/outreach" icon={<Send size={20} />} label="Outreach Queue" collapsed={isCollapsed} />
                <NavItem href="/import" icon={<PlusCircle size={20} />} label="Import Leads" collapsed={isCollapsed} />
                <NavItem href="/settings" icon={<Settings size={20} />} label="Settings" collapsed={isCollapsed} />
            </nav>

            {/* User Profile / Sign Out */}
            <div className={`p-4 border-t border-gray-800 shrink-0`}>
                {isCollapsed ? (
                    <button
                        onClick={handleSignOut}
                        className="w-full flex justify-center text-gray-400 hover:text-white transition-colors"
                        title="Sign Out"
                    >
                        <LogOut size={20} />
                    </button>
                ) : (
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 shrink-0">
                            {session?.user?.image ? (
                                <img src={session.user.image} alt="Avatar" className="w-8 h-8 rounded-full" />
                            ) : (
                                <UserIcon size={16} />
                            )}
                        </div>
                        <div className="flex-1 min-w-0 overflow-hidden">
                            <p className="text-sm font-medium text-white truncate">
                                {session?.user?.name || 'User'}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                                {session?.user?.email}
                            </p>
                        </div>
                        <button
                            onClick={handleSignOut}
                            className="text-gray-400 hover:text-white transition-colors p-1"
                            title="Sign Out"
                        >
                            <LogOut size={18} />
                        </button>
                    </div>
                )}
            </div>
        </aside>
    );
};

const NavItem = ({ href, icon, label, collapsed }: { href: string, icon: any, label: string, collapsed: boolean }) => (
    <Link
        href={href}
        className={`flex items-center gap-3 px-3 py-3 text-gray-300 hover:bg-gray-800 hover:text-white rounded-lg transition-colors group relative
            ${collapsed ? 'justify-center' : ''}
        `}
        title={collapsed ? label : undefined}
    >
        <div className="shrink-0">{icon}</div>
        {!collapsed && (
            <span className="whitespace-nowrap overflow-hidden transition-opacity duration-200">
                {label}
            </span>
        )}
    </Link>
);

export default Sidebar;
