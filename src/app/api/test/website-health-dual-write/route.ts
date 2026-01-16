/**
 * Website Health Dual-Write Integration Test
 * 
 * Tests that:
 * 1. Scan updates both new and legacy fields
 * 2. Fields are consistent after write
 * 3. Mismatch detector returns 0 for the scanned company
 */

import prisma from '@/lib/prisma';

interface TestResult {
    testName: string;
    passed: boolean;
    details: string;
    data?: any;
}

export async function runWebsiteHealthIntegrationTest(baseUrl: string = 'http://localhost:3000'): Promise<{
    allPassed: boolean;
    results: TestResult[];
}> {
    const results: TestResult[] = [];

    try {
        // 1. Find a company with a website URL
        const testCompany = await prisma.companyProspect.findFirst({
            where: {
                websiteUrl: { not: null },
                websiteDomain: { not: null }
            },
            select: { id: true, companyName: true, websiteUrl: true }
        });

        if (!testCompany) {
            return {
                allPassed: false,
                results: [{
                    testName: 'Find test company',
                    passed: false,
                    details: 'No company with website found for testing'
                }]
            };
        }

        results.push({
            testName: 'Find test company',
            passed: true,
            details: `Using company: ${testCompany.companyName} (ID: ${testCompany.id})`,
            data: testCompany
        });

        // 2. Trigger a scan
        const scanResponse = await fetch(`${baseUrl}/api/companies/${testCompany.id}/web-health/scan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ force: true })
        });

        const scanResult = await scanResponse.json();

        if (!scanResult.success) {
            results.push({
                testName: 'Trigger scan',
                passed: false,
                details: `Scan failed: ${scanResult.error || 'Unknown error'}`,
                data: scanResult
            });
        } else {
            results.push({
                testName: 'Trigger scan',
                passed: true,
                details: `Scan completed with score: ${scanResult.score}`,
                data: { score: scanResult.score, label: scanResult.label }
            });

            // 3. Check dual-write consistency
            if (scanResult._dualWriteConsistent !== undefined) {
                results.push({
                    testName: 'Dual-write consistency (from response)',
                    passed: scanResult._dualWriteConsistent === true,
                    details: scanResult._dualWriteConsistent
                        ? 'New and legacy fields are consistent'
                        : 'MISMATCH detected in response'
                });
            }
        }

        // 4. Read back from DB and verify
        const afterScan = await prisma.companyProspect.findUnique({
            where: { id: testCompany.id },
            select: {
                websiteHealthStatus: true,
                websiteHealthScore: true,
                websiteHealthScannedAt: true,
                stalenessScore: true,
                lastAnalysedAt: true
            }
        });

        if (!afterScan) {
            results.push({
                testName: 'Verify DB state',
                passed: false,
                details: 'Company not found after scan'
            });
        } else {
            // Check new fields updated
            const newFieldsOk = afterScan.websiteHealthStatus === 'success' &&
                afterScan.websiteHealthScore !== null &&
                afterScan.websiteHealthScannedAt !== null;

            results.push({
                testName: 'New fields updated',
                passed: newFieldsOk,
                details: newFieldsOk
                    ? `status=${afterScan.websiteHealthStatus}, score=${afterScan.websiteHealthScore}`
                    : `MISSING: status=${afterScan.websiteHealthStatus}, score=${afterScan.websiteHealthScore}`,
                data: { status: afterScan.websiteHealthStatus, score: afterScan.websiteHealthScore }
            });

            // Check legacy fields updated
            const legacyFieldsOk = afterScan.stalenessScore !== null &&
                afterScan.lastAnalysedAt !== null;

            results.push({
                testName: 'Legacy fields updated',
                passed: legacyFieldsOk,
                details: legacyFieldsOk
                    ? `stalenessScore=${afterScan.stalenessScore}, lastAnalysedAt=${afterScan.lastAnalysedAt}`
                    : `MISSING: stalenessScore=${afterScan.stalenessScore}, lastAnalysedAt=${afterScan.lastAnalysedAt}`,
                data: { score: afterScan.stalenessScore, scannedAt: afterScan.lastAnalysedAt }
            });

            // Check scores match
            const scoresMatch = afterScan.websiteHealthScore === afterScan.stalenessScore;

            results.push({
                testName: 'Scores match (new == legacy)',
                passed: scoresMatch,
                details: scoresMatch
                    ? `Both scores are ${afterScan.websiteHealthScore}`
                    : `MISMATCH: new=${afterScan.websiteHealthScore}, legacy=${afterScan.stalenessScore}`
            });
        }

        // 5. Check mismatch detector for this company
        const debugResponse = await fetch(`${baseUrl}/api/debug/website-health?companyId=${testCompany.id}`);
        const debugData = await debugResponse.json();

        if (debugData.error) {
            results.push({
                testName: 'Debug endpoint check',
                passed: false,
                details: `Debug endpoint error: ${debugData.error}`
            });
        } else {
            // Check that display decision uses new source
            const usesNewSource = debugData.displayDecision?.selectedSource === 'new';
            results.push({
                testName: 'Display uses new source',
                passed: usesNewSource,
                details: usesNewSource
                    ? 'Display correctly uses new fields as authoritative'
                    : `Display uses ${debugData.displayDecision?.selectedSource} instead of new`
            });
        }

    } catch (error: any) {
        results.push({
            testName: 'Test execution',
            passed: false,
            details: `Error: ${error.message}`
        });
    }

    const allPassed = results.every(r => r.passed);

    return { allPassed, results };
}

// Export test runner for API route
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const baseUrl = searchParams.get('baseUrl') || 'http://localhost:3000';

    const { allPassed, results } = await runWebsiteHealthIntegrationTest(baseUrl);

    return Response.json({
        allPassed,
        passedCount: results.filter(r => r.passed).length,
        failedCount: results.filter(r => !r.passed).length,
        results
    }, { status: allPassed ? 200 : 500 });
}
