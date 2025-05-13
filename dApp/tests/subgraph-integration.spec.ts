import { test, expect } from '@playwright/test';

test.describe('Subgraph Integration Tests', () => {
  // Test to verify that market events are properly captured by the subgraph
  test('should create a market and verify event is captured by subgraph', async ({ page }) => {
    // Step 1: Create a new market
    await page.goto('/admin/market');
    await page.waitForSelector('#marketName', { state: 'visible' });
    
    // Generate a unique market name with timestamp
    const timestamp = new Date().getTime();
    const marketName = `Subgraph Test Market ${timestamp}`;
    
    // Fill out the form
    await page.fill('#marketName', marketName);
    
    // Select tokens from dropdowns
    try {
      await page.waitForSelector('select#tokenA:not([disabled])', { timeout: 5000 });
      await page.selectOption('select#tokenA', { label: /ETH/ });
      await page.selectOption('select#tokenB', { label: /USDC/ });
    } catch (e) {
      // Fallback to direct address input if dropdowns aren't working
      await page.fill('#tokenA_address', '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'); // ETH
      await page.fill('#tokenB_address', '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'); // USDC
    }
    
    await page.selectOption('#predictionMarketType', 'price_binary');
    await page.fill('#targetPrice', '2500');
    await page.fill('#durationHours', '24');
    await page.fill('#resolutionSource', 'ETH/USD');
    
    // Submit the form
    await page.click('button:has-text("Create New Market")');
    
    // Wait for success message
    const successMessage = await page.waitForSelector('.bg-green-100', { timeout: 30000 });
    expect(await successMessage.isVisible()).toBeTruthy();
    
    // Extract the market ID from the success message
    const successText = await successMessage.textContent() || '';
    const marketIdMatch = successText.match(/Market ID: ([a-zA-Z0-9]+)/);
    
    if (!marketIdMatch || !marketIdMatch[1]) {
      throw new Error('Could not extract market ID from success message');
    }
    
    const createdMarketId = marketIdMatch[1];
    console.log(`Created market with ID: ${createdMarketId}`);
    
    // Step 2: Wait for the subgraph to index the event
    // This typically takes a few seconds to a minute depending on the subgraph setup
    // We'll wait up to 2 minutes
    await page.waitForTimeout(10000); // Initial wait to give subgraph time to start indexing
    
    // Step 3: Navigate to the admin dashboard
    await page.goto('/admin');
    
    // Wait for the market data to load
    await page.waitForSelector('table', { state: 'visible', timeout: 10000 });
    
    // Check if our market appears in the table
    let marketFound = false;
    let retryCount = 0;
    const maxRetries = 12; // 12 retries * 10 seconds = 2 minutes max wait time
    
    while (!marketFound && retryCount < maxRetries) {
      // Force a refresh to ensure the latest data is loaded
      await page.click('button:has-text("Refresh")');
      
      // Wait for the data to reload
      await page.waitForSelector('table', { state: 'visible', timeout: 10000 });
      
      // Look for our newly created market in the table
      const marketRow = page.locator(`tr:has-text("${marketName}")`);
      marketFound = await marketRow.isVisible();
      
      if (!marketFound) {
        console.log(`Market not found yet, retrying... (${retryCount + 1}/${maxRetries})`);
        retryCount++;
        await page.waitForTimeout(10000); // Wait 10 seconds before retrying
      }
    }
    
    // Verify that the market was found
    expect(marketFound).toBeTruthy();
    
    // Find the market row
    const marketRow = page.locator(`tr:has-text("${marketName}")`);
    
    // Verify the market details in the table
    await expect(marketRow.locator('td:nth-child(2)')).toContainText(marketName);
    await expect(marketRow.locator('td:nth-child(3)')).toContainText('ETH/USD');
    await expect(marketRow.locator('td:nth-child(4)')).toContainText('Open');
    
    // Step 4: Navigate to the market details page
    await marketRow.click();
    
    // Wait for navigation to complete
    await page.waitForURL(/\/admin\/market\/\d+$/, { timeout: 5000 });
    
    // Verify that we're on the market details page and it shows data from the subgraph
    await expect(page.locator('h1')).toContainText(marketName);
    
    // Verify market details that would come from the subgraph
    await expect(page.locator('dt:has-text("Asset Pair") + dd')).toContainText('ETH/USD');
    await expect(page.locator('dt:has-text("Status") + dd')).toContainText('Open');
    await expect(page.locator('dt:has-text("Price Threshold") + dd')).toContainText('$2,500');
  });
});
