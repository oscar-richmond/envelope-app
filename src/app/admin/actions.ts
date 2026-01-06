
'use server';

import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

async function checkAdmin() {
    const session = await auth();
    // @ts-ignore
    if (!session?.user?.isAdmin) {
        throw new Error("Unauthorized");
    }
    return session.user.id;
}

export async function approveUser(userId: string) {
    const adminId = await checkAdmin();
    await prisma.user.update({
        where: { id: userId },
        data: {
            accessStatus: 'approved',
            approvedAt: new Date(),
            approvedByUserId: adminId,
            deniedAt: null,
        }
    });
    revalidatePath('/admin/access');
}

export async function denyUser(userId: string) {
    const adminId = await checkAdmin();
    await prisma.user.update({
        where: { id: userId },
        data: {
            accessStatus: 'denied',
            deniedAt: new Date(),
            approvedAt: null,
            approvedByUserId: null,
        }
    });
    revalidatePath('/admin/access');
}

export async function makeAdmin(userId: string) {
    await checkAdmin();
    await prisma.user.update({
        where: { id: userId },
        data: { isAdmin: true }
    });
    revalidatePath('/admin/access');
}

export async function deleteUser(userId: string) {
    await checkAdmin();
    await prisma.user.delete({
        where: { id: userId }
    });
    revalidatePath('/admin/access');
}
