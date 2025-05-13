import { test, expect } from '@playwright/test';

test.describe('End-to-End Market Creation and Display', () => {
  let createdMarketId: string | null = null;

  // Helper function to fill token fields
  async function fillTokenFields(page: any, tokenA: string, tokenB: string) {
    try {
      // Wait for the token list to load
      await page.waitForSelector('select#tokenA:not([disabled])', { timeout: 5000 });
      
      // Find tokens in the dropdowns
      const tokenAOption = page.locator('select#tokenA option', { hasText: tokenA }).first();
      const tokenBOption = page.locator('select#tokenB option', { hasText: tokenB }).first();
      
      // If we found the options, select them
      if (await tokenAOption.count() > 0 && await tokenBOption.count() > 0) {
        const tokenAValue = await tokenAOption.getAttribute('value');
        const tokenBValue = await tokenBOption.getAttribute('value');
        
        await page.selectOption('select#tokenA', tokenAValue || '');
        await page.selectOption('select#tokenB', tokenBValue || '');
        return true;
      }
    } catch (e: any) {
      console.log(`Token dropdowns not found or not ready: ${e.message}`);
    }
    
    // Fallback to using addresses directly
    const tokenAddresses = {
      'ETH': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      'USDC': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      'BTC': '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      'LINK': '0x514910771AF9Ca656af840dff83E8264EcF986CA',
      'DAI': '0x6B175474E89094C44Da98b954EedeAC495271d0F'
    };
    
    await page.fill('#tokenA_address', tokenAddresses[tokenA as keyof typeof tokenAddresses] || tokenAddresses['ETH']);
    await page.fill('#tokenB_address', tokenAddresses[tokenB as keyof typeof tokenAddresses] || tokenAddresses['USDC']);
    return false;
  }

  test('should create a market and verify it appears on the dashboard', async ({ page }) => {
    // Step 1: Create a new market
    await page.goto('/admin/market');
    await page.waitForSelector('#marketName', { state: 'visible' });
    
    // Generate a unique market name with timestamp to ensure we can identify it later
    const timestamp = new Date().getTime();
    const marketName = `Test Market ETH/USDC ${timestamp}`;
    
    // Fill out the form
    await page.fill('#marketName', marketName);
    await fillTokenFields(page, 'ETH', 'USDC');
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
    
    if (marketIdMatch && marketIdMatch[1]) {
      createdMarketId = marketIdMatch[1];
      console.log(`Created market with ID: ${createdMarketId}`);
    } else {
      throw new Error('Could not extract market ID from success message');
    }
    
    // Step 2: Navigate to the admin dashboard
    await page.goto('/admin');
    
    // Wait for the market data to load
    await page.waitForSelector('table', { state: 'visible', timeout: 10000 });
    
    // Force a refresh to ensure the latest data is loaded
    await page.click('button:has-text("Refresh")');
    
    // Wait for the data to reload
    await page.waitForSelector('table', { state: 'visible', timeout: 10000 });
    
    // Look for our newly created market in the table
    const marketRow = page.locator(`tr:has-text("${marketName}")`);
    await expect(marketRow).toBeVisible({ timeout: 10000 });
    
    // Verify the market details in the table
    await expect(marketRow.locator('td:nth-child(2)')).toContainText(marketName);
    await expect(marketRow.locator('td:nth-child(3)')).toContainText('ETH/USD');
    await expect(marketRow.locator('td:nth-child(4)')).toContainText('Open');
    
    // Step 3: Navigate to the market details page
    await marketRow.click();
    
    // Wait for navigation to complete
    await page.waitForURL(/\/admin\/market\/\d+$/, { timeout: 5000 });
    
    // Verify that we're on the market details page
    await expect(page.locator('h1')).toContainText(marketName);
    
    // Verify market details
    await expect(page.locator('dt:has-text("Asset Pair") + dd')).toContainText('ETH/USD');
    await expect(page.locator('dt:has-text("Status") + dd')).toContainText('Open');
    await expect(page.locator('dt:has-text("Price Threshold") + dd')).toContainText('$2,500');
  });
});
