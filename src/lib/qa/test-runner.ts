/**
 * QA Test Runner
 * Automated tests for all email discovery endpoints
 */

import { TEST_COMPANIES, TestCompany } from './test-fixtures';

export interface TestResult {
    testId: string;
    companyId: string;
    step: string;
    passed: boolean;
    message: string;
    durationMs: number;
    requestId?: string;
    details?: Record<string, unknown>;
}

export interface TestSuiteResult {
    totalTests: number;
    passed: number;
    failed: number;
    results: TestResult[];
    startedAt: string;
    completedAt: string;
    durationMs: number;
}

// ============================================
// INDIVIDUAL TESTS
// ============================================

export async function testDomainNormalization(
    company: TestCompany,
    apiBase: string
): Promise<TestResult> {
    const start = Date.now();
    const testId = `${company.id}_domain`;

    try {
        const res = await fetch(`${apiBase}/api/email-discovery/v3`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain: company.domain })
        });

        const data = await res.json();

        const passed = data.success === true;

        return {
            testId,
            companyId: company.id,
            step: 'Domain normalization',
            passed,
            message: passed ? 'Domain accepted' : `Failed: ${data.error || 'Unknown'}`,
            durationMs: Date.now() - start,
            requestId: data.requestId,
        };
    } catch (err: any) {
        return {
            testId,
            companyId: company.id,
            step: 'Domain normalization',
            passed: false,
            message: `Error: ${err.message}`,
            durationMs: Date.now() - start,
        };
    }
}

export async function testEmailDiscovery(
    company: TestCompany,
    apiBase: string
): Promise<TestResult> {
    const start = Date.now();
    const testId = `${company.id}_discovery`;

    try {
        const res = await fetch(`${apiBase}/api/email-discovery/v3`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                domain: company.domain,
                seedUrl: company.website,
                options: { crawlSite: true, publicSearch: true }
            })
        });

        const data = await res.json();

        if (!data.success) {
            return {
                testId,
                companyId: company.id,
                step: 'Email discovery',
                passed: false,
                message: `API error: ${data.error}`,
                durationMs: Date.now() - start,
                requestId: data.requestId,
            };
        }

        const emailCount = data.emails?.length || 0;
        const passed = emailCount >= company.expectations.minEmails;

        return {
            testId,
            companyId: company.id,
            step: 'Email discovery',
            passed,
            message: passed
                ? `Found ${emailCount} emails (expected >= ${company.expectations.minEmails})`
                : `Found ${emailCount} emails, expected >= ${company.expectations.minEmails}`,
            durationMs: Date.now() - start,
            requestId: data.requestId,
            details: {
                emailCount,
                pagesCrawled: data.stats?.pagesCrawled,
                pdfsParsed: data.stats?.pdfsParsed,
                patterns: data.patterns,
            }
        };
    } catch (err: any) {
        return {
            testId,
            companyId: company.id,
            step: 'Email discovery',
            passed: false,
            message: `Error: ${err.message}`,
            durationMs: Date.now() - start,
        };
    }
}

