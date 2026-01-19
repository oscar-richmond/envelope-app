/**
 * API Schema Validation
 * Zod schemas for all email discovery and enrichment endpoints
 */

import { z } from 'zod';

// ============================================
// COMMON SCHEMAS
// ============================================

export const BaseResponseSchema = z.object({
    success: z.boolean(),
    requestId: z.string(),
    message: z.string().optional(),
    error: z.string().optional(),
});

export const EvidenceSchema = z.object({
    url: z.string(),
    title: z.string().optional(),
    snippet: z.string().optional(),
    pageType: z.string().optional(),
    type: z.string().optional(),
});

export const ContactSchema = z.object({
    email: z.string().email(),
    name: z.string().nullable().optional(),
    role: z.string().nullable().optional(),
    type: z.enum(['person', 'generic', 'suggested']).optional(),
    confidence: z.enum(['high', 'medium', 'low', 'verified', 'likely', 'weak']).optional(),
    source: z.string().optional(),
    evidence: EvidenceSchema.optional(),
    sources: z.array(EvidenceSchema).optional(),
    score: z.number().optional(),
    isGeneric: z.boolean().optional(),
    isSuggested: z.boolean().optional(),
});

// ============================================
// /api/extension/capture
// ============================================

export const CaptureRequestSchema = z.object({
    company: z.object({
        name: z.string().min(1),
        website: z.string().url().optional(),
        industry: z.string().optional(),
    }),
    contacts: z.array(z.object({
        email: z.string().email(),
        name: z.string().optional(),
        role: z.string().optional(),
    })).optional(),
    source: z.string().optional(),
    sourceUrl: z.string().optional(),
});

export const CaptureResponseSchema = BaseResponseSchema.extend({
    companyId: z.string().optional(),
    contactsAdded: z.number().optional(),
});

// ============================================
// /api/extension/contacts
// ============================================

export const ContactsRequestSchema = z.object({
    domain: z.string().optional(),
    websiteUrl: z.string().optional(),
    companyName: z.string().optional(),
    includeGuessed: z.boolean().optional(),
}).refine(data => data.domain || data.websiteUrl, {
    message: 'Either domain or websiteUrl is required'
});

export const ContactsResponseSchema = BaseResponseSchema.extend({
    domain: z.string().optional(),
    contacts: z.array(ContactSchema).optional(),
    meta: z.object({
        domain: z.string().optional(),
        scannedPages: z.number().optional(),
        scannedPdfs: z.number().optional(),
        foundTotal: z.number().optional(),
        foundNonGeneric: z.number().optional(),
        foundVerified: z.number().optional(),
        foundGeneric: z.number().optional(),
        cached: z.boolean().optional(),
        timeTakenMs: z.number().optional(),
    }).optional(),
});

// ============================================
// /api/email-discovery/v3
// ============================================

export const DiscoveryV3RequestSchema = z.object({
    domain: z.string().min(1),
    seedUrl: z.string().optional(),
    options: z.object({
        crawlSite: z.boolean().optional(),
        publicSearch: z.boolean().optional(),
    }).optional(),
});

export const PatternSchema = z.object({
    pattern: z.string(),
    verified: z.boolean(),
    matches: z.number(),
    examples: z.array(z.string()).optional(),
});

export const DiscoveryV3ResponseSchema = BaseResponseSchema.extend({
    bestContacts: z.array(ContactSchema).optional(),
    emails: z.array(ContactSchema).optional(),
    patterns: z.array(PatternSchema).optional(),
    stats: z.object({
        pagesCrawled: z.number(),
        publicResultsFetched: z.number(),
        pdfsParsed: z.number(),
        durationMs: z.number(),
    }).optional(),
    warnings: z.array(z.string()).optional(),
});

// ============================================
// /api/enrichment/companies-house/resolve
// ============================================

