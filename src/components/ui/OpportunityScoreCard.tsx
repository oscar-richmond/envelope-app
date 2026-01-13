'use client';

/**
 * Phase 6: Opportunity Score Card Component
 * Shows need/ability/confidence breakdown with action recommendation
 */

import React from 'react';

interface OpportunityScore {
    total: number;
    need: number;
    ability: number;
    confidence: number;
}

interface RecommendedAction {
    type: 'compose' | 'add_pipeline' | 'needs_review' | 'needs_contact';
    label: string;
    target?: string;
    reason: string[];
}

interface OpportunityScoreCardProps {
    score: OpportunityScore;
    action?: RecommendedAction;
    summary?: {
        contactsFound: number;
        contactsVerified: number;
        durationMs: number;
    };
    compact?: boolean;
    onActionClick?: () => void;
}

export function OpportunityScoreCard({
    score,
    action,
    summary,
    compact = false,
    onActionClick,
}: OpportunityScoreCardProps) {
    const scoreClass = score.total >= 70 ? 'score-high' : score.total >= 50 ? 'score-medium' : 'score-low';

    const scoreColors = {
        'score-high': 'bg-green-100 text-green-700',
        'score-medium': 'bg-amber-100 text-amber-700',
        'score-low': 'bg-red-100 text-red-700',
    };

    const actionColors = {
        compose: 'bg-green-100 text-green-700 border-green-200',
        add_pipeline: 'bg-blue-100 text-blue-700 border-blue-200',
        needs_review: 'bg-amber-100 text-amber-700 border-amber-200',
        needs_contact: 'bg-slate-100 text-slate-700 border-slate-200',
    };

    if (compact) {
        return (
            <div className="flex items-center gap-2">
                <span className={`px-2 py-1 text-sm font-bold rounded ${scoreColors[scoreClass]}`}>
                    {score.total}
                </span>
                {action && (
                    <span className="text-xs text-slate-500">{action.label}</span>
                )}
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-xl p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Opportunity Score
                </span>
                <span className={`text-2xl font-bold px-3 py-1 rounded-lg ${scoreColors[scoreClass]}`}>
                    {score.total}
                </span>
            </div>

            {/* Score Bars */}
            <div className="space-y-3 mb-4">
                <ScoreBar label="Need" value={score.need} max={40} />
                <ScoreBar label="Ability" value={score.ability} max={35} />
                <ScoreBar label="Confidence" value={score.confidence} max={25} />
            </div>

            {/* Action Recommendation */}
            {action && (
                <div className="pt-4 border-t border-slate-200">
                    <button
                        onClick={onActionClick}
                        className={`w-full flex items-center justify-between p-3 rounded-lg border ${actionColors[action.type]} hover:opacity-90 transition-opacity`}
                    >
                        <span className="font-semibold">{action.label}</span>
                        {action.reason?.[0] && (
                            <span className="text-xs opacity-80">{action.reason[0]}</span>
                        )}
                    </button>
                </div>
            )}

            {/* Summary */}
            {summary && (
                <div className="text-center text-xs text-slate-500 mt-3">
                    {summary.contactsFound} contacts • {summary.contactsVerified} verified • {Math.round(summary.durationMs / 1000)}s
                </div>
            )}
        </div>
    );
}

function ScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
    const percentage = Math.min((value / max) * 100, 100);

    return (
        <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 w-20">{label}</span>
            <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                />
            </div>
            <span className="text-xs text-slate-500 w-10 text-right">{value}/{max}</span>
        </div>
    );
}

// Compact version for table rows
export function OpportunityScoreBadge({ score }: { score: number }) {
    const colorClass = score >= 70
        ? 'bg-green-100 text-green-700'
        : score >= 50
            ? 'bg-amber-100 text-amber-700'
            : 'bg-red-100 text-red-700';

    return (
        <span className={`inline-flex items-center justify-center w-8 h-8 text-sm font-bold rounded-lg ${colorClass}`}>
            {score}
        </span>
    );
}
