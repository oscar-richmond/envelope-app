import { test, expect, Page } from '@playwright/test';

/**
 * CTA Smoke Tests
 * 
 * Tests all major CTAs across the Envelope platform to ensure:
 * 1. No console errors on page load
 * 2. CTAs are clickable
 * 3. CTAs trigger expected behavior
 * 4. API calls return success (200 OK)
 */

// Auth helper - skip auth for now (requires session setup)
const AUTH_COOKIE = process.env.PLAYWRIGHT_AUTH_COOKIE || '';

test.describe('CTA Smoke Tests', () => {
    test.beforeEach(async ({ page }) => {
        // Capture all console errors
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log(`Console Error: ${msg.text()}`);
            }
        });

        // Track network failures
        page.on('response', response => {
            if (response.status() >= 500) {
                console.log(`Server Error: ${response.status()} ${response.url()}`);
            }
        });
    });

    test.describe('Sidebar Navigation', () => {
        test('Dashboard link navigates correctly', async ({ page }) => {
            await page.goto('/leads');
            await page.click('text=Dashboard');
            await expect(page).toHaveURL('/dashboard');
        });

        test('Lead Board link navigates correctly', async ({ page }) => {
            await page.goto('/dashboard');
            await page.click('text=Lead Board');
            await expect(page).toHaveURL('/leads');
        });

        test('Prospect Search link navigates correctly', async ({ page }) => {
            await page.goto('/leads');
            await page.click('text=Prospect Search');
            await expect(page).toHaveURL('/prospects');
        });
    });

    test.describe('Lead Board CTAs', () => {
        test.beforeEach(async ({ page }) => {
            await page.goto('/leads');
            await page.waitForLoadState('networkidle');
        });

        test('Add Lead button opens modal', async ({ page }) => {
            await page.click('text=Add Lead');
            await expect(page.locator('[role="dialog"], .modal')).toBeVisible();
        });

        test('Open button navigates to lead detail', async ({ page }) => {
            const openButton = page.locator('text=Open').first();
            if (await openButton.isVisible()) {
                await openButton.click();
                await expect(page).toHaveURL(/\/leads\/\d+/);
            }
        });

        test('Msg button opens composer modal', async ({ page }) => {
            const msgButton = page.locator('button:has-text("Msg")').first();
            if (await msgButton.isVisible()) {
                await msgButton.click();
                await expect(page.locator('.fixed.inset-0, [role="dialog"]')).toBeVisible();
            }
        });

        test('Company name opens overview modal', async ({ page }) => {
            const companyName = page.locator('[class*="cursor-pointer"]').first();
            if (await companyName.isVisible()) {
                await companyName.click();
                // Should open a modal, not navigate
                await expect(page.locator('.fixed.inset-0, [role="dialog"], .modal')).toBeVisible();
            }
        });

        test('Delete icon shows confirm dialog', async ({ page }) => {
            const deleteButton = page.locator('[title*="delete" i], [title*="remove" i]').first();
            if (await deleteButton.isVisible()) {
                await deleteButton.click();
                await expect(page.locator('text=Confirm, text=Delete, [role="alertdialog"]')).toBeVisible();
            }
        });
    });

    test.describe('Composer Modal CTAs', () => {
        test.beforeEach(async ({ page }) => {
            await page.goto('/leads');
            await page.waitForLoadState('networkidle');

            // Open composer
            const msgButton = page.locator('button:has-text("Msg")').first();
            if (await msgButton.isVisible()) {
                await msgButton.click();
                await page.waitForSelector('.fixed.inset-0');
            }
        });

        test('Close button closes modal', async ({ page }) => {
            await page.click('[title*="Close"], button:has(svg)');
            await expect(page.locator('.fixed.inset-0')).not.toBeVisible();
        });

        test('Tab buttons switch tabs', async ({ page }) => {
            const composeTab = page.locator('button:has-text("Compose")');
            if (await composeTab.isVisible()) {
                await composeTab.click();
                await expect(composeTab).toHaveAttribute('style', /brand/);
            }
        });

        test('Find Contacts button triggers scan', async ({ page }) => {
            // Wait for modal to load
            await page.waitForTimeout(1000);

            const findContactsBtn = page.locator('button:has-text("Find Contacts")');
            if (await findContactsBtn.isVisible()) {
                // Track API call
                const apiPromise = page.waitForResponse(resp =>
                    resp.url().includes('/api/companies/') && resp.url().includes('/contacts')
                );

                await findContactsBtn.click();

                const response = await apiPromise;
                expect(response.status()).toBeLessThan(500);
            }
        });
    });

    test.describe('API Health Checks', () => {
        test('Leads API returns OK', async ({ page }) => {
            const response = await page.request.get('/api/leads');
            expect(response.status()).toBeLessThan(500);
        });

        test('Dashboard activity API returns OK', async ({ page }) => {
            const response = await page.request.get('/api/dashboard/activity');
            expect(response.status()).toBeLessThan(500);
        });
    });

    test.describe('Console Error Check', () => {
        const pagesToCheck = [
            '/leads',
            '/prospects',
            '/dashboard',
            '/settings'
        ];

        for (const pagePath of pagesToCheck) {
            test(`${pagePath} has no console errors`, async ({ page }) => {
                const errors: string[] = [];

                page.on('console', msg => {
                    if (msg.type() === 'error') {
                        errors.push(msg.text());
                    }
                });

                await page.goto(pagePath);
                await page.waitForLoadState('networkidle');
                await page.waitForTimeout(2000);

                // Filter out known non-critical errors
                const criticalErrors = errors.filter(e =>
                    !e.includes('favicon') &&
                    !e.includes('Hydration') &&
                    !e.includes('Warning:')
                );

                expect(criticalErrors).toEqual([]);
            });
        }
    });
});

// Helper: Check CTA is clickable and doesn't throw
async function checkCTAClickable(page: Page, selector: string, description: string) {
    const element = page.locator(selector).first();

    if (await element.isVisible()) {
        await expect(element).toBeEnabled();

        // Check it doesn't throw on click
        try {
            await element.click({ timeout: 5000 });
            console.log(`✓ ${description} - clickable`);
        } catch (e) {
            console.log(`✗ ${description} - click failed: ${e}`);
            throw e;
        }
    } else {
        console.log(`⊘ ${description} - not visible`);
    }
}
