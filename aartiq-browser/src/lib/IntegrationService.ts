/**
 * Mock Integration Service for GitHub and Google Workspace
 * In a real-world scenario, this would handle OAuth flows and actual API calls.
 */

export interface MailItem {
    id: string;
    subject: string;
    sender: string;
    snippet: string;
    date: string;
    isUnread: boolean;
    tag?: string; // AI Assigned tag
}

export interface DriveFile {
    id: string;
    name: string;
    type: 'doc' | 'sheet' | 'slide' | 'folder';
    owner: string;
    lastModified: string;
}

export const IntegrationService = {
    // --- Google Workspace Selectors/Simulation ---

    async fetchMails(token: string): Promise<MailItem[]> {
        // Simulate network delay
        await new Promise(r => setTimeout(r, 1500));

        const mockMails: MailItem[] = [
            { id: '1', subject: 'Project Comet Roadmap', sender: 'lead@simulated-corp.com', snippet: 'Review the attached Q1 goals...', date: '10:30 AM', isUnread: true, tag: 'Work' },
            { id: '2', subject: 'Your Invoice #3049', sender: 'billing@cloud-services.io', snippet: 'Payment received for server instance...', date: 'Yesterday', isUnread: false, tag: 'Finance' },
            { id: '3', subject: 'Deployment Succeeded', sender: 'git-bot@vcs.com', snippet: 'Build #3992 passed all checks.', date: 'Yesterday', isUnread: true, tag: 'DevOps' },
            { id: '4', subject: 'Weekly Standup Notes', sender: 'pm@simulated-corp.com', snippet: 'Action items: optimized render loop...', date: '3 Days ago', isUnread: false, tag: 'Work' },
            { id: '5', subject: 'Welcome to Comet Pro', sender: 'noreply@comet.browser', snippet: 'Thanks for upgrading your account!', date: 'Last Week', isUnread: false, tag: 'Promotions' },
        ];
        return mockMails;
    },

    async fetchFiles(token: string): Promise<DriveFile[]> {
        await new Promise(r => setTimeout(r, 1200));

        return [
            { id: 'd1', name: 'Q1 Financials', type: 'sheet', owner: 'me', lastModified: '2 hours ago' },
            { id: 'd2', name: 'Design Assets', type: 'folder', owner: 'design-team', lastModified: '1 day ago' },
            { id: 'd3', name: 'Product Spec v2', type: 'doc', owner: 'pm', lastModified: '3 days ago' },
        ];
    },

    // --- GitHub Actions Simulation ---

    async deployRepo(token: string, code: string): Promise<{ success: boolean; url?: string }> {
        await new Promise(r => setTimeout(r, 2000));
        // Simulate a deployment
        return { success: true, url: 'https://comet-preview-x92.vercel.app' };
    },

    async forkRepo(token: string, repoUrl: string): Promise<boolean> {
        console.log(`Forking ${repoUrl} with token ${token}`);
        await new Promise(r => setTimeout(r, 1000));
        return true;
    },

    async pushChanges(token: string, fileContent: string, commitMsg: string): Promise<boolean> {
        console.log(`Pushing to main: "${commitMsg}"`);
        await new Promise(r => setTimeout(r, 1500));
        return true;
    },

    // --- AI Logic ---

    runAIOrganization(mails: MailItem[]): MailItem[] {
        // Simple heuristic simulation of what an LLM would do
        return mails.map(m => {
            if (m.subject.toLowerCase().includes('invoice')) return { ...m, tag: 'Finance' };
            if (m.subject.toLowerCase().includes('project') || m.subject.toLowerCase().includes('standup')) return { ...m, tag: 'Work' };
            if (m.sender.includes('git')) return { ...m, tag: 'DevOps' };
            return m;
        });
    }
};
