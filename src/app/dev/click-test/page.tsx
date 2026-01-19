'use client';

import WebHealthCardContainer from '@/components/ui/WebHealthCardContainer';
import { useState } from 'react';
import GoldenTestSection from './GoldenTestSection';

// Disable static generation for this dev/test page
export const dynamic = 'force-dynamic';

export default function ClickTestPage() {
    return (
        <div className="p-10 space-y-10">
            <h1 className="text-2xl font-bold">Web Health Clickability & Forensics Test V2</h1>

            <GoldenTestSection />

            <p className="text-gray-600">
                1. Ensure Diagnostics is ON ( ?diag=1 ).<br />
                2. Hover each card. Badge should verify "TOP: BUTTON".<br />
                3. If "TOP: BLOCKED", the shield is covered.<br />
                4. Click each card. Badge "clicks" must increment AND modal must open.
            </p>

            <div className="grid grid-cols-2 gap-8 max-w-2xl">

                <Section title="Score 0 (Success)">
                    <WebHealthCardContainer companyId={999} surface="test_score_0">
                        <div className="p-4 bg-gray-100 border border-gray-300 rounded text-center">
                            Score: 0 / 100
                        </div>
                    </WebHealthCardContainer>
                </Section>

                <Section title="Not Scanned (Null)">
                    <WebHealthCardContainer companyId={888} surface="test_null">
                        <div className="p-4 bg-yellow-50 border border-yellow-300 rounded text-center text-yellow-800">
                            Not Scanned
                        </div>
                    </WebHealthCardContainer>
                </Section>

                <Section title="Scan Error">
                    <WebHealthCardContainer companyId={777} surface="test_error">
                        <div className="p-4 bg-red-50 border border-red-300 rounded text-center text-red-800">
                            Scan Failed
                        </div>
                    </WebHealthCardContainer>
                </Section>

                <Section title="Negative Test (No ID)">
                    <WebHealthCardContainer companyId={undefined} surface="test_no_id">
                        <div className="p-4 bg-gray-200 border border-gray-400 rounded text-center opacity-50">
                            No Company ID (Should not open)
                        </div>
                    </WebHealthCardContainer>
                </Section>
            </div>
        </div>
    );
}

function Section({ title, children }: { title: string, children: React.ReactNode }) {
    return (
        <div className="border p-4 rounded-lg">
            <h3 className="font-bold mb-2">{title}</h3>
            {children}
        </div>
    );
}
