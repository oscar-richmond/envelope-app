/**
 * Business Days Utility
 * Handles date calculations that respect weekends (Mon-Fri only)
 */

/**
 * Check if a date is a business day (Monday-Friday)
 */
export function isBusinessDay(date: Date): boolean {
    const day = date.getDay();
    return day !== 0 && day !== 6; // 0 = Sunday, 6 = Saturday
}

/**
 * Add business days to a date
 * Skips weekends automatically
 */
export function addBusinessDays(date: Date, days: number): Date {
    const result = new Date(date);
    let addedDays = 0;

    while (addedDays < days) {
        result.setDate(result.getDate() + 1);
        if (isBusinessDay(result)) {
            addedDays++;
        }
    }

    return result;
}

/**
 * Get the next business day from a date
 * If the date is already a business day, returns it
 * Otherwise returns the next Monday
 */
export function getNextBusinessDay(date: Date): Date {
    const result = new Date(date);
    while (!isBusinessDay(result)) {
        result.setDate(result.getDate() + 1);
    }
    return result;
}

/**
 * Calculate business days between two dates
 */
export function getBusinessDaysBetween(startDate: Date, endDate: Date): number {
    let count = 0;
    const current = new Date(startDate);

    while (current < endDate) {
        current.setDate(current.getDate() + 1);
        if (isBusinessDay(current)) {
            count++;
        }
    }

    return count;
}

/**
 * Check if a follow-up is overdue (past due date and it's a business day)
 */
export function isOverdue(dueDate: Date, now: Date = new Date()): boolean {
    return dueDate < now;
}

/**
 * Get the number of business days overdue
 */
export function getOverdueBusinessDays(dueDate: Date, now: Date = new Date()): number {
    if (!isOverdue(dueDate, now)) return 0;
    return getBusinessDaysBetween(dueDate, now);
}
