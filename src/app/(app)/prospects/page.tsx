'use client';

import { Suspense, useState, useEffect, useRef, useMemo, useCallback } from 'react';
export const dynamic = 'force-dynamic';
import { Search, Filter, RefreshCw, ChevronDown, Check, X, AlertCircle, Building2, MapPin, Globe, ArrowRight, Lock, Target, Send, PenTool, Plus, Database, Mail, Info, HelpCircle, Users, Copy } from 'lucide-react';
import { useRouter } from 'next/navigation';

import ExplainButton from '@/components/ExplainButton';
import IndustrySelect from '@/components/industry-select';
import OutreachComposer from '@/components/outreach/composer';
import { MessageThreadComposerModal } from '@/components/messaging/MessageThreadComposerModal';
import ContactsCard from '@/components/company-hq/ContactsCard';
import { CompanyNameLink } from '@/components/company/CompanyNameLink';
import { StatsCard, StatsGrid } from '@/components/ui/StatsCard';
import { PageHeader } from '@/components/ui/PageHeader';
import ProspectResultRowCard from '@/components/prospects/ProspectResultRowCard';
import MultiSelect from '@/components/ui/MultiSelect';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { useCompanyOverviewModal } from '@/components/modals/CompanyOverviewModalProvider';
import RescanDropdown, { type RescanScope, type RescanTypes } from '@/components/leads/RescanDropdown';

