import { test, expect } from '@playwright/test';

test.describe('Admin Market Creation', () => {
  // Test that we can navigate to the admin market creation page and see the form
  test('should navigate to the admin market creation page and see the form', async ({ page }) => {
    // Navigate to the admin market creation page
    await page.goto('/admin/market');

    // Verify the page title
    await expect(page.locator('h1')).toContainText('Create New Prediction Market');

    // Check for the presence of key form fields
    await expect(page.locator('label:has-text("Market Name")')).toBeVisible();
    await expect(page.locator('label:has-text("Token A")')).toBeVisible();
    await expect(page.locator('label:has-text("Token B")')).toBeVisible();
    await expect(page.locator('label:has-text("Market Type")')).toBeVisible();
    await expect(page.locator('label:has-text("Prediction Duration")')).toBeVisible();
    await expect(page.locator('label:has-text("Resolution Source")')).toBeVisible();

    // Check for the submit button
    await expect(page.getByRole('button', { name: 'Create New Market' })).toBeVisible();
  });

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
  
  // Helper function to wait for form submission response
  async function waitForSubmissionResponse(page: any) {
    const successSelector = '.bg-green-100'; // Assuming this class is still used for the success message container
    const errorSelector = '.bg-red-100'; // Assuming this class is still used for error messages
    const successTimeout = 30000; // Increased timeout to 30 seconds
    const errorTimeout = 5000; // Keep error timeout shorter

    const successLocator = page.locator(successSelector);
    const errorLocator = page.locator(errorSelector);

    try {
      // Wait for either success or error message
      await Promise.race([
        expect(successLocator).toContainText(/Market created successfully!( Market ID: \d+)?/i, { timeout: successTimeout }),
        expect(errorLocator).toBeVisible({ timeout: errorTimeout })
      ]);

      // Check which one appeared
      if (await successLocator.isVisible()) {
        console.log(`Success message found: ${await successLocator.textContent()}`);
        return true;
      } else {
        console.error(`Error message found: ${await errorLocator.textContent()}`);
        return false; // Explicitly return false on error
      }
    } catch (e: any) {
      const innerErrorMessage = (e instanceof Error) ? e.message : String(e);
      console.error(`Neither success nor error message found within their respective timeouts. Inner error: ${innerErrorMessage}`);
      // Optionally, capture a screenshot or more context here if needed for debugging
      // await page.screenshot({ path: `debug_screenshot_${Date.now()}.png` });
      throw new Error(`Market creation failed: Neither success nor error indicator appeared. Last success check error: ${innerErrorMessage}`); // Re-throw an error to fail the test clearly
    }
  }

  // Test that we can fill out the form and create a binary market for ETH/USDC
  test('should create an ETH/USDC binary market', async ({ page }) => {
    // Navigate to the admin market creation page
    await page.goto('/admin/market');

    // Wait for the form to be fully loaded
    await page.waitForSelector('#marketName', { state: 'visible' });
    
    // Fill out the form for an ETH/USDC market
    await page.fill('#marketName', 'Will ETH/USDC price be above $2500 in 24h?');
    
    // Fill token fields
    await fillTokenFields(page, 'ETH', 'USDC');
    
    // Select binary market type
    await page.selectOption('#predictionMarketType', 'price_binary');
    
    // Set target price to $2500
    await page.fill('#targetPrice', '2500');
    
    // Set duration to 24 hours
    await page.fill('#durationHours', '24');
    
    // Set resolution source to Chainlink ETH/USD Feed
    await page.fill('#resolutionSource', 'ETH/USD');
    
    // Submit the form
    await page.click('button:has-text("Create New Market")');
    
    // Wait for response
    await waitForSubmissionResponse(page);
    
    console.log('ETH/USDC binary market creation test completed');
  });
  
  // Test creating a price range market
  test('should create a BTC/USD price range market', async ({ page }) => {
    // Navigate to the admin market creation page
    await page.goto('/admin/market');

    // Wait for the form to be fully loaded
    await page.waitForSelector('#marketName', { state: 'visible' });
    
    // Fill out the form for a BTC/USD range market
    await page.fill('#marketName', 'Will BTC price stay between $60000-$70000 for the next week?');
    
    // Fill token fields
    await fillTokenFields(page, 'BTC', 'USDC');
    
    // Select range market type
    await page.selectOption('#predictionMarketType', 'price_range');
    
    // Wait for the range fields to appear
    await page.waitForSelector('#lowerBoundPrice', { state: 'visible', timeout: 2000 });
    
    // Set price range
    await page.fill('#lowerBoundPrice', '60000');
    await page.fill('#upperBoundPrice', '70000');
    
    // Set duration to 168 hours (1 week)
    await page.fill('#durationHours', '168');
    
    // Set resolution source to Chainlink BTC/USD Feed
    await page.fill('#resolutionSource', 'BTC/USD');
    
    // Submit the form
    await page.click('button:has-text("Create New Market")');
    
    // Wait for response
    await waitForSubmissionResponse(page);
    
    console.log('BTC/USD range market creation test completed');
  });
  
  // Test with a very short duration market (edge case)
  test('should create a short-duration LINK/USD market', async ({ page }) => {
    // Navigate to the admin market creation page
    await page.goto('/admin/market');

    // Wait for the form to be fully loaded
    await page.waitForSelector('#marketName', { state: 'visible' });
    
    // Fill out the form for a short duration market
    await page.fill('#marketName', 'Will LINK price exceed $15 in the next hour?');
    
    // Fill token fields
    await fillTokenFields(page, 'LINK', 'USDC');
    
    // Select binary market type
    await page.selectOption('#predictionMarketType', 'price_binary');
    
    // Set target price
    await page.fill('#targetPrice', '15');
    
    // Set duration to 1 hour (edge case)
    await page.fill('#durationHours', '1');
    
    // Set resolution source
    await page.fill('#resolutionSource', 'LINK/USD');
    
    // Submit the form
    await page.click('button:has-text("Create New Market")');
    
    // Wait for response
    await waitForSubmissionResponse(page);
    
    console.log('Short duration market creation test completed');
  });
});
