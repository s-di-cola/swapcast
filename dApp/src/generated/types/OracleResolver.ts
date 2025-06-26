// Auto-generated file - DO NOT EDIT!
import { createPublicClient, http, getContract, type Address } from 'viem';

// ABI with type inference when used with 'as const'
export const OracleResolverAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: '_predictionManagerAddress',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_feedRegistryAddress',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'initialOwner',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'feedRegistry',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IFeedRegistry',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'marketOracles',
    inputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'baseToken',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'quoteToken',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'priceThreshold',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'isRegistered',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'maxPriceStalenessSeconds',
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
    name: 'owner',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'predictionManager',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IPredictionManagerForResolver',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'registerOracle',
    inputs: [
      {
        name: '_marketId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: '_baseToken',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_quoteToken',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_priceThreshold',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'renounceOwnership',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'resolveMarket',
    inputs: [
      {
        name: '_marketId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setMaxPriceStaleness',
    inputs: [
      {
        name: '_newStalenessSeconds',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'transferOwnership',
    inputs: [
      {
        name: 'newOwner',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'MarketResolved',
    inputs: [
      {
        name: 'marketId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'price',
        type: 'int256',
        indexed: false,
        internalType: 'int256',
      },
      {
        name: 'winningOutcome',
        type: 'uint8',
        indexed: false,
        internalType: 'enum PredictionTypes.Outcome',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'MaxPriceStalenessSet',
    inputs: [
      {
        name: 'oldStaleness',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'newStaleness',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'OracleRegistered',
    inputs: [
      {
        name: 'marketId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'baseToken',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
      {
        name: 'quoteToken',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
      {
        name: 'priceThreshold',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'OwnershipTransferred',
    inputs: [
      {
        name: 'previousOwner',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'newOwner',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'FeedRegistryNotSet',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidPrice',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidPriceThreshold',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidRound',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidTokenAddress',
    inputs: [],
  },
  {
    type: 'error',
    name: 'OracleAlreadyRegistered',
    inputs: [
      {
        name: 'marketId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'OracleNotRegistered',
    inputs: [
      {
        name: 'marketId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'OwnableInvalidOwner',
    inputs: [
      {
        name: 'owner',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'OwnableUnauthorizedAccount',
    inputs: [
      {
        name: 'account',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'PredictionManagerZeroAddress',
    inputs: [],
  },
  {
    type: 'error',
    name: 'PriceIsStale',
    inputs: [
      {
        name: 'marketId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'lastUpdatedAt',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'currentBlockTimestamp',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'ResolutionFailedInManager',
    inputs: [
      {
        name: 'marketId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'StaleRound',
    inputs: [],
  },
] as const;

/**
 * Function to get a typed contract instance
 */
export function getOracleResolver({
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
    abi: OracleResolverAbi,
    client,
  });
}

// Type for the contract instance
export type OracleResolverInstance = ReturnType<typeof getOracleResolver>;

// Types for all read functions - using optional chaining for safety
export type OracleResolverReadFunctions = OracleResolverInstance extends { read: infer R }
  ? R
  : never;

// Types for all write functions - using optional chaining for safety
export type OracleResolverWriteFunctions = OracleResolverInstance extends { write: infer W }
  ? W
  : never;
