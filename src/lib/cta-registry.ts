/**
 * CTA Registry - Systematic discovery of all interactive elements
 * 
 * This script scans the codebase and generates a JSON inventory of all CTAs.
 * Run with: npx ts-node src/lib/cta-registry.ts
 */

import fs from 'fs';
import path from 'path';

interface CTAEntry {
    id: string;
    label: string;
    type: 'button' | 'icon-button' | 'link' | 'row' | 'keyboard';
    file: string;
    line: number;
    handler: string | null;
    destination: string | null;
    requiredParams: string[];
    surface: string;
}

const ctaRegistry: CTAEntry[] = [];

// Define known surfaces and their files
const surfaces: Record<string, string[]> = {
    'Lead Board': [
        'src/app/(app)/leads/DashboardClient.tsx',
        'src/components/leads/LeadResultRowCard.tsx'
    ],
    'Prospect Search': [
        'src/app/(app)/prospects/page.tsx',
        'src/components/prospects/ProspectResultRowCard.tsx'
    ],
    'Company Overview Modal': [
        'src/components/modals/CompanyOverviewModal.tsx'
    ],
    'Composer Modal': [
        'src/components/messaging/MessageThreadComposerModal.tsx',
        'src/components/messaging/ComposePane.tsx',
        'src/components/messaging/AIAssistPanel.tsx'
    ],
    'Sidebar': [
        'src/components/Sidebar.tsx'
    ],
    'Inbox': [
        'src/app/(app)/conversations/page.tsx'
    ],
    'CRM Pipeline': [
        'src/app/(app)/outreach/crm/page.tsx'
    ],
    'Follow-Ups': [
        'src/app/(app)/outreach/queue/page.tsx'
    ],
    'Dashboard': [
        'src/app/(app)/dashboard/page.tsx'
    ],
    'Settings': [
        'src/app/(app)/settings/page.tsx'
    ]
};

