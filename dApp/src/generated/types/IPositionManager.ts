// Auto-generated file - DO NOT EDIT!
import { createPublicClient, http, getContract, type Address } from 'viem';

// ABI with type inference when used with 'as const'
export const IPositionManagerAbi = [
  {
    type: 'function',
    name: 'DOMAIN_SEPARATOR',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPoolAndPositionInfo',
    inputs: [
      {
        name: 'tokenId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
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
        name: '',
        type: 'uint256',
        internalType: 'PositionInfo',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPositionLiquidity',
    inputs: [
      {
        name: 'tokenId',
        type: 'uint256',
        internalType: 'uint256',
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
  {
    type: 'function',
    name: 'modifyLiquidities',
    inputs: [
      {
        name: 'unlockData',
        type: 'bytes',
        internalType: 'bytes',
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
    type: 'function',
    name: 'modifyLiquiditiesWithoutUnlock',
    inputs: [
      {
        name: 'actions',
        type: 'bytes',
        internalType: 'bytes',
      },
      {
        name: 'params',
        type: 'bytes[]',
        internalType: 'bytes[]',
      },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'multicall',
    inputs: [
      {
        name: 'data',
        type: 'bytes[]',
        internalType: 'bytes[]',
      },
    ],
    outputs: [
      {
        name: 'results',
        type: 'bytes[]',
        internalType: 'bytes[]',
      },
    ],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'nextTokenId',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'nonces',
    inputs: [
      {
        name: 'owner',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'word',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'permit',
    inputs: [
      {
        name: 'spender',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'tokenId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'deadline',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'nonce',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'signature',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'permit',
    inputs: [
      {
        name: 'owner',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'permitSingle',
        type: 'tuple',
        internalType: 'struct IAllowanceTransfer.PermitSingle',
        components: [
          {
            name: 'details',
            type: 'tuple',
            internalType: 'struct IAllowanceTransfer.PermitDetails',
            components: [
              {
                name: 'token',
                type: 'address',
                internalType: 'address',
              },
              {
                name: 'amount',
                type: 'uint160',
                internalType: 'uint160',
              },
              {
                name: 'expiration',
                type: 'uint48',
                internalType: 'uint48',
              },
              {
                name: 'nonce',
                type: 'uint48',
                internalType: 'uint48',
              },
            ],
          },
          {
            name: 'spender',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'sigDeadline',
            type: 'uint256',
            internalType: 'uint256',
          },
        ],
      },
      {
        name: 'signature',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [
      {
        name: 'err',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'permitBatch',
    inputs: [
      {
        name: 'owner',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_permitBatch',
        type: 'tuple',
        internalType: 'struct IAllowanceTransfer.PermitBatch',
        components: [
          {
            name: 'details',
            type: 'tuple[]',
            internalType: 'struct IAllowanceTransfer.PermitDetails[]',
            components: [
              {
                name: 'token',
                type: 'address',
                internalType: 'address',
              },
              {
                name: 'amount',
                type: 'uint160',
                internalType: 'uint160',
              },
              {
                name: 'expiration',
                type: 'uint48',
                internalType: 'uint48',
              },
              {
                name: 'nonce',
                type: 'uint48',
                internalType: 'uint48',
              },
            ],
          },
          {
            name: 'spender',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'sigDeadline',
            type: 'uint256',
            internalType: 'uint256',
          },
        ],
      },
      {
        name: 'signature',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [
      {
        name: 'err',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'permitForAll',
    inputs: [
      {
        name: 'owner',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'operator',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'approved',
        type: 'bool',
        internalType: 'bool',
      },
      {
        name: 'deadline',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'nonce',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'signature',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [],
    stateMutability: 'payable',
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
    type: 'function',
    name: 'positionInfo',
    inputs: [
      {
        name: 'tokenId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'PositionInfo',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'revokeNonce',
    inputs: [
      {
        name: 'nonce',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'subscribe',
    inputs: [
      {
        name: 'tokenId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'newSubscriber',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'data',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'subscriber',
    inputs: [
      {
        name: 'tokenId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'subscriber',
        type: 'address',
        internalType: 'contract ISubscriber',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'unsubscribe',
    inputs: [
      {
        name: 'tokenId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'unsubscribeGasLimit',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'Subscription',
    inputs: [
      {
        name: 'tokenId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'subscriber',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Unsubscription',
    inputs: [
      {
        name: 'tokenId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'subscriber',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'AlreadySubscribed',
    inputs: [
      {
        name: 'tokenId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'subscriber',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'BurnNotificationReverted',
    inputs: [
      {
        name: 'subscriber',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'reason',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
  },
  {
    type: 'error',
    name: 'DeadlinePassed',
    inputs: [
      {
        name: 'deadline',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'GasLimitTooLow',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ModifyLiquidityNotificationReverted',
    inputs: [
      {
        name: 'subscriber',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'reason',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
  },
  {
    type: 'error',
    name: 'NoCodeSubscriber',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NoSelfPermit',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NonceAlreadyUsed',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NotApproved',
    inputs: [
      {
        name: 'caller',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'NotSubscribed',
    inputs: [],
  },
  {
    type: 'error',
    name: 'PoolManagerMustBeLocked',
    inputs: [],
  },
  {
    type: 'error',
    name: 'SignatureDeadlineExpired',
    inputs: [],
  },
  {
    type: 'error',
    name: 'SubscriptionReverted',
    inputs: [
      {
        name: 'subscriber',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'reason',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
  },
  {
    type: 'error',
    name: 'Unauthorized',
    inputs: [],
  },
] as const;

/**
 * Function to get a typed contract instance
 */
export function getIPositionManager({
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
    abi: IPositionManagerAbi,
    client,
  });
}

// Type for the contract instance
export type IPositionManagerInstance = ReturnType<typeof getIPositionManager>;

// Types for all read functions - using optional chaining for safety
export type IPositionManagerReadFunctions = IPositionManagerInstance extends { read: infer R }
  ? R
  : never;

// Types for all write functions - using optional chaining for safety
export type IPositionManagerWriteFunctions = IPositionManagerInstance extends { write: infer W }
  ? W
  : never;