export default function ProspectSearch() {
    const router = useRouter();
    const { openCompanyOverview } = useCompanyOverviewModal();
    const [filters, setFilters] = useState<{
        industry: string[];
        size: string[];
        location: string;
        ageRange: string[];
        websiteRequired: boolean;
        onlyOutdated: boolean;
        minFinancialScore: string;
        registeredRecently: string;
        query: string;
    }>({
        industry: [],
        size: [],
        location: 'London',
        ageRange: [],
        websiteRequired: false,
        onlyOutdated: false,
        minFinancialScore: '',
        registeredRecently: '',
        query: ''
    });
    const [results, setResults] = useState<any[]>([]);
    const [stats, setStats] = useState<{
        highOpportunity: number;
        likelyOutdated: number;
        strongFinancials: number;
        withContacts: number;
    } | null>(null);
    const [loading, setLoading] = useState(false);
    const [statusMap, setStatusMap] = useState<Record<string, string>>({});

    // Preset and bulk selection state
    const [activePreset, setActivePreset] = useState<'newly_registered' | null>(null);
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set()); // companyNumber set
    const [bulkAddLoading, setBulkAddLoading] = useState(false);
    const [viewEvidence, setViewEvidence] = useState<any>(null);
    const [viewLocation, setViewLocation] = useState<string | null>(null);
    const [viewLowPriorityConfirm, setViewLowPriorityConfirm] = useState<any>(null); // Reused for all soft-gating warnings
    const [viewFinancials, setViewFinancials] = useState<any>(null);
    const [viewPriority, setViewPriority] = useState<any>(null);
    const [viewWebsiteHealth, setViewWebsiteHealth] = useState<any>(null);

    // --- Draft Action ---
    const [viewDraft, setViewDraft] = useState<any | null>(null);
    const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
    const [isSending, setIsSending] = useState(false);

    // --- Bulk Scan State ---
    const [bulkScanning, setBulkScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState<{ current: number; total: number } | undefined>();

    // Compute staleness counts for rescan dropdown
    const stalenessCounts = useMemo(() => {
        let missingCount = 0;
        let staleCount = 0;

        for (const c of results) {
            // Consider missing if no staleness score or no financial score
            const isWebMissing = c.stalenessScore === undefined || c.stalenessScore === null;
            const isFinMissing = !c.financialActivityScore && c.financialActivityBand === 'Unknown';
            if (isWebMissing || isFinMissing) missingCount++;

            // Consider stale if scanned more than 7 days ago (or flag set)
            const webLastScanned = c.lastAnalysedAt ? new Date(c.lastAnalysedAt) : null;
            const finLastScanned = c.financialLastCheckedAt ? new Date(c.financialLastCheckedAt) : null;
            const now = new Date();
            const staleThresholdMs = 7 * 24 * 60 * 60 * 1000; // 7 days

            const isWebStale = webLastScanned && (now.getTime() - webLastScanned.getTime() > staleThresholdMs);
            const isFinStale = finLastScanned && (now.getTime() - finLastScanned.getTime() > staleThresholdMs);
            if (isWebStale || isFinStale) staleCount++;
        }

        return { missingCount, staleCount };
    }, [results]);

    // Unified Bulk Scan Handler (matches Lead Board exactly)
    const handleUnifiedBulkScan = useCallback(async (scope: RescanScope, types: RescanTypes) => {
        if (bulkScanning) return;

        // Get company IDs that have been saved (have an id)
        const validResults = results.filter(c => c.id);
        if (validResults.length === 0) {
            alert('No saved companies to scan. Add companies as leads first or run an initial scan.');
            return;
        }

        setBulkScanning(true);
        setScanProgress({ current: 0, total: validResults.length });

        try {
            const typeParam = types === 'web' ? 'website' : types === 'fin' ? 'financial' : 'both';

            // Use prospects-specific bulk scan endpoint
            const res = await fetch('/api/scan/prospects-bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    companyIds: validResults.map(c => c.id),
                    type: typeParam,
                    mode: scope === 'missing' ? 'missing' : scope === 'stale' ? 'stale' : 'force'
                })
            });

            const data = await res.json();

            if (res.ok) {
                // Update results in-place with new scan data
                if (data.results && Array.isArray(data.results)) {
                    setResults(prev => prev.map(p => {
                        const updated = data.results.find((r: any) => r.id === p.id);
                        if (updated) {
                            return { ...p, ...updated };
                        }
                        return p;
                    }));
                }
                alert(`Scan complete: ${data.completed || 0} updated, ${data.skipped || 0} skipped`);
            } else {
                alert('Scan failed: ' + (data.error || 'Unknown error'));
            }
        } catch (e: any) {
            console.error('[BulkScan] Error:', e);
            alert('Scan failed: ' + e.message);
        } finally {
            setBulkScanning(false);
            setScanProgress(undefined);
        }
    }, [results, bulkScanning]);

    const handleGenerateDraft = async (c: any, emailOverride?: string) => {
        setIsGeneratingDraft(true);
        try {
            const res = await fetch(`/api/prospects/${c.id}/draft`, { method: 'POST' });
            if (!res.ok) {
                const err = await res.json();
                alert(err.error || "Failed to generate draft");
                return;
            }
            const data = await res.json();
            setViewDraft({
                prospect: c,
                leadId: data.leadId,
                draft: data.draft,
                editedSubject: data.draft.subject,
                editedBody: data.draft.body,
                toEmail: emailOverride || "" // User must input
            });
        } catch (e) {
            console.error(e);
            alert("Error creating draft");
        } finally {
            setIsGeneratingDraft(false);
        }
    };

    const handleSendDraft = async () => {
        if (!viewDraft || !viewDraft.toEmail) {
            alert("Please enter a recipient email");
            return;
        }
        setIsSending(true);
        try {
            const res = await fetch('/api/outreach/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    leadId: viewDraft.leadId,
                    to: viewDraft.toEmail,
                    subject: viewDraft.editedSubject,
                    message: viewDraft.editedBody
                })
            });
            if (res.ok) {
                alert("Email sent successfully!");
                setViewDraft(null);
            } else {
                alert("Failed to send email");
            }
        } catch (e) {
            console.error(e);
            alert("Error sending email");
        } finally {
            setIsSending(false);
        }
    };

    const extractCity = (addr: string) => {
        if (!addr) return '';
        const parts = addr.split(',').map(s => s.trim());
        const filtered = parts.filter(p => !/^(United Kingdom|England|Wales|Scotland|Great Britain|UK)$/i.test(p) && !/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(p));
        return filtered.length > 0 ? filtered[filtered.length - 1] : parts[0];
    };

    const [hasSearched, setHasSearched] = useState(false);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setResults([]);
        setStats(null); // Clear stats while loading
        setHasSearched(false);
        try {
            const res = await fetch('/api/prospects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(filters)
            });
            if (res.ok) {
                const data = await res.json();
                // Handle new response structure { results, total, stats }
                const resultsArray = data.results || data; // Backwards compat
                const statsData = data.stats || null;
                setResults(resultsArray);
                setStats(statsData);
                setHasSearched(true);
                autoAnalyzeWebsites(resultsArray);
                autoAnalyzeFinancials(resultsArray);
            } else {
                const txt = await res.text();
                alert(`Search Failed: ${res.status} ${res.statusText}\n${txt}`);
            }
        } catch (e: any) {
            console.error(e);
            alert("Network Error: " + e.message);
        }
        finally { setLoading(false); }
    };

    // Apply a preset filter configuration
    const applyPreset = (preset: 'newly_registered' | null) => {
        if (preset === 'newly_registered') {
            setFilters(prev => ({
                ...prev,
                registeredRecently: '30d',
                websiteRequired: false // Include companies without websites
            }));
            setActivePreset('newly_registered');
        } else {
            // Clear preset
            setActivePreset(null);
        }
    };

    // Toggle row selection
    const toggleRowSelection = (companyNumber: string) => {
        setSelectedRows(prev => {
            const next = new Set(prev);
            if (next.has(companyNumber)) {
                next.delete(companyNumber);
            } else {
                next.add(companyNumber);
            }
            return next;
        });
    };

    // Select/deselect all visible rows
    const toggleSelectAll = () => {
        if (selectedRows.size === results.length) {
            setSelectedRows(new Set());
        } else {
            setSelectedRows(new Set(results.map(r => r.companyNumber)));
        }
    };

    // Bulk add selected companies to lead board
    const handleBulkAdd = async () => {
        if (selectedRows.size === 0) return;

        setBulkAddLoading(true);
        let added = 0;
        let skipped = 0;
        let failed = 0;

        const selectedCompanies = results.filter(r => selectedRows.has(r.companyNumber));

        for (const company of selectedCompanies) {
            try {
                const res = await fetch('/api/leads', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        companyName: company.companyName,
                        websiteUrl: company.websiteUrl || null,
                        industry: company.industry,
                        location: company.registeredLocation || company.location,
                        companyProspectId: company.id
                    })
                });

                if (res.ok) {
                    added++;
                    // Update status map for this company
                    const idx = results.findIndex(r => r.companyNumber === company.companyNumber);
                    if (idx >= 0) {
                        setStatusMap(prev => ({ ...prev, [idx]: 'ADDED' }));
                    }
                } else if (res.status === 409) {
                    skipped++; // Already exists
                } else {
                    failed++;
                }
            } catch (e) {
                failed++;
            }
        }

        setBulkAddLoading(false);
        setSelectedRows(new Set()); // Clear selection

        // Show summary toast
        const message = `Added ${added} to Lead Board` +
            (skipped > 0 ? `, ${skipped} already existed` : '') +
            (failed > 0 ? `, ${failed} failed` : '');
        alert(message); // TODO: Replace with toast
    };

    const handleAction = async (company: any, index: number, action: 'ADD' | 'REJECT') => {
        try {
            // Optimistic update using index to ensure uniqueness
            const newStatus = action === 'ADD' ? 'ADDED' : 'REJECTED';
            setStatusMap(prev => ({ ...prev, [index]: newStatus }));

            const fallbackUrl = `https://google.com/search?q=${encodeURIComponent(company.companyName + ' ' + (company.location || 'UK'))}`;

            const res = await fetch('/api/leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    companyName: company.companyName,
                    websiteUrl: company.websiteUrl || fallbackUrl,
                    industry: company.industry,
                    location: company.location || extractCity(company.registeredLocation),
                    companyProspectId: company.id, // Link the prospect ID
                    companyNumber: company.companyNumber,
                    source: 'companies_house',
                    action: action
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "API Failed");
            }

        } catch (e: any) {
            console.error(e);
            alert(`Action failed: ${e.message}`);
            // Revert on fail
            setStatusMap(prev => {
                const copy = { ...prev };
                delete copy[index];
                return copy;
            });
        }
    };

    const [matching, setMatching] = useState<Record<number, boolean>>({});

    const [matchingMap, setMatchingMap] = useState<Record<number, boolean>>({});

    const handleMatch = async (company: any, index: number) => {
        setMatchingMap(prev => ({ ...prev, [index]: true }));
        try {
            // Step 1: Ensure prospect is saved (UPSERT)
            let id = company.id;
            if (!id) {
                const saveRes = await fetch('/api/prospects', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(company)
                });

                if (!saveRes.ok) {
                    const err = await saveRes.json();
                    throw new Error(`Save failed: ${err.error || saveRes.statusText}`);
                }

                const saved = await saveRes.json();
                id = saved.id;

                if (!id) throw new Error("Saved prospect returned no ID");
            }

            // Step 2: Call Sync Match Endpoint
            if (!id) throw new Error("Invalid ID for matching");

            const res = await fetch(`/api/prospects/${id}/match-website`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ force: true })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Matching failed');

            // Step 3: Update Row
            if (data.prospect) {
                setResults(prev => {
                    const next = [...prev];
                    next[index] = { ...next[index], ...data.prospect };
                    return next;
                });
            }
        } catch (e: any) {
            console.error("Match failed", e);
            alert(`Match failed: ${e.message}`);
        } finally {
            setMatchingMap(prev => ({ ...prev, [index]: false }));
        }
    };

    // Auto-match removed per requirements.

    const renderMatchState = (c: any, index: number) => {
        const status = c.websiteMatchStatus || 'NEW';
        const isMatching = matchingMap[index];

        if (isMatching) return <span className="text-xs animate-pulse font-medium" style={{ color: 'var(--brand)' }}>Searching...</span>;

        if (status === 'MATCHED' || (status === 'NEW' && c.websiteUrl)) {
            return (
                <div className="flex flex-col gap-1.5 relative group/web">
                    <a href={c.websiteUrl} target="_blank" className="text-sm font-medium truncate max-w-[180px] block transition-colors" style={{ color: 'var(--brand)' }} onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'} onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}>
                        {c.websiteUrl.replace(/^https?:\/\/(www\.)?/, '')}
                    </a>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wide
                        ${c.websiteConfidence === 'HIGH' ? 'bg-green-50 text-green-700 border border-green-100' :
                                c.websiteConfidence === 'MEDIUM' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                                    c.websiteConfidence === 'LOW' ? 'bg-red-50 text-red-700 border border-red-100' :
                                        'bg-gray-50 text-gray-500 border border-gray-200'}`}>
                            {c.websiteConfidence || 'Unknown'} Match
                        </span>
                        {c.websiteMatchEvidence && (
                            <ExplainButton
                                onClick={() => setViewEvidence(JSON.parse(c.websiteMatchEvidence))}
                                title="See evidence for this match"
                            />
                        )}
                    </div>
                    {renderStaleness(c)}
                </div>
            );
        }

        if (status === 'NOT_FOUND' || status === 'FAILED') {
            return (
                <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-xs italic">{status === 'FAILED' ? 'Search Failed' : 'No Match Found'}</span>
                    <button onClick={() => handleMatch(c, index)} className="text-xs transition-colors" style={{ color: 'var(--brand)' }} onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'} onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}>Retry</button>
                </div>
            );
        }

        return (
            <button onClick={() => handleMatch(c, index)} className="btn btn-secondary btn-sm">
                Find Website
            </button>
        );
    };
    const handleReanalyze = async (company: any, id: number) => {
        if (!confirm(`Re-scan website health for ${company.companyName}?`)) return;

        // Debug trace
        if (process.env.NEXT_PUBLIC_DEBUG_HEALTH === '1') {
            console.log('[WEB_HEALTH_UI]', {
                event: 'SCAN_START',
                companyId: id,
                companyName: company.companyName
            });
        }

        try {
            // Use shared scan client
            const { scanWebsiteHealth, getErrorMessage } = await import('@/lib/websiteHealth/scanClient');

            const result = await scanWebsiteHealth({
                companyId: id,
                surface: 'search',
                force: true
            });

            // Debug trace response
            if (process.env.NEXT_PUBLIC_DEBUG_HEALTH === '1') {
                console.log('[WEB_HEALTH_UI]', {
                    event: 'SCAN_RESPONSE',
                    companyId: id,
                    status: result.status,
                    updatedCompanyHealth: result.updatedCompanyHealth
                });
            }

            // Update local state immediately
            if (result.updatedCompanyHealth) {
                setResults(prev => prev.map(p => {
                    if (p.id === id) {
                        return {
                            ...p,
                            ...result.updatedCompanyHealth
                        };
                    }
                    return p;
                }));
            }

            const displayScore = result.websiteHealthScore ?? 'N/A';
            const displayLabel = result.websiteHealthLabel ?? '';
            alert(`Website Health scan complete!\nScore: ${displayScore} - ${displayLabel}`);

        } catch (error: any) {
            // Show specific error message based on error code
            const { getErrorMessage } = await import('@/lib/websiteHealth/scanClient');
            const message = getErrorMessage(error);

            console.error('Website scan error:', error);
            alert(`Scan failed: ${message}`);
        }
    };

    // Original auto-analyze below...
    const autoAnalyzeFinancials = async (companies: any[]) => {
        // Filter those needing analysis (no score or old)
        const ids = companies.filter(c => !c.financialLastCheckedAt).map(c => c.id);
        if (ids.length === 0) return;

        try {
            const res = await fetch('/api/prospects/financials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prospectIds: ids })
            });
            const data = await res.json();
            if (data.results) {
                setResults(prev => prev.map(p => {
                    const r = data.results.find((res: any) => res.id === p.id);
                    if (r && r.status === 'ANALYSED') {
                        return {
                            ...p,
                            financialActivityScore: r.score,
                            financialActivityBand: r.band,
                            financialSignals: JSON.stringify(r.signals),
                            financialLastCheckedAt: new Date().toISOString()
                        };
                    }
                    return p;
                }));
            }
        } catch (e) { console.error("Financial analysis failed", e); }
    };

    const autoAnalyzeWebsites = async (companies: any[]) => {
        const idsToAnalyze = companies
            .filter(c => c.websiteUrl && !c.lastAnalysedAt)
            .map(c => c.id);

        if (idsToAnalyze.length === 0) return;

        try {
            const res = await fetch('/api/prospects/analyze', {
                method: 'POST',
                body: JSON.stringify({ prospectIds: idsToAnalyze })
            });
            const data = await res.json();

            if (data.results) {
                setResults(prev => prev.map(p => {
                    const result = data.results.find((r: any) => r.id === p.id);
                    if (result && result.status === 'ANALYSED') {
                        return { ...p, stalenessScore: result.score, scoreReasons: result.scoreReasons || p.scoreReasons, lastAnalysedAt: new Date().toISOString() };
                    }
                    return p;
                }));
            }
        } catch (e) {
            console.error("Auto-analyze failed", e);
        }
    };

    const handleCheckFinancials = async (company: any, index: number) => {
        if (!company) return;

        // Optimistic Loading
        setStatusMap(prev => ({ ...prev, [`fin-${index}`]: 'LOADING' }));

        try {
            // 1. Ensure Saved
            let id = company.id;
            if (!id) {
                const saveRes = await fetch('/api/prospects', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(company)
                });

                if (!saveRes.ok) {
                    const err = await saveRes.json();
                    throw new Error(err.details || err.error || "Failed to save prospect");
                }

                const saved = await saveRes.json();
                id = saved.id;

                if (!id) throw new Error("Saved prospect has no ID");
            }

            // 2. Analyze
            const res = await fetch('/api/prospects/financials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prospectIds: [id], force: true })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.details || data.error || "Analysis failed");

            // 3. Update Result
            if (data.results && data.results.length > 0) {
                const r = data.results[0];
                if (r && r.status === 'ANALYSED') {
                    setResults(prev => {
                        const next = [...prev];
                        next[index] = {
                            ...next[index],
                            id,
                            financialActivityScore: r.score,
                            financialActivityBand: r.band,
                            financialSignals: JSON.stringify(r.signals),
                            financialLastCheckedAt: new Date().toISOString()
                        };
                        return next;
                    });
                } else {
                    alert(`Analysis returned status: ${r?.status || 'Unknown'}`);
                }
            } else {
                throw new Error("No results returned from analysis");
            }
        } catch (e: any) {
            console.error(e);
            alert(`Financial check failed: ${e.message}`);
        }
        finally {
            setStatusMap(prev => ({ ...prev, [`fin-${index}`]: '' }));
        }
    };

    const renderStaleness = (c: any) => {
        // Only show staleness if it's explicitly analyzed.
        // If not, show "Analyze" button or nothing? 
        // The previous UI showed "Not analyzed" which is clutter. Let's hide it unless there's data.
        if (!c.websiteUrl) return null;
        if (c.stalenessScore === undefined || c.stalenessScore === null) return null;

        const score = c.stalenessScore;
        let badgeClass = 'bg-gray-50 text-gray-500 border-gray-200';
        let label = 'Low Priority';

        if (score >= 60) { badgeClass = 'bg-rose-50 text-rose-700 border-rose-100'; label = 'High Priority'; }
        else if (score >= 30) { badgeClass = 'bg-amber-50 text-amber-700 border-amber-100'; label = 'Design Opp'; }

        return (
            <div className="mt-1.5 flex items-center gap-2 w-full">
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold border ${badgeClass} whitespace-nowrap`}>
                    {label} ({score})
                </span>

                <div className="flex items-center gap-2 opacity-0 group-hover/web:opacity-100 transition-opacity ml-auto">
                    <button
                        onClick={() => handleReanalyze(c, c.id)}
                        className="text-[10px] p-1 rounded transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--brand)'; e.currentTarget.style.background = 'var(--brand-soft)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                        title="Refresh Analysis"
                    >
                        <RefreshCw size={12} />
                    </button>
                    {c.scoreReasons && (
                        <ExplainButton
                            onClick={() => setViewWebsiteHealth(c)}
                            title="See website health breakdown"
                        />
                    )}
                </div>
            </div>
        );
    };



    // Lead Gating Helper
    const checkAddLead = (c: any, index: number) => {
        // Safe Parse Signals
        let signals: any = {};
        try {
            if (typeof c.financialSignals === 'string') {
                signals = JSON.parse(c.financialSignals);
            } else if (typeof c.financialSignals === 'object') {
                signals = c.financialSignals;
            }
        } catch (e) { console.warn("Signal parse error", e); }

        // Rule A: Hard Dormant (Company Status is NOT active)
        // CANONICAL CHECK: Only block if status is explicitly NOT active.
        const isHardDormant = signals.status && signals.status !== 'active' && signals.status !== 'unknown';

        // Rule B: Dormant Accounts (Active company, but filed dormant accounts)
        // Soft Warning: Status is active, but accounts type implies dormant filing.
        const isAccountsDormant = !isHardDormant && (
            signals.hasDormantAccounts ||
            (signals.accountsType && signals.accountsType.includes('dormant'))
        );

        // Other Flags
        const isFinLow = c.financialActivityBand === 'Low';
        const isWebLow = c.websiteConfidence === 'LOW' && c.websiteMatchStatus === 'MATCHED';
        const isPriorityLow = c.contactPriorityBand === 'Low';

        // Check for any warnings
        if (isHardDormant || isAccountsDormant || isFinLow || isWebLow || isPriorityLow) {
            setViewLowPriorityConfirm({
                prospect: c,
                index,
                reasons: {
                    isHardDormant,
                    isAccountsDormant,
                    isFinLow,
                    isWebLow,
                    isPriorityLow
                }
            });
        } else {
            // Clean green light
            handleAction(c, index, 'ADD');
        }
    };





    // --- Inspect Handler (saves prospect first if needed) ---
    const handleInspect = async (company: any, index: number) => {
        // If the company already has a database ID, just open the modal
        if (company.id) {
            openCompanyOverview({ prospectId: company.id });
            return;
        }

        // Otherwise, save the prospect first to get an ID
        try {
            const saveRes = await fetch('/api/prospects', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(company)
            });

            if (!saveRes.ok) {
                const err = await saveRes.json();
                throw new Error(`Save failed: ${err.error || saveRes.statusText}`);
            }

            const saved = await saveRes.json();
            const id = saved.id;

            if (!id) throw new Error("Saved prospect returned no ID");

            // Update the results array with the new ID so future actions work
            setResults(prev => {
                const next = [...prev];
                next[index] = { ...next[index], id };
                return next;
            });

            // Now open the modal with the saved ID
            openCompanyOverview({ prospectId: id });
        } catch (e: any) {
            console.error("Inspect failed:", e);
            alert(`Failed to load company profile: ${e.message}`);
        }
    };

    // --- Email Discovery ---
    const [viewEmails, setViewEmails] = useState<any | null>(null);
    const [emailResults, setEmailResults] = useState<any[]>([]);
    const [isDiscovering, setIsDiscovering] = useState(false);

    const handleOpenDiscovery = (c: any) => {
        setViewEmails(c);
        setEmailResults([]); // Clear previous
        // Optionally auto-trigger? Let's make it manual per req.
    };

    const runDiscovery = async () => {
        if (!viewEmails) return;
        setIsDiscovering(true);
        try {
            // 1. Ensure Saved
            let id = viewEmails.id;
            if (!id) {
                const saveRes = await fetch('/api/prospects', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(viewEmails)
                });
                if (!saveRes.ok) throw new Error("Failed to save prospect record");
                const saved = await saveRes.json();
                id = saved.id;

                // Update local state so we have the ID for future
                setViewEmails((prev: any) => ({ ...prev, id }));
                // Also update the main list
                setResults(prev => prev.map(p => p.companyNumber === viewEmails.companyNumber ? { ...p, id } : p));
            }

            if (!id) throw new Error("Missing ID after save attempt");

            const res = await fetch(`/api/prospects/${id}/emails/find`, { method: 'POST' });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Discovery failed");
            }
            const data = await res.json();
            setEmailResults(data.emails || []);
        } catch (e: any) {
            console.error(e);
            alert(`Discovery failed: ${e.message}`);
        } finally {
            setIsDiscovering(false);
        }
    };

    const handleUseEmail = (email: string) => {
        // Open Draft with this email
        // We need to trigger draft generation logic first OR just open compser?
        // Let's trigger draft generation but override the email.
        const c = viewEmails;
        setViewEmails(null);

        // Check if draft already exists?
        // For simplicity, we just trigger handleGenerateDraft but pass the email override.
        // We modify handleGenerateDraft to accept an override or set a temporary state.

        // Better: Just open Draft modal manually with pre-fill? 
        // But we need the AI draft content.
        // So let's call API draft, then open modal with email.

        handleGenerateDraft(c, email);
    };

    return (
        <div className="p-4 md:p-8 w-full max-w-[1920px] mx-auto">
            {/* Contacts Discovery Modal — uses shared ContactsCard component */}
            {viewEmails && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setViewEmails(null)}>
                    <div
                        className="bg-white rounded-xl max-w-xl w-full max-h-[80vh] overflow-hidden shadow-xl"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex justify-between items-center px-5 py-3 border-b border-gray-100">
                            <h3 className="text-base font-semibold text-gray-900">
                                {viewEmails.companyName || 'Company'} — Contacts
                            </h3>
                            <button
                                onClick={() => setViewEmails(null)}
                                className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                            >
                                <X size={18} className="text-gray-400" />
                            </button>
                        </div>
                        {/* ContactsCard — single source of truth */}
                        <div className="max-h-[65vh] overflow-y-auto">
                            <ContactsCard
                                prospectId={viewEmails.id}
                                companyName={viewEmails.companyName}
                                onSelectEmail={(email) => {
                                    handleUseEmail(email);
                                    setViewEmails(null);
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}
            {/* Location Modal */}
            {viewLocation && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setViewLocation(null)}>
                    <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <MapPin size={18} className="text-gray-500" />
                                Full Address
                            </h3>
                            <button onClick={() => setViewLocation(null)} className="p-1 hover:bg-gray-100 rounded"><X size={20} /></button>
                        </div>
                        <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{viewLocation}</p>
                    </div>
                </div>
            )}

            {/* Financial Modal */}
            {viewFinancials && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setViewFinancials(null)}>
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4 border-b pb-3">
                            <h3 className="text-lg font-bold flex items-center gap-2 text-gray-900">
                                <Building2 size={18} className="text-gray-500" />
                                Financial Activity
                            </h3>
                            <button onClick={() => setViewFinancials(null)} className="p-1 hover:bg-gray-100 rounded"><X size={20} /></button>
                        </div>

                        <div className="mb-6 flex items-center justify-between bg-gray-50 p-4 rounded-lg">
                            <div>
                                <div className="text-xs text-gray-500 uppercase font-bold tracking-wide">Overall Score</div>
                                <div className="text-3xl font-bold text-gray-900 mt-1">{viewFinancials.financialActivityScore}<span className="text-sm text-gray-400 font-medium">/100</span></div>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-sm font-bold 
                                ${viewFinancials.financialActivityBand === 'Very Strong' ? 'bg-emerald-100 text-emerald-800' :
                                    viewFinancials.financialActivityBand === 'Strong' ? 'bg-green-100 text-green-800' :
                                        viewFinancials.financialActivityBand === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                                            'bg-gray-100 text-gray-600'}`}>
                                {viewFinancials.financialActivityBand}
                            </div>
                        </div>

                        <div className="space-y-3">
                            {viewFinancials.financialSignals ? (() => {
                                try {
                                    const sigs = JSON.parse(viewFinancials.financialSignals);
                                    return (
                                        <>
                                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Score Breakdown</h4>
                                            <div className="space-y-2">
                                                {sigs.details && sigs.details.map((d: string, i: number) => (
                                                    <div key={i} className="flex items-start gap-2 text-sm text-gray-700 bg-white border border-gray-100 p-2 rounded">
                                                        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${d.includes('+0') ? 'bg-red-400' : 'bg-green-500'}`} />
                                                        {d}
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="mt-4 pt-4 border-t text-xs text-gray-400 italic">
                                                Based on Companies House filings. Not a credit rating.
                                            </div>
                                        </>
                                    );
                                } catch (e) { return <span className="text-red-500">Error parsing details</span>; }
                            })() : <p className="text-gray-500">No details available.</p>}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Logic (Existing) */}
            {viewEvidence && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setViewEvidence(null)}>
                    <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold">Analysis Evidence</h3>
                            <button onClick={() => setViewEvidence(null)}><X size={20} /></button>
                        </div>
                        {Array.isArray(viewEvidence) ? (
                            <div className="space-y-4">
                                <div>
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Content & Activity Signals</h4>
                                    <ul className="list-disc pl-5 space-y-1">
                                        {viewEvidence.filter(r => r.match(/blog|sitemap|copyright|content update/i)).map((r: string, i: number) => (
                                            <li key={i} className="text-sm text-gray-700">{r}</li>
                                        ))}
                                        {viewEvidence.filter(r => r.match(/blog|sitemap|copyright|content update/i)).length === 0 && (
                                            <li className="text-sm text-gray-400 italic">No strong content signals recorded.</li>
                                        )}
                                    </ul>
                                </div>
                                <div className="border-t pt-4">
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Design & Technical Opportunities</h4>
                                    <ul className="list-disc pl-5 space-y-1">
                                        {viewEvidence.filter(r => !r.match(/blog|sitemap|copyright|Assumed Fresh|content update/i)).map((r: string, i: number) => (
                                            <li key={i} className="text-sm text-gray-700">{r}</li>
                                        ))}
                                        {viewEvidence.filter(r => !r.match(/blog|sitemap|copyright|Assumed Fresh|content update/i)).length === 0 && (
                                            <li className="text-sm text-gray-400 italic">No specific design issues detected.</li>
                                        )}
                                    </ul>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                                {Object.entries(viewEvidence).map(([key, value]) => {
                                    if (key === 'geometry' || key === 'opening_hours' || key === 'photos' || key === 'address_components') return null; // Skip complex/noisy fields

                                    return (
                                        <div key={key} className="flex flex-col sm:flex-row border-b border-gray-100 last:border-0 p-3 text-sm">
                                            <span className="font-semibold text-gray-600 sm:w-1/3 capitalize">
                                                {key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}
                                            </span>
                                            <span className="text-gray-900 sm:w-2/3 break-all sm:break-words mt-1 sm:mt-0 font-mono text-xs sm:text-sm">
                                                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ... Filters ... */}

            <PageHeader
                title="Prospect Search"
                subtitle="Search Companies House for new prospects"
            />

            {/* Bulk Action Bar - appears when rows are selected */}
            {selectedRows.size > 0 && (
                <div
                    className="flex items-center gap-4 px-4 py-3 mb-4 rounded-[var(--radius-lg)] border border-[var(--border-default)]"
                    style={{ background: 'linear-gradient(135deg, rgba(84,130,237,0.08), rgba(84,130,237,0.04))' }}
                >
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={selectedRows.size === results.length && results.length > 0}
                            onChange={toggleSelectAll}
                            className="w-4 h-4 rounded border-[var(--border-default)]"
                        />
                        <span className="text-sm font-semibold text-[var(--text-primary)]">
                            {selectedRows.size} selected
                        </span>
                    </div>

                    <div className="h-5 w-px bg-[var(--border-soft)]" />

                    <button
                        onClick={handleBulkAdd}
                        disabled={bulkAddLoading}
                        className="px-4 py-1.5 rounded-[var(--radius-button)] text-sm font-semibold bg-[var(--brand)] text-white hover:opacity-90 disabled:opacity-50 transition-all"
                    >
                        {bulkAddLoading ? 'Adding...' : `+ Add ${selectedRows.size} to Lead Board`}
                    </button>

                    <button
                        onClick={() => setSelectedRows(new Set())}
                        className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                    >
                        Clear
                    </button>
                </div>
            )}

            {/* Dashboard Overview Cards */}
            <StatsGrid>
                <StatsCard
                    label="Prospects Found"
                    value={loading ? '—' : results.length}
                    icon={<Building2 size={20} />}
                    variant="lilac"
                />
                <StatsCard
                    label="Strong Financials"
                    value={loading ? '—' : (stats?.strongFinancials ?? results.filter(r => (r.financialActivityScore >= 75) || r.financialActivityBand === 'Strong' || r.financialActivityBand === 'Very Strong').length)}
                    icon={<Target size={20} />}
                    variant="mint"
                />
                <StatsCard
                    label="High Opportunity"
                    value={loading ? '—' : (stats?.highOpportunity ?? results.filter(r => r.contactPriorityBand === 'High' || (r.contactPriorityScore && r.contactPriorityScore >= 70)).length)}
                    icon={<Globe size={20} />}
                    variant="neutral"
                />
                <StatsCard
                    label="Likely Outdated"
                    value={loading ? '—' : (stats?.likelyOutdated ?? results.filter(r => r.stalenessScore >= 60).length)}
                    icon={<AlertCircle size={20} />}
                    variant="warning"
                />
            </StatsGrid>

            {/* Rescan Controls - only show when there are results */}
            {results.length > 0 && (
                <div className="flex justify-end mb-4">
                    <RescanDropdown
                        totalCount={results.filter(c => c.id).length}
                        missingCount={stalenessCounts.missingCount}
                        staleCount={stalenessCounts.staleCount}
                        onScan={handleUnifiedBulkScan}
                        isScanning={bulkScanning}
                        progress={scanProgress}
                    />
                </div>
            )}

            {/* Search Filters */}
            <form onSubmit={handleSearch} className="card p-6 mb-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Row 1: Primary Filters */}
                    <div>
                        <label className="label">Company Name</label>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="e.g. Tesla"
                                className="input !pl-11"
                                value={filters.query}
                                onChange={(e) => setFilters({ ...filters, query: e.target.value })}
                            />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        </div>
                    </div>

                    <div>
                        <IndustrySelect
                            selected={Array.isArray(filters.industry) ? filters.industry : (filters.industry ? [filters.industry] : [])}
                            onChange={(vals) => setFilters({ ...filters, industry: vals })}
                        />
                    </div>

                    <div>
                        <MultiSelect
                            label="Company Size"
                            options={[
                                { value: '1-10', label: '1-10 employees' },
                                { value: '11-50', label: '11-50 employees' },
                                { value: '51-200', label: '51-200 employees' },
                                { value: '201-500', label: '201-500 employees' }
                            ]}
                            selected={filters.size}
                            onChange={(vals) => setFilters({ ...filters, size: vals })}
                            placeholder="Any size"
                        />
                    </div>

                    <div>
                        <label className="label">Location</label>
                        <input
                            type="text"
                            placeholder="e.g. London"
                            className="input w-full"
                            value={filters.location}
                            onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                        />
                        <p className="helper-text mt-1">Region or City (UK)</p>
                    </div>

                    {/* Row 2: Age & Website Signals */}
                    <div>
                        <MultiSelect
                            label="Company Age"
                            options={[
                                { value: '2-5', label: '2-5 years' },
                                { value: '5-10', label: '5-10 years (Legacy)' },
                                { value: '10+', label: '10+ years' }
                            ]}
                            selected={filters.ageRange}
                            onChange={(vals) => setFilters({ ...filters, ageRange: vals })}
                            placeholder="Any age"
                        />
                    </div>

                    <div>
                        <label className="label flex items-center gap-1.5">
                            Min. Stability
                            <InfoTooltip
                                title="Min. Stability"
                                body="Sets the minimum operational/financial stability score required. Increase this to prioritise more established businesses."
                            />
                        </label>
                        <select
                            className="input w-full bg-white"
                            value={(filters as any).minFinancialScore || ''}
                            onChange={(e) => setFilters({ ...filters, minFinancialScore: e.target.value } as any)}
                        >
                            <option value="">Any</option>
                            <option value="Strong">Strong+</option>
                            <option value="Medium">Medium+</option>
                        </select>
                    </div>

                    <div>
                        <label className="label flex items-center gap-1.5">
                            Registered Recently
                            <InfoTooltip
                                title="Registered Recently"
                                body="Filter companies by how recently they were incorporated (e.g. last week, month, 3 months). Useful for targeting newly formed companies that may need a website."
                            />
                        </label>
                        <select
                            className="input w-full bg-white"
                            value={filters.registeredRecently}
                            onChange={(e) => setFilters({ ...filters, registeredRecently: e.target.value })}
                        >
                            <option value="">Any</option>
                            <option value="7d">Last week</option>
                            <option value="14d">Last fortnight</option>
                            <option value="30d">Last month</option>
                            <option value="2m">Last 2 months</option>
                            <option value="3m">Last 3 months</option>
                            <option value="4m">Last 4 months</option>
                            <option value="5m">Last 5 months</option>
                            <option value="6m">Last 6 months</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-6 pt-7 flex-wrap">
                        {/* Must have website filter */}
                        <label className="flex items-center gap-2.5 cursor-pointer group whitespace-nowrap">
                            <input
                                type="checkbox"
                                className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 shrink-0"
                                checked={filters.websiteRequired}
                                onChange={(e) => setFilters({ ...filters, websiteRequired: e.target.checked })}
                            />
                            <span className="text-sm text-gray-700 font-medium group-hover:text-gray-900 transition-colors">
                                Must have website
                            </span>
                        </label>

                        {/* Likely Outdated filter */}
                        <label className="flex items-center gap-2.5 cursor-pointer group whitespace-nowrap">
                            <input
                                type="checkbox"
                                className="w-4 h-4 text-rose-600 rounded border-gray-300 focus:ring-rose-500 shrink-0"
                                checked={filters.onlyOutdated}
                                onChange={(e) => setFilters({ ...filters, onlyOutdated: e.target.checked })}
                            />
                            <span className="text-sm text-gray-700 font-medium group-hover:text-gray-900 transition-colors">
                                Likely outdated
                            </span>
                            <span className="text-xs text-gray-400">
                                Score ≥ 60
                            </span>
                        </label>
                    </div>

                    <div className="flex items-end">
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn btn-primary w-full justify-center shadow-lg shadow-indigo-200/50"
                        >
                            <Search size={18} />
                            {loading ? 'Searching...' : 'Find Companies'}
                        </button>
                    </div>
                </div>
            </form>

            {/* Results List */}
            {hasSearched && results.length === 0 && (
                <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
                    <div className="text-gray-400 mb-2">
                        <Search size={32} className="mx-auto" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">No prospects found</h3>
                    <p className="text-gray-500 max-w-sm mx-auto mt-1">
                        Try adjusting your filters (e.g. broader age range) or search for a different company name.
                    </p>
                </div>
            )}

            {results.length > 0 ? (
                <div className="space-y-4">
                    {/* Header Label (Optional, maybe just count) */}
                    <div className="flex justify-between items-center px-1">
                        <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{results.length} Prospects Found</span>
                        {/* Sort dropdown could go here */}
                    </div>

                    {results.map((c, i) => {
                        const status = statusMap[i]; // Use index for status lookup
                        if (status === 'REJECTED') return null; // Hide rejected

                        const isLoadingFin = statusMap[`fin-${i}`] === 'LOADING';
                        const isMatchLoading = matchingMap[i];

                        // Calculate days since incorporation for badge
                        const daysSinceInc = c.incorporatedOn
                            ? Math.floor((Date.now() - new Date(c.incorporatedOn).getTime()) / (1000 * 60 * 60 * 24))
                            : null;
                        const showRegisteredBadge = (activePreset === 'newly_registered' || (daysSinceInc !== null && daysSinceInc <= 30));

                        return (
                            <div key={c.companyNumber || i} className="flex items-start gap-3">
                                {/* Selection Checkbox */}
                                <div className="pt-5 flex-shrink-0">
                                    <input
                                        type="checkbox"
                                        checked={selectedRows.has(c.companyNumber)}
                                        onChange={() => toggleRowSelection(c.companyNumber)}
                                        className="w-4 h-4 rounded border-[var(--border-default)] cursor-pointer"
                                    />
                                </div>

                                {/* Row Content */}
                                <div className="flex-1 relative">
                                    {/* Registered Recently Badge */}
                                    {showRegisteredBadge && daysSinceInc !== null && (
                                        <div className="absolute -top-1 left-3 z-10">
                                            <span className="px-2 py-0.5 bg-[rgba(166,244,179,0.15)] text-[var(--accent-mint-text)] text-[10px] font-bold rounded-full border border-[rgba(166,244,179,0.3)]">
                                                🆕 Registered {daysSinceInc} days ago
                                            </span>
                                        </div>
                                    )}

                                    <ProspectResultRowCard
                                        index={i}
                                        company={c}
                                        status={status}

                                        // Action Handlers
                                        onAction={(act) => handleAction(c, i, act)}
                                        onCheckAddLead={() => checkAddLead(c, i)}
                                        onFindEmails={() => handleOpenDiscovery(c)}
                                        onDraftEmail={() => handleGenerateDraft(c)}
                                        onViewLocation={() => setViewLocation(c.location)}
                                        onInspect={() => handleInspect(c, i)}

                                        // Evidence Handlers
                                        onMatchEvidence={() => setViewEvidence(JSON.parse(c.websiteMatchEvidence || '{}'))}
                                        onFinancialEvidence={() => setViewFinancials(c)}
                                        onPriorityEvidence={() => setViewPriority(c)}
                                        onWebsiteHealthEvidence={() => setViewWebsiteHealth(c)}

                                        // Logic Triggers
                                        onFindWebsite={() => handleMatch(c, i)}
                                        onCheckFinancials={() => handleCheckFinancials(c, i)}
                                        onRefreshAnalysis={() => handleReanalyze(c, c.id)}

                                        // State
                                        isFinancialLoading={isLoadingFin}
                                        isMatchLoading={isMatchLoading}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : !hasSearched ? (
                <div className="text-center py-16 text-gray-500 bg-white rounded-xl border border-dashed border-gray-300">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Building2 className="h-8 w-8 text-gray-300" />
                    </div>
                    <h3 className="text-base font-semibold text-gray-900">No prospects to show</h3>
                    <p className="mt-1 text-sm text-gray-500">Get started by searching for companies above.</p>
                </div>
            ) : null}
            {
                viewFinancials && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setViewFinancials(null)}>
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
                            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                <div>
                                    <h3 className="font-semibold text-gray-900">Financial Evidence</h3>
                                    <div className="text-xs text-gray-500">{viewFinancials.companyName} ({viewFinancials.companyNumber})</div>
                                </div>
                                <button onClick={() => setViewFinancials(null)} className="text-gray-400 hover:text-gray-600">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <div className="text-sm text-gray-500 uppercase tracking-wider font-semibold">Financial Health</div>
                                        <div className={`text-2xl font-bold mt-1
                                        ${viewFinancials.financialActivityBand === 'Very Strong' ? 'text-emerald-700' :
                                                viewFinancials.financialActivityBand === 'Strong' ? 'text-green-700' :
                                                    viewFinancials.financialActivityBand === 'Medium' ? 'text-yellow-700' :
                                                        'text-gray-700'}`}>
                                            {viewFinancials.financialActivityBand}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-3xl font-black text-gray-900">{viewFinancials.financialActivityScore}</div>
                                        <div className="text-xs text-gray-400 font-medium">/ 100</div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {(() => {
                                        let signals: any = {};
                                        try {
                                            signals = typeof viewFinancials.financialSignals === 'string'
                                                ? JSON.parse(viewFinancials.financialSignals)
                                                : viewFinancials.financialSignals || {};
                                        } catch (e) {
                                            console.error("Failed to parse signals", e);
                                        }

                                        const breakdown = signals.breakdown || [];
                                        const legacyDetails = signals.details || [];

                                        if (breakdown.length > 0) {
                                            return breakdown.map((item: any, idx: number) => (
                                                <div key={idx} className="flex items-start gap-3">
                                                    <div className={`mt-1 w-2 h-2 rounded-full shrink-0 
                                                    ${item.points > 10 ? 'bg-green-500' : item.points > 0 ? 'bg-yellow-500' : 'bg-gray-300'}`}
                                                    />
                                                    <div className="flex-1">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-sm font-medium text-gray-900">{item.label}</span>
                                                            <span className="text-xs font-mono font-bold text-gray-500">+{item.points}</span>
                                                        </div>
                                                        <p className="text-xs text-gray-600 mt-0.5">{item.text}</p>
                                                    </div>
                                                </div>
                                            ));
                                        } else if (legacyDetails.length > 0) {
                                            return legacyDetails.map((d: string, idx: number) => (
                                                <div key={idx} className="text-sm text-gray-600 py-1 border-b border-gray-50 last:border-0">
                                                    {d}
                                                </div>
                                            ));
                                        } else {
                                            return <div className="text-sm text-gray-400 italic">No detailed evidence available.</div>;
                                        }
                                    })()}
                                </div>

                                <div className="mt-6 pt-4 border-t border-gray-100 flex justify-between items-center text-xs text-gray-400">
                                    <span>Last checked: {viewFinancials.financialLastCheckedAt ? new Date(viewFinancials.financialLastCheckedAt).toLocaleDateString() : 'Just now'}</span>
                                    <button
                                        onClick={() => {
                                            handleCheckFinancials(viewFinancials, results.findIndex(r => r.id === viewFinancials.id));
                                            setViewFinancials(null);
                                        }}
                                        className="text-blue-600 hover:underline"
                                    >
                                        Refresh Analysis
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
            {
                viewPriority && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setViewPriority(null)}>
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
                            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                <h3 className="font-semibold text-gray-900">Priority Breakdown</h3>
                                <button onClick={() => setViewPriority(null)} className="text-gray-400 hover:text-gray-600">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                                    <span className="text-lg font-bold text-gray-700">Total Score</span>
                                    <div className="text-right">
                                        <div className="text-3xl font-black text-purple-600">{viewPriority.contactPriorityScore}</div>
                                        <div className="text-xs text-purple-400 font-bold">{viewPriority.contactPriorityBand}</div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {/* Need Score */}
                                    <div className="flex justify-between items-center text-sm border-l-2 border-purple-500 pl-3">
                                        <div className="flex flex-col">
                                            <span className="text-gray-700 font-bold">Need Score (0-60)</span>
                                            <span className="text-xs text-gray-500">Based on staleness & design opps</span>
                                        </div>
                                        <div className="font-mono font-bold flex flex-col items-end">
                                            <span className="text-base text-gray-900">
                                                {(() => {
                                                    const staleness = viewPriority.stalenessScore || 0;
                                                    const opp = staleness >= 40;
                                                    const conf = (viewPriority.websiteConfidence || 'LOW').toUpperCase();
                                                    let score = Math.min(60, staleness);
                                                    if (opp) score += 10;
                                                    score = Math.min(60, score);
                                                    if (conf === 'LOW') score = Math.min(30, score);
                                                    return score;
                                                })()}
                                            </span>
                                            <span className="text-[10px] text-gray-400">
                                                {viewPriority.stalenessScore || 0} base {(viewPriority.stalenessScore || 0) >= 40 ? '+ 10 opp' : ''}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Ability Score */}
                                    <div className="flex justify-between items-center text-sm border-l-2 border-green-500 pl-3">
                                        <div className="flex flex-col">
                                            <span className="text-gray-700 font-bold">Ability Score (0-30)</span>
                                            <span className="text-xs text-gray-500">Based on financial strength (30%)</span>
                                        </div>
                                        <div className="font-mono font-bold text-gray-900 text-base">
                                            {Math.round((viewPriority.financialActivityScore || 0) * 0.3)}
                                        </div>
                                    </div>

                                    {/* Confidence Score */}
                                    <div className="flex justify-between items-center text-sm border-l-2 border-blue-500 pl-3">
                                        <div className="flex flex-col">
                                            <span className="text-gray-700 font-bold">Confidence Score (0-10)</span>
                                            <span className="text-xs text-gray-500">Based on website match quality</span>
                                        </div>
                                        <div className="font-mono font-bold text-gray-900 text-base">
                                            {(() => {
                                                const conf = (viewPriority.websiteConfidence || 'LOW').toUpperCase();
                                                if (conf === 'HIGH') return 10;
                                                if (conf === 'MEDIUM') return 6;
                                                return 0;
                                            })()}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-600">Financial Activity</span>
                                    <div className="font-mono font-medium">
                                        {viewPriority.financialActivityScore || 0} <span className="text-gray-400 text-xs">x 0.4</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-blue-50 p-3 rounded text-xs text-blue-700 mt-2">
                                {(() => {
                                    const score = viewPriority.stalenessScore || 0;
                                    const conf = (viewPriority.websiteConfidence || 'LOW').toUpperCase();
                                    const effective = score > 0 ? score : (['MEDIUM', 'HIGH'].includes(conf) ? 25 : 0);
                                    if (effective === 25 && score === 0) {
                                        return <strong>No urgent design issues, but site is suitable for improvement (Effective Score: 25). </strong>;
                                    }
                                })()}
                                Priority determines if this prospect is worth contacting.
                                <br />High (70+), Medium (40-69), Low (&lt;40).
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Website Health Modal */}
            {
                viewWebsiteHealth && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setViewWebsiteHealth(null)}>
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
                            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-blue-50">
                                <div>
                                    <h3 className="font-semibold text-gray-900">Website Review</h3>
                                    <div className="text-xs text-gray-500">{viewWebsiteHealth.companyName}</div>
                                </div>
                                <button onClick={() => setViewWebsiteHealth(null)} className="text-gray-400 hover:text-gray-600">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                {/* Score Section */}
                                <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                                    <span className="text-lg font-bold text-gray-700">Website Health</span>
                                    <div className="text-right">
                                        {viewWebsiteHealth.websiteHealthStatus === 'success' && typeof viewWebsiteHealth.websiteHealthScore === 'number' ? (
                                            <>
                                                <div className="text-3xl font-black text-blue-600">{viewWebsiteHealth.websiteHealthScore}</div>
                                                <div className="text-xs text-blue-400 font-bold">{viewWebsiteHealth.websiteHealthLabel || 'Unknown'}</div>
                                            </>
                                        ) : viewWebsiteHealth.websiteHealthStatus === 'error' && viewWebsiteHealth.websiteHealthError === 'NO_WEBSITE_URL' ? (
                                            <div className="text-sm text-gray-500">No website URL</div>
                                        ) : viewWebsiteHealth.websiteHealthStatus === 'error' ? (
                                            <div className="text-sm text-red-500">Scan failed</div>
                                        ) : (
                                            <div className="text-sm text-gray-500">Not scanned</div>
                                        )}
                                    </div>
                                </div>

                                {/* Breakdown Section */}
                                <div className="space-y-3">
                                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Signals Detected</div>
                                    {(() => {
                                        let signals: string[] = [];
                                        try {
                                            if (viewWebsiteHealth.scoreReasons) {
                                                signals = JSON.parse(viewWebsiteHealth.scoreReasons);
                                            }
                                        } catch (e) { }

                                        if (!Array.isArray(signals) || signals.length === 0) {
                                            return <p className="text-sm text-gray-400 italic">No detailed signals recorded</p>;
                                        }

                                        // Categorize signals
                                        const contentSignals = signals.filter(s => s.match(/blog|content|copyright|update/i));
                                        const techSignals = signals.filter(s => s.match(/sitemap|generator|https|ssl|viewport/i));
                                        const designSignals = signals.filter(s => s.match(/mobile|responsive|design|ui/i));
                                        const otherSignals = signals.filter(s => !s.match(/blog|content|copyright|update|sitemap|generator|https|ssl|viewport|mobile|responsive|design|ui/i));

                                        return (
                                            <div className="space-y-3">
                                                {contentSignals.length > 0 && (
                                                    <div>
                                                        <div className="text-[10px] font-medium text-gray-400 uppercase mb-1">Content Freshness</div>
                                                        {contentSignals.map((s, i) => (
                                                            <div key={i} className="flex items-center justify-between text-xs py-1 border-l-2 border-green-400 pl-2 mb-1">
                                                                <span className="text-gray-600">{s}</span>
                                                                <span className="text-green-600 font-medium">+{10 + i * 5}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                {techSignals.length > 0 && (
                                                    <div>
                                                        <div className="text-[10px] font-medium text-gray-400 uppercase mb-1">Technical</div>
                                                        {techSignals.map((s, i) => (
                                                            <div key={i} className="flex items-center justify-between text-xs py-1 border-l-2 border-blue-400 pl-2 mb-1">
                                                                <span className="text-gray-600">{s}</span>
                                                                <span className="text-blue-600 font-medium">+{5 + i * 5}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                {designSignals.length > 0 && (
                                                    <div>
                                                        <div className="text-[10px] font-medium text-gray-400 uppercase mb-1">Design</div>
                                                        {designSignals.map((s, i) => (
                                                            <div key={i} className="flex items-center justify-between text-xs py-1 border-l-2 border-purple-400 pl-2 mb-1">
                                                                <span className="text-gray-600">{s}</span>
                                                                <span className="text-purple-600 font-medium">+{10 + i * 5}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                {otherSignals.length > 0 && (
                                                    <div>
                                                        <div className="text-[10px] font-medium text-gray-400 uppercase mb-1">Other</div>
                                                        {otherSignals.map((s, i) => (
                                                            <div key={i} className="flex items-center justify-between text-xs py-1 border-l-2 border-gray-300 pl-2 mb-1">
                                                                <span className="text-gray-600">{s}</span>
                                                                <span className="text-gray-500 font-medium">+5</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>

                                {/* Explanation */}
                                <div className="text-xs text-gray-400 pt-3 border-t border-gray-100">
                                    Website Health measures how outdated a company's website appears.
                                    <br />Higher scores indicate more opportunity for redesign services.
                                </div>

                                {/* Refresh Button - Bottom Right */}
                                <div className="flex justify-end pt-4 border-t border-gray-100 mt-4">
                                    <button
                                        onClick={async () => {
                                            if (!viewWebsiteHealth?.id) return;

                                            const buttonEl = document.activeElement as HTMLButtonElement;
                                            if (buttonEl) buttonEl.disabled = true;

                                            try {
                                                const res = await fetch('/api/scan/website', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({
                                                        companyId: viewWebsiteHealth.id,
                                                        surface: 'search',
                                                        force: true
                                                    })
                                                });

                                                if (res.ok) {
                                                    const data = await res.json();
                                                    console.log('Refresh response:', data);

                                                    if (data.updatedCompanyHealth) {
                                                        // Update modal data with canonical fields
                                                        setViewWebsiteHealth(prev => {
                                                            if (!prev) return null;
                                                            return {
                                                                ...prev,
                                                                websiteHealthStatus: data.updatedCompanyHealth.websiteHealthStatus,
                                                                websiteHealthScore: data.updatedCompanyHealth.websiteHealthScore,
                                                                websiteHealthLabel: data.updatedCompanyHealth.websiteHealthLabel,
                                                                websiteHealthError: data.updatedCompanyHealth.websiteHealthError,
                                                                websiteHealthScannedAt: data.updatedCompanyHealth.websiteHealthScannedAt,
                                                                // Also update legacy fields for backward compat
                                                                stalenessScore: data.updatedCompanyHealth.websiteHealthScore,
                                                                lastAnalysedAt: data.updatedCompanyHealth.websiteHealthScannedAt
                                                            };
                                                        });

                                                        // Update list
                                                        setResults(prev => prev.map(p =>
                                                            p.id === viewWebsiteHealth.id
                                                                ? { ...p, ...data.updatedCompanyHealth }
                                                                : p
                                                        ));

                                                        alert('Refresh complete!');
                                                    }
                                                } else {
                                                    alert('Refresh failed: ' + res.statusText);
                                                }
                                            } catch (e: any) {
                                                console.error('Refresh error:', e);
                                                alert('Refresh failed: ' + e.message);
                                            } finally {
                                                if (buttonEl) buttonEl.disabled = false;
                                            }
                                        }}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        <span>Refresh Analysis</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Warning / Confirmation Modal */}
            {
                viewLowPriorityConfirm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setViewLowPriorityConfirm(null)}>
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
                            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-amber-50">
                                <h3 className="font-semibold text-amber-900 flex items-center gap-2">
                                    <span className="bg-amber-100 p-1 rounded-full"><Target size={14} className="text-amber-600" /></span>
                                    Quality Warning
                                </h3>
                                <button onClick={() => setViewLowPriorityConfirm(null)} className="text-gray-400 hover:text-gray-600">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-6">
                                <p className="text-gray-900 font-medium mb-2">This prospect has some quality flags:</p>
                                <ul className="space-y-2 mb-6">
                                    {viewLowPriorityConfirm.reasons?.isHardDormant && (
                                        <li className="flex gap-2 text-sm text-red-700 bg-red-50 p-2 rounded">
                                            <Lock size={16} className="shrink-0 mt-0.5" />
                                            <span><strong>Dormant/Inactive:</strong> Company status is not active according to Companies House.</span>
                                        </li>
                                    )}
                                    {viewLowPriorityConfirm.reasons?.isAccountsDormant && (
                                        <li className="flex gap-2 text-sm text-amber-700 bg-amber-50 p-2 rounded">
                                            <Lock size={16} className="shrink-0 mt-0.5" />
                                            <span><strong>Dormant accounts filed:</strong> Company status remains active.</span>
                                        </li>
                                    )}
                                    {viewLowPriorityConfirm.reasons?.isFinLow && (
                                        <li className="flex gap-2 text-sm text-red-700 bg-red-50 p-2 rounded">
                                            <Building2 size={16} className="shrink-0 mt-0.5" />
                                            <span><strong>Weak Financials:</strong> Stability score is Low.</span>
                                        </li>
                                    )}
                                    {viewLowPriorityConfirm.reasons?.isWebLow && (
                                        <li className="flex gap-2 text-sm text-orange-700 bg-orange-50 p-2 rounded">
                                            <Search size={16} className="shrink-0 mt-0.5" />
                                            <span><strong>Low Confidence Website:</strong> The matched website might be incorrect.</span>
                                        </li>
                                    )}
                                    {viewLowPriorityConfirm.reasons?.isPriorityLow &&
                                        !viewLowPriorityConfirm.reasons?.isHardDormant &&
                                        !viewLowPriorityConfirm.reasons?.isAccountsDormant &&
                                        !viewLowPriorityConfirm.reasons?.isFinLow &&
                                        !viewLowPriorityConfirm.reasons?.isWebLow && (
                                            <li className="flex gap-2 text-sm text-gray-700 bg-gray-50 p-2 rounded">
                                                <Target size={16} className="shrink-0 mt-0.5" />
                                                <span><strong>Low Priority:</strong> No urgent design issues found.</span>
                                            </li>
                                        )}
                                </ul>

                                <p className="text-gray-500 text-xs mb-6">
                                    Proceeding may result in lower response rates or incorrect contact data.
                                </p>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setViewLowPriorityConfirm(null)}
                                        className="flex-1 px-4 py-2 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition text-sm"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => {
                                            handleAction(viewLowPriorityConfirm.prospect, viewLowPriorityConfirm.index, 'ADD');
                                            setViewLowPriorityConfirm(null);
                                        }}
                                        className="flex-1 px-4 py-2 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 transition text-sm shadow-sm"
                                    >
                                        Proceed Anyway
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* --- Unified Composer Modal (with AI features) --- */}
            {viewDraft && (
                <MessageThreadComposerModal
                    prospectId={viewDraft.prospect?.id}
                    initialData={{
                        companyName: viewDraft.prospect?.companyName || viewDraft.prospect?.brandNameOverride || viewDraft.prospect?.websiteBrandName,
                        contactEmail: viewDraft.toEmail,
                        lead: {
                            id: viewDraft.leadId,
                            companyProspectId: viewDraft.prospect?.id,
                            emailDraft: viewDraft.draft?.body,
                            emailDraftHtml: viewDraft.draft?.body,
                            subjectLine1: viewDraft.draft?.subject
                        },
                        prospect: viewDraft.prospect
                    }}
                    defaultTab="compose"
                    onClose={() => setViewDraft(null)}
                    onSuccess={() => {
                        setViewDraft(null);
                    }}
                />
            )}

        </div>
    );
}
