import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * PATCH /api/contacts/:contactId - Update a contact
 */
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ contactId: string }> }
) {
    try {
        const { contactId } = await params;
        const contactIdNum = parseInt(contactId);

        if (isNaN(contactIdNum)) {
            return NextResponse.json({ error: 'Invalid contact ID' }, { status: 400 });
        }

        const body = await request.json();
        const { firstName, lastName, email, role, roleTitle } = body;

        // Validate email if provided
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
        }

        // Check contact exists
        const existing = await prisma.contact.findUnique({
            where: { id: contactIdNum }
        });

        if (!existing) {
            return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
        }

        // Update contact
        const updated = await prisma.contact.update({
            where: { id: contactIdNum },
            data: {
                ...(firstName !== undefined && { firstName }),
                ...(lastName !== undefined && { lastName }),
                ...(email !== undefined && { email }),
                ...(role !== undefined && { role }),
                ...(roleTitle !== undefined && { title: roleTitle })
            }
        });

        return NextResponse.json({
            success: true,
            contact: {
                id: updated.id.toString(),
                firstName: updated.firstName,
                lastName: updated.lastName,
                email: updated.email,
                linkedInUrl: updated.linkedInUrl,
                roleTitle: updated.title
            }
        });

    } catch (error: any) {
        console.error('[Contacts PATCH] Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to update contact' }, { status: 500 });
    }
}

/**
 * DELETE /api/contacts/:contactId - Delete a contact
 */
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ contactId: string }> }
) {
    try {
        const { contactId } = await params;
        const contactIdNum = parseInt(contactId);

        if (isNaN(contactIdNum)) {
            return NextResponse.json({ error: 'Invalid contact ID' }, { status: 400 });
        }

        // Check contact exists
        const existing = await prisma.contact.findUnique({
            where: { id: contactIdNum }
        });

        if (!existing) {
            return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
        }

        // Delete contact
        await prisma.contact.delete({
            where: { id: contactIdNum }
        });

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('[Contacts DELETE] Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to delete contact' }, { status: 500 });
    }
}
