'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { StatsCard, StatsGrid } from '@/components/ui/StatsCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchInput } from '@/components/ui/SearchInput';
import { Building2, CheckCircle, AlertCircle, PenTool } from 'lucide-react';
import { ResultsListContainer, ResultsListHeader, ResultsListEmptyState } from '@/components/ui/ResultsList';
import LeadResultRowCard from '@/components/leads/LeadResultRowCard';
import AddLeadModal from '@/components/AddLeadModal';
import { MessageThreadComposerModal } from '@/components/messaging';
import ConfirmDeleteModal from '@/components/modals/ConfirmDeleteModal';

// Toast helper (simple inline for now)
function showToast(message: string, type: 'success' | 'error' = 'success') {
    // In production, use a proper toast library
    const div = document.createElement('div');
    div.className = `fixed bottom-4 right-4 z-[100] px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-in fade-in slide-in-from-bottom-2 duration-300`;
    div.style.background = type === 'success' ? 'var(--accent-mint-bg)' : 'var(--error-light)';
    div.style.color = type === 'success' ? 'var(--accent-mint-text)' : 'var(--error-text)';
    div.style.border = type === 'success' ? '1px solid var(--chip-mint-border)' : '1px solid var(--chip-danger-border)';
    div.textContent = message;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3000);
}

// Toast with undo action
function showToastWithUndo(message: string, onUndo: () => void) {
    const div = document.createElement('div');
    div.className = `fixed bottom-4 right-4 z-[100] px-4 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300`;
    div.style.background = 'var(--accent-mint-bg)';
    div.style.color = 'var(--accent-mint-text)';
    div.style.border = '1px solid var(--chip-mint-border)';

    const textSpan = document.createElement('span');
    textSpan.textContent = message;

    const undoBtn = document.createElement('button');
    undoBtn.textContent = 'Undo';
    undoBtn.style.cssText = 'font-weight: 600; text-decoration: underline; cursor: pointer; opacity: 0.8;';
    undoBtn.onclick = () => {
        onUndo();
        div.remove();
    };

    div.appendChild(textSpan);
    div.appendChild(undoBtn);
    document.body.appendChild(div);

    // Auto-remove after 8 seconds
    setTimeout(() => div.remove(), 8000);
}