// CTA patterns to search for
const ctaPatterns = [
    // Buttons with onClick
    { regex: /<button[^>]*onClick=\{([^}]+)\}[^>]*>([^<]*)<\/button>/g, type: 'button' as const },
    // Button components
    { regex: /<Button[^>]*onClick=\{([^}]+)\}/g, type: 'button' as const },
    // IconButton components
    { regex: /<IconButton[^>]*onClick=\{([^}]+)\}/g, type: 'icon-button' as const },
    // icon-btn class buttons
    { regex: /<button[^>]*className="[^"]*icon-btn[^"]*"[^>]*onClick=\{([^}]+)\}/g, type: 'icon-button' as const },
    // Links
    { regex: /<Link[^>]*href=\{?["'`]([^"'`]+)["'`]\}?/g, type: 'link' as const },
    // Clickable divs (row CTAs)
    { regex: /<div[^>]*onClick=\{([^}]+)\}[^>]*className="[^"]*cursor-pointer/g, type: 'row' as const }
];

// Known CTAs with expected behavior (for verification)
export const expectedCTAs = [
    // Lead Board
    { surface: 'Lead Board', cta: 'Add Lead', action: 'opens_modal', modal: 'AddLeadModal' },
    { surface: 'Lead Board', cta: 'Open', action: 'navigates', route: '/leads/[id]' },
    { surface: 'Lead Board', cta: 'Msg', action: 'opens_modal', modal: 'MessageThreadComposerModal' },
    { surface: 'Lead Board', cta: 'Thread Icon', action: 'opens_modal', modal: 'MessageThreadComposerModal', tab: 'thread' },
    { surface: 'Lead Board', cta: 'Delete Icon', action: 'opens_modal', modal: 'ConfirmDeleteModal' },
    { surface: 'Lead Board', cta: 'Company Name', action: 'opens_modal', modal: 'CompanyOverviewModal' },
    { surface: 'Lead Board', cta: 'Scan Missing', action: 'api_call', endpoint: '/api/scan/bulk' },
    { surface: 'Lead Board', cta: 'Rescan Stale', action: 'api_call', endpoint: '/api/scan/bulk' },
    { surface: 'Lead Board', cta: 'Rescan All', action: 'api_call', endpoint: '/api/leadboard/web-health/rescan' },

    // Prospect Search
    { surface: 'Prospect Search', cta: 'Search', action: 'api_call', endpoint: '/api/prospects/search' },
    { surface: 'Prospect Search', cta: 'Company Name', action: 'opens_modal', modal: 'CompanyProfilePopup' },
    { surface: 'Prospect Search', cta: 'Add to Leads', action: 'api_call', endpoint: '/api/prospects/[id]/add' },
    { surface: 'Prospect Search', cta: 'Compose', action: 'opens_modal', modal: 'MessageThreadComposerModal' },

    // Company Overview Modal
    { surface: 'Company Overview Modal', cta: 'Close', action: 'closes_modal' },
    { surface: 'Company Overview Modal', cta: 'Compose Outreach', action: 'opens_modal', modal: 'MessageThreadComposerModal' },
    { surface: 'Company Overview Modal', cta: 'Open Website', action: 'opens_url' },
    { surface: 'Company Overview Modal', cta: 'Copy Link', action: 'clipboard' },
    { surface: 'Company Overview Modal', cta: 'Add Contact', action: 'opens_modal', modal: 'AddContactModal' },

    // Composer Modal
    { surface: 'Composer Modal', cta: 'Close', action: 'closes_modal' },
    { surface: 'Composer Modal', cta: 'Tab Buttons', action: 'switches_tab' },
    { surface: 'Composer Modal', cta: 'Find Contacts', action: 'api_call', endpoint: '/api/companies/[id]/contacts/rescan' },
    { surface: 'Composer Modal', cta: 'Save Draft', action: 'api_call', endpoint: '/api/leads/[id]/save-draft' },
    { surface: 'Composer Modal', cta: 'Send', action: 'api_call', endpoint: '/api/outreach/send' },
    { surface: 'Composer Modal', cta: 'Generate AI Reply', action: 'api_call' },
    { surface: 'Composer Modal', cta: 'Insert Suggestion', action: 'inserts_text' },

    // Sidebar
    { surface: 'Sidebar', cta: 'Dashboard', action: 'navigates', route: '/dashboard' },
    { surface: 'Sidebar', cta: 'Lead Board', action: 'navigates', route: '/leads' },
    { surface: 'Sidebar', cta: 'Prospect Search', action: 'navigates', route: '/prospects' },
    { surface: 'Sidebar', cta: 'Inbox', action: 'navigates', route: '/conversations' },
    { surface: 'Sidebar', cta: 'CRM', action: 'navigates', route: '/outreach/crm' },
    { surface: 'Sidebar', cta: 'Follow-Ups', action: 'navigates', route: '/outreach/queue' },
    { surface: 'Sidebar', cta: 'Settings', action: 'navigates', route: '/settings' },
    { surface: 'Sidebar', cta: 'Sign Out', action: 'signs_out' },
    { surface: 'Sidebar', cta: 'Collapse', action: 'toggles_sidebar' }
];

// Function to generate registry report
export function generateCTAReport(): string {
    const lines: string[] = [
        '# CTA Registry Report',
        '',
        `Generated: ${new Date().toISOString()}`,
        '',
        '## Summary',
        '',
        `Total Expected CTAs: ${expectedCTAs.length}`,
        '',
        '## CTAs by Surface',
        ''
    ];

    const bySurface = expectedCTAs.reduce((acc, cta) => {
        if (!acc[cta.surface]) acc[cta.surface] = [];
        acc[cta.surface].push(cta);
        return acc;
    }, {} as Record<string, typeof expectedCTAs>);

    for (const [surface, ctas] of Object.entries(bySurface)) {
        lines.push(`### ${surface}`);
        lines.push('');
        lines.push('| CTA | Action | Target |');
        lines.push('|-----|--------|--------|');

        for (const cta of ctas) {
            const target = cta.route || cta.modal || cta.endpoint || '-';
            lines.push(`| ${cta.cta} | ${cta.action} | ${target} |`);
        }

        lines.push('');
    }

    return lines.join('\n');
}

// Export for use in tests
export { ctaRegistry, surfaces };

// CLI mode
if (require.main === module) {
    console.log(generateCTAReport());
}
