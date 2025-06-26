// Auto-generated file - DO NOT EDIT!
import { createPublicClient, http, getContract, type Address } from 'viem';

// ABI with type inference when used with 'as const'
export const IV4RouterAbi = [
  {
    type: 'function',
    name: 'poolManager',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IPoolManager',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'error',
    name: 'V4TooLittleReceived',
    inputs: [
      {
        name: 'minAmountOutReceived',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'amountReceived',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'V4TooMuchRequested',
    inputs: [
      {
        name: 'maxAmountInRequested',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'amountRequested',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
] as const;

/**
 * Function to get a typed contract instance
 */
export function getIV4Router({
  address,
  chain,
  transport,
}: {
  address: Address;
  chain: any; // Use viem's Chain type if available
  transport?: ReturnType<typeof http>;
}) {
  const client = createPublicClient({
    chain,
    transport: transport || http(),
  });

  return getContract({
    address,
    abi: IV4RouterAbi,
    client,
  });
}

// Type for the contract instance
export type IV4RouterInstance = ReturnType<typeof getIV4Router>;

// Types for all read functions - using optional chaining for safety
export type IV4RouterReadFunctions = IV4RouterInstance extends { read: infer R } ? R : never;

// Types for all write functions - using optional chaining for safety
export type IV4RouterWriteFunctions = IV4RouterInstance extends { write: infer W } ? W : never;
