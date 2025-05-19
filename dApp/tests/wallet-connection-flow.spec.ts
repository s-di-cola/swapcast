import { test, expect, type Page } from '@playwright/test';
import { createTestClient, createWalletClient, http, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { hardhat } from 'viem/chains';
import { walletState } from '$lib/stores/wallet';
import { get } from 'svelte/store';

// Test account from Anvil
const TEST_ACCOUNT = {
  address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Address,
  privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
} as const;

// Create a test client and wallet client
const testClient = createTestClient({
  chain: hardhat,
  mode: 'anvil',
  transport: http()
});

const walletClient = createWalletClient({
  chain: hardhat,
  transport: http()
});

const account = privateKeyToAccount(TEST_ACCOUNT.privateKey);

// Helper function to simulate wallet connection
async function connectWallet(page: Page) {
  await page.evaluate((address) => {
    window.dispatchEvent(new CustomEvent('appkit:connect', {
      detail: { address }
    }));
  }, TEST_ACCOUNT.address);
}

// Helper function to simulate wallet disconnection
async function disconnectWallet(page: Page) {
  await page.evaluate(() => {
    window.dispatchEvent(new Event('appkit:disconnect'));
  });
}

/**
 * Test suite for the wallet connection flow
 */
test.describe('Wallet Connection Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Reset wallet state before each test
    walletState.set({
      isConnected: false,
      address: null,
      chainId: null,
      isConnecting: false
    });
    
    // Navigate to the app
    await page.goto('/');
  });

  test('should show connect wallet button on landing page', async ({ page }) => {
    const connectButton = page.getByRole('button', { name: /connect wallet/i });
    await expect(connectButton).toBeVisible();
  });

  test('should connect wallet successfully', async ({ page }) => {
    // Simulate wallet connection
    await connectWallet(page);
    
    // Check if the wallet address is displayed (adjust selector based on your UI)
    const walletAddress = page.locator('[data-testid="wallet-address"]');
    await expect(walletAddress).toContainText(TEST_ACCOUNT.address.substring(0, 6));
    
    // Verify the wallet state
    const state = get(walletState);
    expect(state.isConnected).toBe(true);
    expect(state.address).toBe(TEST_ACCOUNT.address);
  });

  test('should disconnect wallet when requested', async ({ page }) => {
    // First connect the wallet
    await connectWallet(page);
    
    // Then disconnect it
    await disconnectWallet(page);
    
    // Check if the connect button is visible again
    const connectButton = page.getByRole('button', { name: /connect wallet/i });
    await expect(connectButton).toBeVisible();
    
    // Verify the wallet state
    const state = get(walletState);
    expect(state.isConnected).toBe(false);
    expect(state.address).toBeNull();
  });

  test('should redirect to landing page when accessing app without connected wallet', async ({ page }) => {
    // Navigate directly to the app page without connecting wallet
    await page.goto('/app');
    
    // Should be redirected to the landing page
    await expect(page).toHaveURL('/');
    
    // Check for connect wallet button
    const connectButton = page.getByRole('button', { name: /connect wallet/i });
    await expect(connectButton).toBeVisible();
  });
});
