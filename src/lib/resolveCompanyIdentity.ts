import prisma from '@/lib/prisma';

/**
 * Resolves company identity from either companyId (internal) or companiesHouseNumber.
 * Returns both identifiers when resolved, or null if resolution fails.
 * 
 * @param opts.companyId - Internal CompanyProspect ID
 * @param opts.companiesHouseNumber - Companies House registration number
 * @param opts.createIfMissing - If true, creates a new CompanyProspect record if CH number provided but no record exists
 * @returns { companyId, companiesHouseNumber } or null
 */
export async function resolveCompanyIdentity(opts: {
    companyId?: number | null;
    companiesHouseNumber?: string | null;
    createIfMissing?: boolean;
}): Promise<{ companyId: number; companiesHouseNumber: string | null } | null> {
    const { companyId, companiesHouseNumber, createIfMissing = false } = opts;

    // 1. If companyId provided, look it up
    if (companyId && !isNaN(companyId)) {
        const company = await prisma.companyProspect.findUnique({
            where: { id: companyId },
            select: { id: true, companiesHouseNumber: true }
        });

        if (company) {
            return {
                companyId: company.id,
                companiesHouseNumber: company.companiesHouseNumber
            };
        }
    }

    // 2. If companiesHouseNumber provided, resolve to companyId
    if (companiesHouseNumber) {
        const company = await prisma.companyProspect.findFirst({
            where: { companiesHouseNumber },
            select: { id: true, companiesHouseNumber: true }
        });

        if (company) {
            return {
                companyId: company.id,
                companiesHouseNumber: company.companiesHouseNumber
            };
        }

        // Optionally create a new record
        if (createIfMissing) {
            const newCompany = await prisma.companyProspect.create({
                data: {
                    companiesHouseNumber,
                    companyName: `Company ${companiesHouseNumber}`, // Placeholder, should be enriched
                    source: 'RESOLVER'
                },
                select: { id: true, companiesHouseNumber: true }
            });

            return {
                companyId: newCompany.id,
                companiesHouseNumber: newCompany.companiesHouseNumber
            };
        }
    }

    // Resolution failed
    console.warn('[resolveCompanyIdentity] Failed to resolve:', { companyId, companiesHouseNumber });
    return null;
}

/**
 * Attempts resolution and returns structured error if failed.
 * Use this in API routes for consistent error handling.
 */
export async function resolveCompanyIdentityOrError(opts: {
    companyId?: number | null;
    companiesHouseNumber?: string | null;
}): Promise<
    | { success: true; companyId: number; companiesHouseNumber: string | null }
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
        companiesHouseNumber: result.companiesHouseNumber
    };
}
