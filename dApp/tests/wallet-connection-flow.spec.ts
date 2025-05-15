import { test, expect, type Page } from '@playwright/test';

/**
 * Test suite for the wallet connection flow
 * This tests the complete flow from landing page to app page,
 * including MetaMask wallet connection and page transition
 */
test.describe('Wallet Connection Flow', () => {
  // Set a longer timeout for wallet interactions
  test.setTimeout(60000);

  // Mock Ethereum provider for testing
  const mockEthereumProvider = {
    isMetaMask: true,
    selectedAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    chainId: '0x1', // Mainnet
    networkVersion: '1',
    request: async ({ method, params }: { method: string; params?: any[] }) => {
      console.log(`Mock Ethereum provider received request: ${method}`, params);
      
      // Handle different RPC methods
      switch (method) {
        case 'eth_requestAccounts':
        case 'eth_accounts':
          return ['0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'];
        case 'eth_chainId':
          return '0x1';
        case 'net_version':
          return '1';
        default:
          console.log(`Unhandled method: ${method}`);
          return null;
      }
    },
    on: (eventName: string, callback: Function) => {
      console.log(`Mock Ethereum provider registered event listener: ${eventName}`);
    },
    removeListener: (eventName: string, callback: Function) => {
      console.log(`Mock Ethereum provider removed event listener: ${eventName}`);
    }
  };

  /**
   * Helper function to inject the mock Ethereum provider
   */
  async function injectMockEthereumProvider(page: Page): Promise<void> {
    // Inject the mock provider into the page
    await page.addInitScript(`
      window.ethereum = ${JSON.stringify(mockEthereumProvider)};
      
      // Add request method (can't be serialized in JSON.stringify)
      window.ethereum.request = async ({ method, params }) => {
        console.log('Mock ethereum.request called with method:', method, params);
        
        switch (method) {
          case 'eth_requestAccounts':
          case 'eth_accounts':
            return ['0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'];
          case 'eth_chainId':
            return '0x1';
          case 'net_version':
            return '1';
          default:
            console.log('Unhandled method:', method);
            return null;
        }
      };
      
      // Add event listeners
      window.ethereum.on = (eventName, callback) => {
        console.log('Mock ethereum.on called with event:', eventName);
      };
      
      window.ethereum.removeListener = (eventName, callback) => {
        console.log('Mock ethereum.removeListener called with event:', eventName);
      };
      
      // Dispatch event to notify the page that ethereum is available
      window.dispatchEvent(new Event('ethereum#initialized'));
      console.log('Mock Ethereum provider injected');
    `);
  }

  /**
   * Helper function to verify wallet connection UI elements
   */
  async function verifyWalletConnectionUI(page: Page): Promise<void> {
    // Check for connect wallet button in the header
    const headerConnectButton = page.locator('header button:has-text("Connect Wallet")');
    await expect(headerConnectButton).toBeVisible();

    // Check for connect wallet button in the hero section
    const heroConnectButton = page.locator('section button:has-text("Connect Wallet")').first();
    await expect(heroConnectButton).toBeVisible();
  }

  /**
   * Helper function to verify app page UI elements
   */
  async function verifyAppPageUI(page: Page): Promise<void> {
    // Verify we're on the app page
    expect(page.url()).toContain('/app');
    
    // Check for dashboard title
    const dashboardTitle = page.locator('h1:has-text("Dashboard")');
    await expect(dashboardTitle).toBeVisible();
    
    // Check for wallet address display
    const walletAddressSelectors = [
      '[data-testid="wallet-address"]',
      '.wallet-address',
      'text=0xf39F',
      'text=Connected'
    ];
    
    let walletAddressFound = false;
    for (const selector of walletAddressSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        walletAddressFound = true;
        break;
      }
    }
    
    expect(walletAddressFound).toBeTruthy();
  }

  test('should connect wallet and transition to app page', async ({ page }) => {
    // Inject mock Ethereum provider before navigating
    await injectMockEthereumProvider(page);
    
    // Navigate to the landing page
    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Verify wallet connection UI elements
    await verifyWalletConnectionUI(page);
    
    // Click the connect wallet button in the header
    const connectButton = page.locator('header button:has-text("Connect Wallet")');
    await connectButton.click();
    
    // Wait for the connection process
    await page.waitForTimeout(2000);
    
    // Wait for navigation to the app page
    try {
      await page.waitForURL('**/app', { timeout: 5000 });
    } catch (error) {
      console.log('Navigation to app page failed, checking for Go to App button');
      
      // If direct navigation failed, try clicking the Go to App button
      const goToAppButton = page.locator('button:has-text("Go to App")');
      if (await goToAppButton.isVisible()) {
        await goToAppButton.click();
        await page.waitForURL('**/app', { timeout: 5000 });
      } else {
        throw new Error('Failed to navigate to app page and Go to App button not found');
      }
    }
    
    // Verify app page UI elements
    await verifyAppPageUI(page);
  });

  test('should stay on app page when refreshing with connected wallet', async ({ page }) => {
    // Inject mock Ethereum provider before navigating
    await injectMockEthereumProvider(page);
    
    // Navigate directly to the app page
    await page.goto('/app');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Verify we're still on the app page and not redirected back to landing
    expect(page.url()).toContain('/app');
    
    // Verify app page UI elements
    await verifyAppPageUI(page);
    
    // Refresh the page
    await page.reload();
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Verify we're still on the app page after refresh
    expect(page.url()).toContain('/app');
    
    // Verify app page UI elements again
    await verifyAppPageUI(page);
  });
});
