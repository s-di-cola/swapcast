// Auto-generated file - DO NOT EDIT!
import { createPublicClient, http, getContract, type Address } from 'viem';

// ABI with type inference when used with 'as const'
export const StateViewAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: '_poolManager',
        type: 'address',
        internalType: 'contract IPoolManager',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getFeeGrowthGlobals',
    inputs: [
      {
        name: 'poolId',
        type: 'bytes32',
        internalType: 'PoolId',
      },
    ],
    outputs: [
      {
        name: 'feeGrowthGlobal0',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'feeGrowthGlobal1',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getFeeGrowthInside',
    inputs: [
      {
        name: 'poolId',
        type: 'bytes32',
        internalType: 'PoolId',
      },
      {
        name: 'tickLower',
        type: 'int24',
        internalType: 'int24',
      },
      {
        name: 'tickUpper',
        type: 'int24',
        internalType: 'int24',
      },
    ],
    outputs: [
      {
        name: 'feeGrowthInside0X128',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'feeGrowthInside1X128',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getLiquidity',
    inputs: [
      {
        name: 'poolId',
        type: 'bytes32',
        internalType: 'PoolId',
      },
    ],
    outputs: [
      {
        name: 'liquidity',
        type: 'uint128',
        internalType: 'uint128',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPositionInfo',
    inputs: [
      {
        name: 'poolId',
        type: 'bytes32',
        internalType: 'PoolId',
      },
      {
        name: 'positionId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [
      {
        name: 'liquidity',
        type: 'uint128',
        internalType: 'uint128',
      },
      {
        name: 'feeGrowthInside0LastX128',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'feeGrowthInside1LastX128',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPositionInfo',
    inputs: [
      {
        name: 'poolId',
        type: 'bytes32',
        internalType: 'PoolId',
      },
      {
        name: 'owner',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'tickLower',
        type: 'int24',
        internalType: 'int24',
      },
      {
        name: 'tickUpper',
        type: 'int24',
        internalType: 'int24',
      },
      {
        name: 'salt',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [
      {
        name: 'liquidity',
        type: 'uint128',
        internalType: 'uint128',
      },
      {
        name: 'feeGrowthInside0LastX128',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'feeGrowthInside1LastX128',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPositionLiquidity',
    inputs: [
      {
        name: 'poolId',
        type: 'bytes32',
        internalType: 'PoolId',
      },
      {
        name: 'positionId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [
      {
        name: 'liquidity',
        type: 'uint128',
        internalType: 'uint128',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getSlot0',
    inputs: [
      {
        name: 'poolId',
        type: 'bytes32',
        internalType: 'PoolId',
      },
    ],
    outputs: [
      {
        name: 'sqrtPriceX96',
        type: 'uint160',
        internalType: 'uint160',
      },
      {
        name: 'tick',
        type: 'int24',
        internalType: 'int24',
      },
      {
        name: 'protocolFee',
        type: 'uint24',
        internalType: 'uint24',
      },
      {
        name: 'lpFee',
        type: 'uint24',
        internalType: 'uint24',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getTickBitmap',
    inputs: [
      {
        name: 'poolId',
        type: 'bytes32',
        internalType: 'PoolId',
      },
      {
        name: 'tick',
        type: 'int16',
        internalType: 'int16',
      },
    ],
    outputs: [
      {
        name: 'tickBitmap',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getTickFeeGrowthOutside',
    inputs: [
      {
        name: 'poolId',
        type: 'bytes32',
        internalType: 'PoolId',
      },
      {
        name: 'tick',
        type: 'int24',
        internalType: 'int24',
      },
    ],
    outputs: [
      {
        name: 'feeGrowthOutside0X128',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'feeGrowthOutside1X128',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getTickInfo',
    inputs: [
      {
        name: 'poolId',
        type: 'bytes32',
        internalType: 'PoolId',
      },
      {
        name: 'tick',
        type: 'int24',
        internalType: 'int24',
      },
    ],
    outputs: [
      {
        name: 'liquidityGross',
        type: 'uint128',
        internalType: 'uint128',
      },
      {
        name: 'liquidityNet',
        type: 'int128',
        internalType: 'int128',
      },
      {
        name: 'feeGrowthOutside0X128',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'feeGrowthOutside1X128',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getTickLiquidity',
    inputs: [
      {
        name: 'poolId',
        type: 'bytes32',
        internalType: 'PoolId',
      },
      {
        name: 'tick',
        type: 'int24',
        internalType: 'int24',
      },
    ],
    outputs: [
      {
        name: 'liquidityGross',
        type: 'uint128',
        internalType: 'uint128',
      },
      {
        name: 'liquidityNet',
        type: 'int128',
        internalType: 'int128',
      },
    ],
    stateMutability: 'view',
  },
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
    name: 'NotPoolManager',
    inputs: [],
  },
] as const;

/**
 * Function to get a typed contract instance
 */
export function getStateView({
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
    abi: StateViewAbi,
    client,
  });
}

// Type for the contract instance
export type StateViewInstance = ReturnType<typeof getStateView>;

// Types for all read functions - using optional chaining for safety
export type StateViewReadFunctions = StateViewInstance extends { read: infer R } ? R : never;

// Types for all write functions - using optional chaining for safety
export type StateViewWriteFunctions = StateViewInstance extends { write: infer W } ? W : never;
