import { redirect } from 'next/navigation';

/**
 * Conversations page has been consolidated into Sales Pipeline (/outreach/deals)
 * This redirect ensures any old bookmarks or links still work
 */
export default function ConversationsPage() {
    redirect('/outreach/deals');
}
