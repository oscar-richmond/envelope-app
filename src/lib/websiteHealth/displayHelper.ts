/**
 * Web Health Display Helper
 * 
 * Unified logic for displaying website health across all UI surfaces.
 * Handles null scores, error states, and scanning states consistently.
 */

export interface WebHealthFields {
    websiteHealthStatus?: string | null;
    websiteHealthScore?: number | null;
    websiteHealthLabel?: string | null;
    websiteHealthError?: string | null;
    websiteHealthScannedAt?: Date | string | null;
}

export interface WebHealthDisplay {
    showScore: boolean;
    score: number | null;
    label: string;
    statusColor: 'gray' | 'blue' | 'yellow' | 'red' | 'green';
    tooltip?: string;
    isError: boolean;
}

export function getWebHealthDisplay(fields: WebHealthFields): WebHealthDisplay {
    const { websiteHealthStatus, websiteHealthScore, websiteHealthLabel, websiteHealthError } = fields;

    // Status: scanning
    if (websiteHealthStatus === 'scanning') {
        return {
            showScore: false,
            score: null,
            label: 'Scanning…',
            statusColor: 'blue',
            tooltip: 'Website health scan in progress',
            isError: false
        };
    }

    // Status: error - NO_WEBSITE_URL
    if (websiteHealthStatus === 'error' && websiteHealthError === 'NO_WEBSITE_URL') {
        return {
            showScore: false,
            score: null,
            label: 'No website',
            statusColor: 'gray',
            tooltip: "We couldn't find a website URL for this company yet",
            isError: true
        };
    }

    // Status: error - other
    if (websiteHealthStatus === 'error') {
        return {
            showScore: false,
            score: null,
            label: 'Scan failed',
            statusColor: 'red',
            tooltip: websiteHealthError || 'Website scan encountered an error',
            isError: true
        };
    }

    // Status: success with valid score
    if (websiteHealthStatus === 'success' && typeof websiteHealthScore === 'number') {
        return {
            showScore: true,
            score: websiteHealthScore,
            label: websiteHealthLabel || 'Unknown',
            statusColor: websiteHealthScore >= 75 ? 'red' :
                websiteHealthScore >= 50 ? 'yellow' :
                    websiteHealthScore >= 25 ? 'blue' : 'green',
            isError: false
        };
    }

    // Default: not scanned
    return {
        showScore: false,
        score: null,
        label: 'Not scanned',
        statusColor: 'gray',
        tooltip: 'Click to analyze website health',
        isError: false
    };
}

/**
 * Get color classes for Tailwind based on status
 */
export function getWebHealthColorClasses(display: WebHealthDisplay): {
    text: string;
    bg: string;
    border: string;
} {
    switch (display.statusColor) {
        case 'red':
            return {
                text: 'text-red-700 dark:text-red-400',
                bg: 'bg-red-50 dark:bg-red-900/20',
                border: 'border-red-200 dark:border-red-800'
            };
        case 'yellow':
            return {
                text: 'text-yellow-700 dark:text-yellow-400',
                bg: 'bg-yellow-50 dark:bg-yellow-900/20',
                border: 'border-yellow-200 dark:border-yellow-800'
            };
        case 'blue':
            return {
                text: 'text-blue-700 dark:text-blue-400',
                bg: 'bg-blue-50 dark:bg-blue-900/20',
                border: 'border-blue-200 dark:border-blue-800'
            };
        case 'green':
            return {
                text: 'text-green-700 dark:text-green-400',
                bg: 'bg-green-50 dark:bg-green-900/20',
                border: 'border-green-200 dark:border-green-800'
            };
        case 'gray':
        default:
            return {
                text: 'text-gray-700 dark:text-gray-400',
                bg: 'bg-gray-50 dark:bg-gray-900/20',
                border: 'border-gray-200 dark:border-gray-800'
            };
    }
}
