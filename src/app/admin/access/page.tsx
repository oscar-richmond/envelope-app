
import prisma from '@/lib/prisma';
import { approveUser, denyUser, deleteUser, makeAdmin } from '../actions';
import { revalidatePath } from 'next/cache';

// Layout & UI Components
function UserRow({ user, status }: { user: any, status: string }) {
    return (
        <tr className="border-b last:border-b-0 hover:bg-gray-50">
            <td className="px-4 py-3">
                <div className="font-medium text-gray-900">{user.name || 'No Name'}</div>
                <div className="text-sm text-gray-500">{user.email}</div>
                {user.isAdmin && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 mt-1">Admin</span>}
            </td>
            <td className="px-4 py-3 text-sm text-gray-600">
                {user.company || '-'}
            </td>
            <td className="px-4 py-3 text-sm text-gray-600">
                {user.requestNote || '-'}
            </td>
            <td className="px-4 py-3 text-sm text-gray-500">
                {new Date(user.createdAt).toLocaleDateString()}
            </td>
            <td className="px-4 py-3 text-right space-x-2">
                {status === 'waitlisted' && (
                    <>
                        <form action={approveUser.bind(null, user.id)} className="inline">
                            <button className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded hover:bg-green-200 font-medium border border-green-200">Approve</button>
                        </form>
                        <form action={denyUser.bind(null, user.id)} className="inline">
                            <button className="text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded hover:bg-red-200 font-medium border border-red-200">Deny</button>
                        </form>
                    </>
                )}

                {status === 'approved' && !user.isAdmin && (
                    <form action={denyUser.bind(null, user.id)} className="inline">
                        <button className="text-xs text-red-600 hover:underline">Revoke</button>
                    </form>
                )}

                {status === 'approved' && !user.isAdmin && (
                    <form action={makeAdmin.bind(null, user.id)} className="inline ml-2">
                        <button className="text-xs text-purple-600 hover:underline">Make Admin</button>
                    </form>
                )}

                {(status === 'denied' || status === 'waitlisted') && (
                    <form action={deleteUser.bind(null, user.id)} className="inline ml-2">
                        <button className="text-xs text-gray-400 hover:text-red-600">Delete</button>
                    </form>
                )}
            </td>
        </tr>
    );
}

export default async function AdminAccessPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
    const params = await searchParams;
    const tab = params.tab || 'waitlist';

    const whereMap: any = {
        'waitlist': { accessStatus: 'waitlisted' },
        'approved': { accessStatus: 'approved' },
        'denied': { accessStatus: 'denied' }
    };

    const users = await prisma.user.findMany({
        where: whereMap[tab],
        orderBy: { createdAt: 'desc' },
        include: { accounts: true }
    });

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 text-gray-900">Access Management</h1>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-6">
                {['waitlist', 'approved', 'denied'].map((t) => (
                    <a
                        key={t}
                        href={`?tab=${t}`}
                        className={`capitalize px-6 py-3 font-medium text-sm border-b-2 transition-colors ${tab === t
                                ? 'border-gray-900 text-gray-900'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        {t} ({
                            // This is expensive to count all? Nah, just simplify.
                            // Ideally passed in.
                            t
                        })
                    </a>
                ))}
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-4 py-3 font-semibold text-sm text-gray-700">User</th>
                            <th className="px-4 py-3 font-semibold text-sm text-gray-700">Company</th>
                            <th className="px-4 py-3 font-semibold text-sm text-gray-700">Note</th>
                            <th className="px-4 py-3 font-semibold text-sm text-gray-700">Joined</th>
                            <th className="px-4 py-3 font-semibold text-sm text-gray-700 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {users.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-gray-500 text-sm">
                                    No users found in {tab}
                                </td>
                            </tr>
                        ) : (
                            users.map(u => (
                                <UserRow key={u.id} user={u} status={tab} />
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
