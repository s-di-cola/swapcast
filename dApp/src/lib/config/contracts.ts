/**
 * Contract Addresses
 * 
 * Centralized configuration for all contract addresses used in the application.
 * This replaces the need to import from fixtures in production code.
 */

// Mainnet addresses (if any)
export const MAINNET_CONTRACTS = {
  // Add mainnet contract addresses here when needed
} as const;

// Testnet addresses
export const TESTNET_CONTRACTS = {
  // Using the same addresses as in your fixtures
  predictionPool: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  predictionManager: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
  swapCastNFT: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
  // Add other contract addresses as needed
} as const;

// Default to testnet for now
export const CONTRACT_ADDRESSES = TESTNET_CONTRACTS;

export default CONTRACT_ADDRESSES;
