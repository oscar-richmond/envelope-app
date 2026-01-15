import prisma from '@/lib/prisma';

/**
 * Resolves company identity from either companyId (internal) or companyNumber (Companies House).
 * Returns both identifiers when resolved, or null if resolution fails.
 * 
 * @param opts.companyId - Internal CompanyProspect ID
 * @param opts.companyNumber - Companies House registration number
 * @param opts.createIfMissing - If true, creates a new CompanyProspect record if CH number provided but no record exists
 * @returns { companyId, companyNumber } or null
 */
export async function resolveCompanyIdentity(opts: {
    companyId?: number | null;
    companyNumber?: string | null;
    createIfMissing?: boolean;
}): Promise<{ companyId: number; companyNumber: string | null } | null> {
    const { companyId, companyNumber, createIfMissing = false } = opts;

    // 1. If companyId provided, look it up
    if (companyId && !isNaN(companyId)) {
        const company = await prisma.companyProspect.findUnique({
            where: { id: companyId },
            select: { id: true, companyNumber: true }
        });

        if (company) {
            return {
                companyId: company.id,
                companyNumber: company.companyNumber
            };
        }
    }

    // 2. If companyNumber provided, resolve to companyId
    if (companyNumber) {
        const company = await prisma.companyProspect.findFirst({
            where: { companyNumber },
            select: { id: true, companyNumber: true }
        });

        if (company) {
            return {
                companyId: company.id,
                companyNumber: company.companyNumber
            };
        }

        // Optionally create a new record
        if (createIfMissing) {
            const newCompany = await prisma.companyProspect.create({
                data: {
                    companyNumber,
                    companyName: `Company ${companyNumber}`, // Placeholder, should be enriched
                    source: 'RESOLVER'
                },
                select: { id: true, companyNumber: true }
            });

            return {
                companyId: newCompany.id,
                companyNumber: newCompany.companyNumber
            };
        }
    }

    // Resolution failed
    console.warn('[resolveCompanyIdentity] Failed to resolve:', { companyId, companyNumber });
    return null;
}

/**
 * Attempts resolution and returns structured error if failed.
 * Use this in API routes for consistent error handling.
 */
export async function resolveCompanyIdentityOrError(opts: {
    companyId?: number | null;
    companyNumber?: string | null;
}): Promise<
    | { success: true; companyId: number; companyNumber: string | null }
    | { success: false; error: string; errorCode: string; hint: string }
> {
    const result = await resolveCompanyIdentity(opts);

    if (!result) {
        return {
            success: false,
            error: 'Company resolution failed',
            errorCode: 'COMPANY_RESOLUTION_FAILED',
            hint: 'Please rescan the company profile or ensure the company exists in the system'
        };
    }

    return {
        success: true,
        companyId: result.companyId,
        companyNumber: result.companyNumber
    };
}
