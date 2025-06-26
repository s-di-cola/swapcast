// Auto-generated file - DO NOT EDIT!
import { createPublicClient, http, getContract, type Address } from 'viem';

// ABI with type inference when used with 'as const'
export const MarketLogicAbi = [
  {
    type: 'error',
    name: 'AlreadyPredictedL',
    inputs: [
      {
        name: 'user',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'marketId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'AmountCannotBeZeroL',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ClaimFailedNoStakeForOutcomeL',
    inputs: [
      {
        name: 'marketId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'outcome',
        type: 'uint8',
        internalType: 'uint8',
      },
    ],
  },
  {
    type: 'error',
    name: 'FeeTransferFailedL',
    inputs: [
      {
        name: 'treasuryAddress',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'MarketAlreadyResolvedL',
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
    name: 'MarketExpiredL',
    inputs: [
      {
        name: 'marketId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'expirationTime',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'currentTime',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'MarketNotResolvedL',
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
    name: 'MarketNotYetExpiredL',
    inputs: [
      {
        name: 'marketId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'expirationTime',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'currentTime',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'NotWinningNFTL',
    inputs: [
      {
        name: 'tokenId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'predictedOutcome',
        type: 'uint8',
        internalType: 'uint8',
      },
      {
        name: 'winningOutcome',
        type: 'uint8',
        internalType: 'uint8',
      },
    ],
  },
  {
    type: 'error',
    name: 'PriceOracleStaleL',
    inputs: [
      {
        name: 'lastUpdateTime',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'currentTime',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'maxStaleness',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'RewardTransferFailedL',
    inputs: [
      {
        name: 'recipient',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'StakeBelowMinimumL',
    inputs: [
      {
        name: 'sentAmount',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'minRequiredAmount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'ZeroAddressL',
    inputs: [
      {
        name: 'message',
        type: 'string',
        internalType: 'string',
      },
    ],
  },
  {
    type: 'error',
    name: 'ZeroNFTOwnerL',
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
    name: 'ZeroRewardAmountL',
    inputs: [
      {
        name: 'tokenId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
] as const;

/**
 * Function to get a typed contract instance
 */
export function getMarketLogic({
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
    abi: MarketLogicAbi,
    client,
  });
}

// Type for the contract instance
export type MarketLogicInstance = ReturnType<typeof getMarketLogic>;

// Types for all read functions - using optional chaining for safety
export type MarketLogicReadFunctions = MarketLogicInstance extends { read: infer R } ? R : never;

// Types for all write functions - using optional chaining for safety
export type MarketLogicWriteFunctions = MarketLogicInstance extends { write: infer W } ? W : never;
