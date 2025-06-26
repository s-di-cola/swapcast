// Auto-generated file - DO NOT EDIT!
import { createPublicClient, http, getContract, type Address } from 'viem';

// ABI with type inference when used with 'as const'
export const IUniversalRouterAbi = [
  {
    type: 'function',
    name: 'execute',
    inputs: [
      {
        name: 'commands',
        type: 'bytes',
        internalType: 'bytes',
      },
      {
        name: 'inputs',
        type: 'bytes[]',
        internalType: 'bytes[]',
      },
      {
        name: 'deadline',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'error',
    name: 'ETHNotAccepted',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ExecutionFailed',
    inputs: [
      {
        name: 'commandIndex',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'message',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
  },
  {
    type: 'error',
    name: 'InvalidEthSender',
    inputs: [],
  },
  {
    type: 'error',
    name: 'LengthMismatch',
    inputs: [],
  },
  {
    type: 'error',
    name: 'TransactionDeadlinePassed',
    inputs: [],
  },
] as const;

/**
 * Function to get a typed contract instance
 */
export function getIUniversalRouter({
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
    abi: IUniversalRouterAbi,
    client,
  });
}

// Type for the contract instance
export type IUniversalRouterInstance = ReturnType<typeof getIUniversalRouter>;

// Types for all read functions - using optional chaining for safety
export type IUniversalRouterReadFunctions = IUniversalRouterInstance extends { read: infer R }
  ? R
  : never;

// Types for all write functions - using optional chaining for safety
export type IUniversalRouterWriteFunctions = IUniversalRouterInstance extends { write: infer W }
  ? W
  : never;
