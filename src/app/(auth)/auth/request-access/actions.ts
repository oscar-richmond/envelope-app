'use server';

export async function requestAccess(formData: FormData): Promise<void> {
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const company = formData.get('company') as string;
    const note = formData.get('note') as string;

    console.log('Access request:', { name, email, company, note });
    // TODO: Send email or save to database
}
