
import { NextResponse } from 'next/server';
import { runFinancialHealthScan } from '@/lib/financials/runFinancialScan';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { prospectIds, force } = body;

        if (!Array.isArray(prospectIds)) {
            return NextResponse.json(
                { error: 'prospectIds must be an array' },
                { status: 400 }
            );
        }

        const results = [];
        console.log(`[FinancialsAPI] Processing ${prospectIds.length} prospects...`);

        for (const id of prospectIds) {
            try {
                // Use canonical runner
                const result = await runFinancialHealthScan({
                    companyId: id,
                    initiatedFrom: 'api',
                    force: force
                });

                if (result.status === 'success') {
                    results.push({
                        id,
                        status: 'ANALYSED',
                        score: result.receipt.computed.score,
                        band: result.receipt.computed.band,
                        signals: result.receipt.computed.signals,
                        receipt: result.receipt
                    });
                } else {
                    results.push({
                        id,
                        status: 'FAILED',
                        reason: result.error
                    });
                }
            } catch (e: any) {
                console.error(`Financial scan failed for ${id}:`, e);
                results.push({ id, status: 'FAILED', reason: e.message });
            }
        }

        return NextResponse.json({ results });

    } catch (error: any) {
        console.error("API Error:", error);
        return NextResponse.json(
            { error: 'Internal Server Error', details: error.message },
            { status: 500 }
        );
    }
}
