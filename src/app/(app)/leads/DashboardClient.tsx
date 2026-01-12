'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StatsCard, StatsGrid } from '@/components/ui/StatsCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchInput } from '@/components/ui/SearchInput';
import { Building2, CheckCircle, AlertCircle, PenTool } from 'lucide-react';
import { ResultsListContainer, ResultsListHeader, ResultsListEmptyState } from '@/components/ui/ResultsList';
import LeadResultRowCard from '@/components/leads/LeadResultRowCard';
import AddLeadModal from '@/components/AddLeadModal';
import OutreachComposer from '@/components/outreach/composer';
import ThreadViewer from '@/components/ThreadViewer';
import ConfirmDeleteModal from '@/components/modals/ConfirmDeleteModal';
import { ThreadEmptyModal } from '@/components/modals/ThreadEmptyModal';

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
    const [leads, setLeads] = useState(initialLeads);

    // UI State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [filter, setFilter] = useState('');
    const [sort, setSort] = useState('date');

    // Composer State
    const [composerOpen, setComposerOpen] = useState(false);
    const [composerLead, setComposerLead] = useState<any>(null);
    const [composerProspect, setComposerProspect] = useState<any>(null);

    // Thread State
    const [threadOpen, setThreadOpen] = useState(false);
    const [threadEmailId, setThreadEmailId] = useState<number | null>(null);
    const [threadEmptyOpen, setThreadEmptyOpen] = useState(false);
    const [threadEmptyLead, setThreadEmptyLead] = useState<any>(null);

    // Delete State
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deletingLead, setDeletingLead] = useState<any>(null);
    const [isDeleting, setIsDeleting] = useState(false);

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
        try {
            // Fetch prospect data if needed
            let prospect = lead.companyProspect;
            if (!prospect && lead.companyProspectId) {
                const res = await fetch(`/api/prospects/${lead.companyProspectId}`);
                if (res.ok) prospect = await res.json();
            }

            // Prepare draft data
            let initialDraft = undefined;
            if (lead.emailDraft || lead.subjectLine1) {
                initialDraft = {
                    subject: lead.subjectLine1 || '',
                    body: lead.emailDraft || '',
                    tier: lead.contactPriorityBand || 'Medium',
                    toEmail: lead.contacts?.[0]?.email
                };
            }

            setComposerLead(lead);
            setComposerProspect(prospect || {
                id: lead.companyProspectId,
                companyName: lead.companyName,
                websiteUrl: lead.websiteUrl
            });
            setComposerOpen(true);
        } catch (e) {
            console.error('Error opening composer:', e);
            showToast('Failed to open composer', 'error');
        }
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
                        setThreadEmailId(data.emailId);
                        setThreadOpen(true);
                        return;
                    }
                }

                // No thread found - show empty state
                setThreadEmptyLead(lead);
                setThreadEmptyOpen(true);
                return;
            }

            // Get the email ID from sent emails
            const emailId = lead.sentEmails?.[0]?.id;
            if (emailId) {
                setThreadEmailId(emailId);
                setThreadOpen(true);
            } else {
                // Fetch email ID from API
                const res = await fetch(`/api/leads/${lead.id}/thread`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.emailId) {
                        setThreadEmailId(data.emailId);
                        setThreadOpen(true);
                        return;
                    }
                }

                // Still no thread
                setThreadEmptyLead(lead);
                setThreadEmptyOpen(true);
            }
        } catch (e) {
            console.error('Error opening thread:', e);
            // Show empty state on error
            setThreadEmptyLead(lead);
            setThreadEmptyOpen(true);
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

            {/* Outreach Composer */}
            {composerOpen && composerLead && (
                <OutreachComposer
                    isOpen={composerOpen}
                    onClose={() => {
                        setComposerOpen(false);
                        setComposerLead(null);
                        setComposerProspect(null);
                    }}
                    prospect={composerProspect}
                    lead={composerLead}
                    initialDraft={composerLead.emailDraft ? {
                        subject: composerLead.subjectLine1 || '',
                        body: composerLead.emailDraft || '',
                        tier: 'Medium'
                    } : undefined}
                    onSendSuccess={handleSendSuccess}
                />
            )}

            {/* Thread Viewer */}
            {threadOpen && threadEmailId && (
                <ThreadViewer
                    emailId={threadEmailId}
                    onClose={() => {
                        setThreadOpen(false);
                        setThreadEmailId(null);
                    }}
                    onReplySent={() => router.refresh()}
                />
            )}

            {/* Thread Empty State */}
            <ThreadEmptyModal
                isOpen={threadEmptyOpen}
                onClose={() => {
                    setThreadEmptyOpen(false);
                    setThreadEmptyLead(null);
                }}
                companyName={threadEmptyLead?.companyName || 'Company'}
                onComposeOutreach={() => {
                    if (threadEmptyLead) {
                        handleCompose(threadEmptyLead);
                    }
                }}
            />

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
