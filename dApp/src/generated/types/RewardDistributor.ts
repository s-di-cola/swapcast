// Auto-generated file - DO NOT EDIT!
import { createPublicClient, http, getContract, type Address } from 'viem';

// ABI with type inference when used with 'as const'
export const RewardDistributorAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'initialOwner',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_predictionManagerAddress',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'claimReward',
    inputs: [
      {
        name: 'tokenId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
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
    name: 'pause',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'paused',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
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
        internalType: 'contract IPredictionManagerForDistributor',
      },
    ],
    stateMutability: 'view',
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
    name: 'setPredictionManagerAddress',
    inputs: [
      {
        name: '_newAddress',
        type: 'address',
        internalType: 'address',
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
    type: 'function',
    name: 'unpause',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
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
    type: 'event',
    name: 'Paused',
    inputs: [
      {
        name: 'account',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'PredictionManagerAddressSet',
    inputs: [
      {
        name: 'oldAddress',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'newAddress',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'RewardClaimed',
    inputs: [
      {
        name: 'claimer',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'tokenId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Unpaused',
    inputs: [
      {
        name: 'account',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'ClaimFailedInPool',
    inputs: [
      {
        name: 'tokenId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'EnforcedPause',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ExpectedPause',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ImmutablePredictionManager',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidTokenId',
    inputs: [],
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
    name: 'ReentrancyGuardReentrantCall',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ZeroAddress',
    inputs: [],
  },
] as const;

/**
 * Function to get a typed contract instance
 */
export function getRewardDistributor({
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
    abi: RewardDistributorAbi,
    client,
  });
}

// Type for the contract instance
export type RewardDistributorInstance = ReturnType<typeof getRewardDistributor>;

// Types for all read functions - using optional chaining for safety
export type RewardDistributorReadFunctions = RewardDistributorInstance extends { read: infer R }
  ? R
  : never;

// Types for all write functions - using optional chaining for safety
export type RewardDistributorWriteFunctions = RewardDistributorInstance extends { write: infer W }
  ? W
  : never;