export default function DashboardClient({ leads: initialLeads }: { leads: any[] }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [leads, setLeads] = useState(initialLeads);

    // UI State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [filter, setFilter] = useState('');
    const [sort, setSort] = useState('date');

    // Composer State
    const [composerOpen, setComposerOpen] = useState(false);
    const [composerLead, setComposerLead] = useState<any>(null);
    const [composerDefaultTab, setComposerDefaultTab] = useState<'thread' | 'ai' | 'compose'>('compose');
    const [composerEmailId, setComposerEmailId] = useState<number | null>(null);

    // Delete State
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deletingLead, setDeletingLead] = useState<any>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Auto-open composer from URL params (extension flow)
    useEffect(() => {
        const leadId = searchParams.get('leadId');
        const compose = searchParams.get('compose');

        if (leadId && compose === 'true') {
            // Find the lead in our list or fetch it
            const leadIdNum = parseInt(leadId, 10);
            const lead = leads.find(l => l.id === leadIdNum);

            if (lead) {
                // Open composer for this lead
                setComposerLead(lead);
                setComposerEmailId(null);
                setComposerDefaultTab('compose');
                setComposerOpen(true);

                // Clear URL params
                router.replace('/leads', { scroll: false });
            } else {
                // Lead not in list yet - fetch it
                fetch(`/api/leads/${leadId}`)
                    .then(res => res.json())
                    .then(data => {
                        if (data && !data.error) {
                            setComposerLead(data);
                            setComposerEmailId(null);
                            setComposerDefaultTab('compose');
                            setComposerOpen(true);

                            // Add to leads list
                            setLeads(prev => [data, ...prev]);
                        }
                    })
                    .catch(console.error)
                    .finally(() => {
                        router.replace('/leads', { scroll: false });
                    });
            }
        }
    }, [searchParams, leads, router]);

    // Filtering & Sorting
    const filteredLeads = leads
        .filter(l => l.companyName.toLowerCase().includes(filter.toLowerCase()))
        .sort((a, b) => {
            if (sort === 'date') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            if (sort === 'priority') return (b.priorityScore || 0) - (a.priorityScore || 0);
            if (sort === 'health') return (b.stalenessScore || 0) - (a.stalenessScore || 0);
            return 0;
        });

    // =====================
    // CTA Handlers
    // =====================

    // COMPOSE OUTREACH
    const handleCompose = useCallback(async (lead: any) => {
        setComposerLead(lead);
        setComposerEmailId(null);
        setComposerDefaultTab('compose');
        setComposerOpen(true);
    }, []);

    // VIEW THREAD
    const handleViewThread = useCallback(async (lead: any) => {
        try {
            // Check if lead has sent emails
            const hasEmails = lead.sentEmails?.length > 0 ||
                lead.emailStatus === 'SENT' ||
                lead.emailStatus === 'REPLIED';

            if (!hasEmails) {
                // Try to find sent email from API
                const res = await fetch(`/api/leads/${lead.id}/thread`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.emailId) {
                        setComposerEmailId(data.emailId);
                        setComposerLead(lead);
                        setComposerDefaultTab('thread');
                        setComposerOpen(true);
                        return;
                    }
                }

                // No thread found - open compose tab instead
                setComposerLead(lead);
                setComposerEmailId(null);
                setComposerDefaultTab('compose');
                setComposerOpen(true);
                return;
            }

            // Get the email ID from sent emails
            const emailId = lead.sentEmails?.[0]?.id;
            if (emailId) {
                setComposerEmailId(emailId);
                setComposerLead(lead);
                setComposerDefaultTab('thread');
                setComposerOpen(true);
            } else {
                // Fetch email ID from API
                const res = await fetch(`/api/leads/${lead.id}/thread`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.emailId) {
                        setComposerEmailId(data.emailId);
                        setComposerLead(lead);
                        setComposerDefaultTab('thread');
                        setComposerOpen(true);
                        return;
                    }
                }

                // Still no thread - open compose tab
                setComposerLead(lead);
                setComposerEmailId(null);
                setComposerDefaultTab('compose');
                setComposerOpen(true);
            }
        } catch (e) {
            console.error('Error opening thread:', e);
            // Open compose tab on error
            setComposerLead(lead);
            setComposerEmailId(null);
            setComposerDefaultTab('compose');
            setComposerOpen(true);
        }
    }, []);

    // DELETE LEAD
    const handleDeleteClick = useCallback((lead: any) => {
        setDeletingLead(lead);
        setDeleteModalOpen(true);
    }, []);

    const handleDeleteConfirm = useCallback(async () => {
        if (!deletingLead) return;

        setIsDeleting(true);

        // Optimistic update
        const leadId = deletingLead.id;
        const previousLeads = [...leads];
        const removedLead = leads.find(l => l.id === leadId);
        setLeads(leads.filter(l => l.id !== leadId));
        setDeleteModalOpen(false);

        try {
            const res = await fetch(`/api/leads/${leadId}`, { method: 'DELETE' });
            const data = await res.json();

            if (!res.ok) {
                // Revert on failure
                setLeads(previousLeads);

                // Show specific error messages
                if (res.status === 404) {
                    showToast('Lead not found. Please refresh the page.', 'error');
                } else if (res.status === 401 || res.status === 403) {
                    showToast('Session expired. Please sign in again.', 'error');
                } else {
                    showToast(`Couldn't remove lead: ${data.error || 'Please try again'}`, 'error');
                    console.error('[Lead Delete]', { leadId, status: res.status, error: data });
                }
            } else {
                // Show success toast with undo option
                showToastWithUndo('Lead removed', async () => {
                    // Undo: restore the lead
                    try {
                        await fetch(`/api/leads/${leadId}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ archivedAt: null })
                        });
                        setLeads(prev => [removedLead, ...prev]);
                        showToast('Lead restored');
                    } catch (e) {
                        showToast('Failed to restore lead', 'error');
                    }
                });
            }
        } catch (e: any) {
            // Revert on error
            setLeads(previousLeads);
            showToast("Network error. Please check your connection.", 'error');
            console.error('[Lead Delete Network Error]', { leadId, error: e.message });
        } finally {
            setIsDeleting(false);
            setDeletingLead(null);
        }
    }, [deletingLead, leads]);

    // RESCAN LEAD SIGNALS
    const handleRescan = useCallback(async (lead: any, type: 'website' | 'financial' | 'both') => {
        try {
            if (type === 'website' || type === 'both') {
                await fetch('/api/scan/website', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        companyProspectId: lead.companyProspectId,
                        leadId: lead.id
                    })
                });
            }

            if (type === 'financial' || type === 'both') {
                await fetch('/api/scan/financials', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        companyProspectId: lead.companyProspectId,
                        leadId: lead.id
                    })
                });
            }

            // Refresh to get updated scores
            const res = await fetch('/api/leads');
            if (res.ok) {
                const updatedLeads = await res.json();
                setLeads(updatedLeads);
            }

            showToast(`Scan completed for ${lead.companyName}`);
        } catch (e) {
            console.error('Scan error:', e);
            showToast('Scan failed. Please try again.', 'error');
        }
    }, []);

    const handleSendSuccess = useCallback(() => {
        // Refresh leads list after sending
        router.refresh();
        showToast('Email sent successfully!');
    }, [router]);

    return (
        <div className="p-8 max-w-[1600px] mx-auto">
            <PageHeader
                title="Lead Board"
                subtitle="Manage and analyze your prospecting pipeline"
                actions={
                    <>
                        <SearchInput
                            value={filter}
                            onChange={setFilter}
                            placeholder="Filter companies..."
                        />
                        <button
                            onClick={() => setIsAddModalOpen(true)}
                            className="btn btn-primary"
                        >
                            Add Lead
                        </button>
                    </>
                }
            />

            {/* Overview Stats */}
            <div className="mb-8">
                <StatsGrid>
                    <StatsCard
                        label="Total Leads"
                        value={leads.length}
                        variant="lilac"
                        icon={<Building2 size={20} />}
                    />
                    <StatsCard
                        label="Analyzed"
                        value={leads.filter(l => l.lastAnalyzedAt).length}
                        variant="mint"
                        icon={<CheckCircle size={20} />}
                    />
                    <StatsCard
                        label="High Priority"
                        value={leads.filter(l => l.stalenessScore > 70).length}
                        variant="warning"
                        icon={<AlertCircle size={20} />}
                    />
                    <StatsCard
                        label="Drafted"
                        value={leads.filter(l => l.emailStatus === 'DRAFTED').length}
                        variant="neutral"
                        icon={<PenTool size={20} />}
                    />
                </StatsGrid>
            </div>

            <ResultsListContainer>
                <ResultsListHeader
                    columns={[
                        { label: 'Company & Status', sortable: true, sortKey: 'name' },
                        { label: 'Signals (Score)', sortable: true, sortKey: 'priority' },
                        { label: 'Actions (Control)' }
                    ]}
                    currentSort={sort}
                    onSort={setSort}
                    totalCount={filteredLeads.length}
                />

                {filteredLeads.length > 0 ? (
                    filteredLeads.map((lead, i) => (
                        <LeadResultRowCard
                            key={lead.id}
                            index={i}
                            lead={lead}
                            onCompose={() => handleCompose(lead)}
                            onViewThread={() => handleViewThread(lead)}
                            onDelete={() => handleDeleteClick(lead)}
                            onRescan={(type) => handleRescan(lead, type)}
                        />
                    ))
                ) : (
                    <ResultsListEmptyState
                        title="No leads found"
                        description="Try adjusting your filters or add a new lead manually."
                        action={
                            <button
                                onClick={() => setIsAddModalOpen(true)}
                                className="font-medium text-sm hover:underline"
                                style={{ color: 'var(--accent-blue)' }}
                            >
                                Add Manual Lead
                            </button>
                        }
                    />
                )}
            </ResultsListContainer>

            {/* Modals */}
            <AddLeadModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />

            {/* Unified Message/Thread Modal */}
            {composerOpen && composerLead && (
                <MessageThreadComposerModal
                    emailId={composerEmailId ?? undefined}
                    leadId={composerLead.id}
                    initialData={{
                        companyName: composerLead.companyName,
                        contactName: composerLead.contacts?.[0]?.firstName,
                        contactEmail: composerLead.contacts?.[0]?.email,
                        lead: composerLead
                    }}
                    defaultTab={composerDefaultTab}
                    onClose={() => {
                        setComposerOpen(false);
                        setComposerLead(null);
                        setComposerEmailId(null);
                    }}
                    onSuccess={handleSendSuccess}
                />
            )}

            {/* Delete Confirmation */}
            <ConfirmDeleteModal
                isOpen={deleteModalOpen}
                onClose={() => {
                    setDeleteModalOpen(false);
                    setDeletingLead(null);
                }}
                onConfirm={handleDeleteConfirm}
                companyName={deletingLead?.companyName || 'this lead'}
                isDeleting={isDeleting}
            />
        </div>
    );
}