export const CHResolveRequestSchema = z.object({
    companyName: z.string().optional(),
    companyNumber: z.string().optional(),
    postcode: z.string().optional(),
    city: z.string().optional(),
}).refine(data => data.companyName || data.companyNumber, {
    message: 'Either companyName or companyNumber is required'
});

export const CHCandidateSchema = z.object({
    companyNumber: z.string(),
    companyName: z.string(),
    companyStatus: z.string(),
    companyType: z.string().optional(),
    addressSnippet: z.string().optional(),
    dateOfCreation: z.string().optional(),
    matchScore: z.number(),
});

export const CHResolveResponseSchema = BaseResponseSchema.extend({
    status: z.enum(['matched', 'uncertain', 'not_found', 'error']).optional(),
    companyNumber: z.string().optional(),
    companyName: z.string().optional(),
    candidates: z.array(CHCandidateSchema).optional(),
});

// ============================================
// /api/enrichment/companies-house/officers
// ============================================

export const CHOfficersRequestSchema = z.object({
    companyNumber: z.string().min(1),
});

export const OfficerSchema = z.object({
    name: z.string(),
    fullName: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    role: z.string(),
    appointedOn: z.string().nullable(),
    resignedOn: z.string().nullable(),
    isActive: z.boolean(),
    nationality: z.string().optional(),
    occupation: z.string().optional(),
});

export const CHOfficersResponseSchema = BaseResponseSchema.extend({
    companyNumber: z.string().optional(),
    companyName: z.string().optional(),
    officers: z.array(OfficerSchema).optional(),
    decisionMakers: z.array(OfficerSchema).optional(),
    totalOfficers: z.number().optional(),
    fetchedAt: z.string().optional(),
});

// ============================================
// /api/enrichment/email/suggest-from-officers
// ============================================

export const SuggestRequestSchema = z.object({
    companyNumber: z.string().min(1),
    domain: z.string().min(1),
    foundEmails: z.array(z.object({
        email: z.string().email(),
        name: z.string().nullable().optional(),
    })).optional(),
});

export const SuggestedContactSchema = z.object({
    officerId: z.string(),
    name: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    role: z.string(),
    emailSuggested: z.string().email(),
    patternType: z.string(),
    confidence: z.enum(['verified', 'likely', 'weak']),
    verificationStatus: z.enum(['pending', 'valid', 'invalid', 'unknown']),
    source: z.string(),
});

export const SuggestResponseSchema = BaseResponseSchema.extend({
    suggestedContacts: z.array(SuggestedContactSchema).optional(),
    pattern: z.object({
        type: z.string(),
        confidence: z.enum(['verified', 'likely', 'weak']),
        evidenceCount: z.number(),
        evidenceEmails: z.array(z.string()),
        domain: z.string(),
    }).nullable().optional(),
    canSuggest: z.boolean().optional(),
    reason: z.string().optional(),
});

// ============================================
// /api/enrichment/email/verify
// ============================================

export const VerifyRequestSchema = z.object({
    email: z.string().email(),
    companyId: z.string().optional(),
});

export const VerifyResponseSchema = BaseResponseSchema.extend({
    email: z.string().optional(),
    status: z.enum(['valid', 'invalid', 'risky', 'unknown']).optional(),
    provider: z.string().optional(),
    checkedAt: z.string().optional(),
    details: z.string().optional(),
});

// ============================================
// VALIDATION HELPERS
// ============================================

export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
    const result = schema.safeParse(data);
    if (result.success) {
        return { success: true, data: result.data };
    }
    const errors = result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    return { success: false, error: `Validation failed: ${errors}` };
}

export function createErrorResponse(requestId: string, error: string, code?: string) {
    return {
        success: false,
        requestId,
        errorCode: code || 'VALIDATION_ERROR',
        message: error,
        error,
    };
}

export function createSuccessResponse<T extends Record<string, unknown>>(requestId: string, data: T) {
    return {
        success: true,
        requestId,
        ...data,
    };
}
