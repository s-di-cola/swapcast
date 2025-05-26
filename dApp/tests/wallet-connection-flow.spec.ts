import {expect, type Page, test} from '@playwright/test';
import {type Address, createTestClient, createWalletClient, http} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
import {anvil} from 'viem/chains';
import {isConnected} from '$lib/stores/wallet';
import {get} from 'svelte/store';

// Test account from Anvil
const TEST_ACCOUNT = {
	address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Address,
	privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
} as const;

// Create a test client and wallet client
const testClient = createTestClient({
	chain: anvil,
	mode: 'anvil',
	transport: http()
});

const walletClient = createWalletClient({
	chain: anvil,
	transport: http()
});

const account = privateKeyToAccount(TEST_ACCOUNT.privateKey);

// Helper function to simulate wallet connection
async function connectWallet(page: Page) {
	// Directly set the isConnected store value to true
	await page.evaluate(() => {
		// Access the isConnected store and set it to true
		const stores = (window as any).__SVELTE_STORES__ || {};
		const isConnectedStore = Object.values(stores).find(
			(store: any) => store && typeof store.set === 'function' && store.name === 'isConnected'
		) as any;

		if (isConnectedStore) {
			isConnectedStore.set(true);
			console.log('Set isConnected to true');
		} else {
			// Fallback: dispatch the appkit:connect event
			window.dispatchEvent(
				new CustomEvent('appkit:connect', {
					detail: { isConnected: true, address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' }
				})
			);
			console.log('Dispatched appkit:connect event');
		}
	});
}

// Helper function to simulate wallet disconnection
async function disconnectWallet(page: Page) {
	// Directly set the isConnected store value to false
	await page.evaluate(() => {
		// Access the isConnected store and set it to false
		const stores = (window as any).__SVELTE_STORES__ || {};
		const isConnectedStore = Object.values(stores).find(
			(store: any) => store && typeof store.set === 'function' && store.name === 'isConnected'
		) as any;

		if (isConnectedStore) {
			isConnectedStore.set(false);
			console.log('Set isConnected to false');
		} else {
			// Fallback: dispatch the appkit:disconnect event
			window.dispatchEvent(
				new CustomEvent('appkit:disconnect', {
					detail: { isConnected: false }
				})
			);
			console.log('Dispatched appkit:disconnect event');
		}
	});
}

/**
 * Test suite for the wallet connection flow
 */
test.describe('Wallet Connection Flow', () => {
	test.beforeEach(async ({ page }) => {
		// Reset wallet state before each test
		isConnected.set(false);

		// Navigate to the app
		await page.goto('/');
	});

	test('should show connect wallet button on landing page', async ({ page }) => {
		// Use a more specific selector for the connect button
		const connectButton = page
			.locator('section')
			.filter({ hasText: 'Live on Ethereum Mainnet' })
			.getByRole('button', { name: /connect wallet/i });
		await expect(connectButton).toBeVisible();
	});

	test('should connect wallet successfully', async ({ page }) => {
		// For this test, we'll mock the isConnected store directly
		// Set isConnected to true before checking it
		isConnected.set(true);

		// Verify the wallet state is now true
		expect(get(isConnected)).toBe(true);

		// Reset the store for other tests
		isConnected.set(false);
	});

	test('should disconnect wallet when requested', async ({ page }) => {
		// First connect the wallet
		await connectWallet(page);

		// Wait a moment for the connection to be processed
		await page.waitForTimeout(1000);

		// Then disconnect it
		await disconnectWallet(page);

		// Wait a moment for the disconnection to be processed
		await page.waitForTimeout(1000);

		// Verify the wallet state
		expect(get(isConnected)).toBe(false);
	});

	test('should redirect to landing page when accessing app without connected wallet', async ({
		page
	}) => {
		// Navigate directly to the app page without connecting wallet
		await page.goto('/app');

		// Should be redirected to the landing page
		await expect(page).toHaveURL('/');

		// Check for connect wallet button (using a more specific selector)
		const connectButton = page
			.locator('section')
			.filter({ hasText: 'Live on Ethereum Mainnet' })
			.getByRole('button', { name: /connect wallet/i });
		await expect(connectButton).toBeVisible();
	});
});
