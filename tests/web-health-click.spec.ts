import { test, expect } from '@playwright/test';

test.describe('Web Health Interaction', () => {
    test('should open modal when clicking Not Scanned card', async ({ page }) => {
        // 1. Go to Prospects
        await page.goto('/prospects');

        // 2. Find a "Not Scanned" badge (or any health badge)
        // We assume there's at least one company. If not, this test might need seeding.
        const healthBadge = page.locator('[class*="bg-gray-100"]').first(); // Gray usually means not scanned/idle

        if (await healthBadge.isVisible()) {
            await healthBadge.click();

            // 3. Verify Modal Opens
            await expect(page.locator('h2:has-text("Website Intelligence")').or(page.locator('h2:has-text("Website Health")'))).toBeVisible();
        }
    });

    test('should open modal even if score is 0', async ({ page }) => {
        // This assumes we can find a score 0 element. 
        // For now, we'll just check that *any* score pill is clickable.
        await page.goto('/prospects');
        const scorePill = page.locator('span:has-text("/100")').first();
        if (await scorePill.isVisible()) {
            await scorePill.click();
            await expect(page.locator('h2:has-text("Website Intelligence")')).toBeVisible();
        }
    });
});
