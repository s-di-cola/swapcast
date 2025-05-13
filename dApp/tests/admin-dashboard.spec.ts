import { test, expect } from '@playwright/test';

test.describe('Admin Dashboard', () => {
  // Set up before each test
  test.beforeEach(async ({ page }) => {
    // Navigate to the admin dashboard
    await page.goto('/admin');
  });

  test('should load the admin dashboard and display market list', async ({ page }) => {
    // Check that the page title is correct
    await expect(page.locator('h1')).toContainText('SwapCast Admin Dashboard');
    
    // Wait for the market data to load
    await page.waitForSelector('table', { state: 'visible', timeout: 10000 });
    
    // Verify the table headers are present
    const headers = [
      'Market ID', 
      'Market Name', 
      'Asset Pair', 
      'Status', 
      'Ends In', 
      'Price Threshold', 
      'Total Stake', 
      'Actions'
    ];
    
    for (const header of headers) {
      await expect(page.locator(`th:has-text("${header}")`)).toBeVisible();
    }
  });

  test('should navigate to market creation page', async ({ page }) => {
    // Click the "Create New Market" button
    await page.click('text=+ Create New Market');
    
    // Verify that we've navigated to the market creation page
    await expect(page).toHaveURL(/\/admin\/market$/);
    await expect(page.locator('h1')).toContainText('Create New Prediction Market');
  });

  test('should navigate to market details when clicking on a market', async ({ page }) => {
    // Wait for the market data to load
    await page.waitForSelector('table', { state: 'visible', timeout: 10000 });
    
    // Check if there are any markets in the table
    const marketRows = await page.locator('tbody tr').count();
    
    if (marketRows > 0) {
      // Click on the first market row
      await page.locator('tbody tr').first().click();
      
      // Wait for navigation to complete to the market details page
      await page.waitForURL(/\/admin\/market\/\d+$/, { timeout: 5000 });

      // Verify that we've navigated to the market details page
      await expect(page).toHaveURL(/\/admin\/market\/\d+$/);
      await expect(page.locator('h1')).toContainText('Market Details');
    } else {
      // Skip this test if there are no markets
      test.skip();
    }
  });

  test('should refresh market data when clicking refresh button', async ({ page }) => {
    // Wait for the market data to load initially
    await page.waitForSelector('table', { state: 'visible', timeout: 10000 });
    
    // Click the refresh button
    await page.click('button:has-text("Refresh")');
    
    // Verify that the loading indicator appears
    await expect(page.locator('.animate-spin')).toBeVisible();
    
    // Wait for the data to load again
    await page.waitForSelector('table', { state: 'visible', timeout: 10000 });
    
    // Verify that the loading indicator disappears
    await expect(page.locator('.animate-spin')).not.toBeVisible();
  });
});
