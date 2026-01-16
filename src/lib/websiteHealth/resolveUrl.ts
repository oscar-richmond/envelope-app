/**
 * Website URL Resolution
 * 
 * Resolves website URL from multiple sources in priority order.
 * Returns explicit error if no URL can be found.
 */

import prisma from '@/lib/prisma';

export interface UrlResolution {
    url: string | null;
    source: 'company_url' | 'company_domain' | 'google_places' | 'none';
    error?: string;
}

export async function resolveWebsiteUrl(companyId: number): Promise<{ url: string | null; source: string | null }> {
    const company = await prisma.companyProspect.findUnique({
        where: { id: companyId },
        select: {
            websiteUrl: true,
            websiteDomain: true,
            placesDisplayName: true,
            websiteMetaTitle: true
        }
    });

    if (!company) {
        return {
            url: null,
            source: 'none',
            error: 'COMPANY_NOT_FOUND'
        };
    }

    // Priority 1: websiteUrl field
    if (company.websiteUrl && company.websiteUrl.trim().length > 0) {
        return {
            url: company.websiteUrl,
            source: 'company_url'
        };
    }

    // Priority 2: websiteDomain field (construct URL)
    if (company.websiteDomain && company.websiteDomain.trim().length > 0) {
        const domain = company.websiteDomain.trim();
        const url = domain.startsWith('http') ? domain : `https://${domain}`;
        return {
            url,
            source: 'company_domain'
        };
    }

    // No URL found
    return {
        url: null,
        source: 'none',
        error: 'NO_WEBSITE_URL'
    };
}