export async function testCompaniesHouseResolve(
    company: TestCompany,
    apiBase: string
): Promise<TestResult> {
    const start = Date.now();
    const testId = `${company.id}_ch_resolve`;

    if (!company.expectations.hasCH) {
        return {
            testId,
            companyId: company.id,
            step: 'CH resolve',
            passed: true,
            message: 'Skipped (no CH expected)',
            durationMs: 0,
        };
    }

    try {
        const res = await fetch(`${apiBase}/api/enrichment/companies-house/resolve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ companyName: company.name })
        });

        const data = await res.json();

        if (!data.success) {
            // CH might not be configured
            if (data.error?.includes('not configured')) {
                return {
                    testId,
                    companyId: company.id,
                    step: 'CH resolve',
                    passed: true,
                    message: 'Skipped (CH API not configured)',
                    durationMs: Date.now() - start,
                };
            }
            return {
                testId,
                companyId: company.id,
                step: 'CH resolve',
                passed: false,
                message: `API error: ${data.error}`,
                durationMs: Date.now() - start,
                requestId: data.requestId,
            };
        }

        const passed = data.status === 'matched' || data.candidates?.length > 0;

        return {
            testId,
            companyId: company.id,
            step: 'CH resolve',
            passed,
            message: passed
                ? `Matched: ${data.companyNumber || 'candidates found'}`
                : 'No match found',
            durationMs: Date.now() - start,
            requestId: data.requestId,
            details: {
                status: data.status,
                companyNumber: data.companyNumber,
                candidateCount: data.candidates?.length,
            }
        };
    } catch (err: any) {
        return {
            testId,
            companyId: company.id,
            step: 'CH resolve',
            passed: false,
            message: `Error: ${err.message}`,
            durationMs: Date.now() - start,
        };
    }
}

export async function testCompaniesHouseOfficers(
    company: TestCompany,
    apiBase: string
): Promise<TestResult> {
    const start = Date.now();
    const testId = `${company.id}_ch_officers`;

    if (!company.companyNumber) {
        return {
            testId,
            companyId: company.id,
            step: 'CH officers',
            passed: true,
            message: 'Skipped (no company number)',
            durationMs: 0,
        };
    }

    try {
        const res = await fetch(`${apiBase}/api/enrichment/companies-house/officers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ companyNumber: company.companyNumber })
        });

        const data = await res.json();

        if (!data.success) {
            if (data.error?.includes('not configured')) {
                return {
                    testId,
                    companyId: company.id,
                    step: 'CH officers',
                    passed: true,
                    message: 'Skipped (CH API not configured)',
                    durationMs: Date.now() - start,
                };
            }
            return {
                testId,
                companyId: company.id,
                step: 'CH officers',
                passed: false,
                message: `API error: ${data.error}`,
                durationMs: Date.now() - start,
                requestId: data.requestId,
            };
        }

        const officerCount = data.officers?.length || 0;
        const passed = officerCount >= 1;

        return {
            testId,
            companyId: company.id,
            step: 'CH officers',
            passed,
            message: passed ? `Found ${officerCount} officers` : 'No officers found',
            durationMs: Date.now() - start,
            requestId: data.requestId,
            details: {
                officerCount,
                decisionMakerCount: data.decisionMakers?.length,
            }
        };
    } catch (err: any) {
        return {
            testId,
            companyId: company.id,
            step: 'CH officers',
            passed: false,
            message: `Error: ${err.message}`,
            durationMs: Date.now() - start,
        };
    }
}

// ============================================
// RUN ALL TESTS
// ============================================

export async function runTestSuite(
    apiBase: string,
    companies?: TestCompany[]
): Promise<TestSuiteResult> {
    const startTime = Date.now();
    const startedAt = new Date().toISOString();
    const results: TestResult[] = [];

    const testCompanies = companies || TEST_COMPANIES;

    for (const company of testCompanies) {
        console.log(`[QA] Testing: ${company.name}`);

        // Run tests sequentially to avoid rate limits
        results.push(await testDomainNormalization(company, apiBase));
        results.push(await testEmailDiscovery(company, apiBase));
        results.push(await testCompaniesHouseResolve(company, apiBase));
        results.push(await testCompaniesHouseOfficers(company, apiBase));

        // Small delay between companies
        await new Promise(r => setTimeout(r, 500));
    }

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    return {
        totalTests: results.length,
        passed,
        failed,
        results,
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
    };
}

export async function runSingleCompanyTest(
    companyId: string,
    apiBase: string
): Promise<TestResult[]> {
    const company = TEST_COMPANIES.find(c => c.id === companyId);
    if (!company) {
        return [{
            testId: 'not_found',
            companyId,
            step: 'Setup',
            passed: false,
            message: `Company not found: ${companyId}`,
            durationMs: 0,
        }];
    }

    const results: TestResult[] = [];
    results.push(await testDomainNormalization(company, apiBase));
    results.push(await testEmailDiscovery(company, apiBase));
    results.push(await testCompaniesHouseResolve(company, apiBase));
    results.push(await testCompaniesHouseOfficers(company, apiBase));

    return results;
}
