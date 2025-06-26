// Auto-generated file - DO NOT EDIT!
import { createPublicClient, http, getContract, type Address } from 'viem';

// ABI with type inference when used with 'as const'
export const IPoolInitializer_v4Abi = [
  {
    type: 'function',
    name: 'initializePool',
    inputs: [
      {
        name: 'key',
        type: 'tuple',
        internalType: 'struct PoolKey',
        components: [
          {
            name: 'currency0',
            type: 'address',
            internalType: 'Currency',
          },
          {
            name: 'currency1',
            type: 'address',
            internalType: 'Currency',
          },
          {
            name: 'fee',
            type: 'uint24',
            internalType: 'uint24',
          },
          {
            name: 'tickSpacing',
            type: 'int24',
            internalType: 'int24',
          },
          {
            name: 'hooks',
            type: 'address',
            internalType: 'contract IHooks',
          },
        ],
      },
      {
        name: 'sqrtPriceX96',
        type: 'uint160',
        internalType: 'uint160',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'int24',
        internalType: 'int24',
      },
    ],
    stateMutability: 'payable',
  },
] as const;

/**
 * Function to get a typed contract instance
 */
export function getIPoolInitializer_v4({
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
    abi: IPoolInitializer_v4Abi,
    client,
  });
}

// Type for the contract instance
export type IPoolInitializer_v4Instance = ReturnType<typeof getIPoolInitializer_v4>;

// Types for all read functions - using optional chaining for safety
export type IPoolInitializer_v4ReadFunctions = IPoolInitializer_v4Instance extends { read: infer R }
  ? R
  : never;

// Types for all write functions - using optional chaining for safety
export type IPoolInitializer_v4WriteFunctions = IPoolInitializer_v4Instance extends {
  write: infer W;
}
  ? W
  : never;
