// Auto-generated file - DO NOT EDIT!
import { createPublicClient, http, getContract, type Address } from 'viem';

// ABI with type inference when used with 'as const'
export const PredictionManagerAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: '_initialOwner',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_swapCastNFTAddress',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_treasuryAddress',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_initialFeeBasisPoints',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: '_initialMinStakeAmount',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: '_maxPriceStalenessSeconds',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: '_oracleResolverAddress',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_rewardDistributorAddress',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'INK_CHAIN_ID',
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
    name: 'MARKET_EXPIRED_SIGNATURE',
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
    name: 'MAX_BASIS_POINTS',
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
    name: 'automationProvider',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint8',
        internalType: 'enum IPredictionManager.AutomationProvider',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'checkLog',
    inputs: [
      {
        name: '_log',
        type: 'tuple',
        internalType: 'struct Log',
        components: [
          {
            name: 'index',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'timestamp',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'txHash',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'blockNumber',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'blockHash',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'source',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'topics',
            type: 'bytes32[]',
            internalType: 'bytes32[]',
          },
          {
            name: 'data',
            type: 'bytes',
            internalType: 'bytes',
          },
        ],
      },
      {
        name: '',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [
      {
        name: 'upkeepNeeded',
        type: 'bool',
        internalType: 'bool',
      },
      {
        name: 'performData',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'checkUpkeep',
    inputs: [
      {
        name: '',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [
      {
        name: 'upkeepNeeded',
        type: 'bool',
        internalType: 'bool',
      },
      {
        name: 'performData',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'checker',
    inputs: [],
    outputs: [
      {
        name: 'canExec',
        type: 'bool',
        internalType: 'bool',
      },
      {
        name: 'execPayload',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'claimReward',
    inputs: [
      {
        name: '_tokenId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'createMarket',
    inputs: [
      {
        name: '_name',
        type: 'string',
        internalType: 'string',
      },
      {
        name: '_assetSymbol',
        type: 'string',
        internalType: 'string',
      },
      {
        name: '_expirationTime',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: '_priceAggregator',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_priceThreshold',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: '_poolKey',
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
    ],
    outputs: [
      {
        name: 'marketId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'defaultMarketMinStake',
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
    name: 'getActiveMarkets',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256[]',
        internalType: 'uint256[]',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getExpiredMarkets',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256[]',
        internalType: 'uint256[]',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getMarketCount',
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
    name: 'getMarketDetails',
    inputs: [
      {
        name: '_marketId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'marketId_',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'name_',
        type: 'string',
        internalType: 'string',
      },
      {
        name: 'assetSymbol_',
        type: 'string',
        internalType: 'string',
      },
      {
        name: 'exists_',
        type: 'bool',
        internalType: 'bool',
      },
      {
        name: 'resolved_',
        type: 'bool',
        internalType: 'bool',
      },
      {
        name: 'winningOutcome_',
        type: 'uint8',
        internalType: 'enum PredictionTypes.Outcome',
      },
      {
        name: 'totalConvictionStakeOutcome0_',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'totalConvictionStakeOutcome1_',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'expirationTime_',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'priceAggregator_',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'priceThreshold_',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getMarketIdAtIndex',
    inputs: [
      {
        name: '_index',
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
    name: 'getMarketIdByTokenId',
    inputs: [
      {
        name: '_tokenId',
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
    name: 'getPredictionDetailsByTokenId',
    inputs: [
      {
        name: '_tokenId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'marketId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'outcome',
        type: 'uint8',
        internalType: 'enum PredictionTypes.Outcome',
      },
      {
        name: 'convictionStake',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'owner',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'isResolved',
        type: 'bool',
        internalType: 'bool',
      },
      {
        name: 'winningOutcome',
        type: 'uint8',
        internalType: 'enum PredictionTypes.Outcome',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getUserHasPredicted',
    inputs: [
      {
        name: '_marketId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: '_user',
        type: 'address',
        internalType: 'address',
      },
    ],
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
    name: 'isMarketExpired',
    inputs: [
      {
        name: 'marketId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
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
    name: 'marketIdToPoolKey',
    inputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
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
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'marketMinStakes',
    inputs: [
      {
        name: '',
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
    name: 'minStakeAmount',
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
    name: 'onERC721Received',
    inputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: '',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bytes4',
        internalType: 'bytes4',
      },
    ],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'oracleResolverAddress',
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
    name: 'performGelatoUpkeep',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'performGelatoUpkeepWithIds',
    inputs: [
      {
        name: 'expiredMarketIds',
        type: 'uint256[]',
        internalType: 'uint256[]',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'performUpkeep',
    inputs: [
      {
        name: 'performData',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'protocolFeeBasisPoints',
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
    name: 'recordPrediction',
    inputs: [
      {
        name: '_user',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_marketId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: '_outcome',
        type: 'uint8',
        internalType: 'enum PredictionTypes.Outcome',
      },
      {
        name: '_convictionStakeDeclared',
        type: 'uint128',
        internalType: 'uint128',
      },
    ],
    outputs: [],
    stateMutability: 'payable',
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
      {
        name: '_winningOutcome',
        type: 'uint8',
        internalType: 'enum PredictionTypes.Outcome',
      },
      {
        name: '_oraclePrice',
        type: 'int256',
        internalType: 'int256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'resolveMarketManual',
    inputs: [
      {
        name: 'marketId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'rewardDistributorAddress',
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
    name: 'setDefaultMarketMinStake',
    inputs: [
      {
        name: '_newDefaultMinStake',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setFeeConfiguration',
    inputs: [
      {
        name: '_newTreasuryAddress',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_newFeeBasisPoints',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setMarketMinStake',
    inputs: [
      {
        name: '_marketId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: '_marketMinStake',
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
    name: 'setMinStakeAmount',
    inputs: [
      {
        name: '_newMinStakeAmount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setOracleResolverAddress',
    inputs: [
      {
        name: '_newOracleResolverAddress',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setRewardDistributorAddress',
    inputs: [
      {
        name: '_newRewardDistributorAddress',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'swapCastNFT',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract ISwapCastNFT',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'tokenIdToMarketId',
    inputs: [
      {
        name: '',
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
    name: 'treasuryAddress',
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
    type: 'event',
    name: 'DefaultMarketMinStakeChanged',
    inputs: [
      {
        name: 'newDefaultMinStake',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'FeeConfigurationChanged',
    inputs: [
      {
        name: 'newTreasuryAddress',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'newFeeBasisPoints',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'FeePaid',
    inputs: [
      {
        name: 'marketId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'user',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'protocolFee',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'MarketCreated',
    inputs: [
      {
        name: 'marketId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'name',
        type: 'string',
        indexed: false,
        internalType: 'string',
      },
      {
        name: 'assetSymbol',
        type: 'string',
        indexed: false,
        internalType: 'string',
      },
      {
        name: 'expirationTime',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'priceAggregator',
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
    name: 'MarketExpired',
    inputs: [
      {
        name: 'marketId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'expirationTimestamp',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'MarketMinStakeChanged',
    inputs: [
      {
        name: 'marketId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'marketMinStake',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'MarketResolutionFailed',
    inputs: [
      {
        name: 'marketId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'reason',
        type: 'string',
        indexed: false,
        internalType: 'string',
      },
    ],
    anonymous: false,
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
        name: 'winningOutcome',
        type: 'uint8',
        indexed: false,
        internalType: 'enum PredictionTypes.Outcome',
      },
      {
        name: 'price',
        type: 'int256',
        indexed: false,
        internalType: 'int256',
      },
      {
        name: 'totalPrizePool',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'MinStakeAmountChanged',
    inputs: [
      {
        name: 'newMinStakeAmount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'OracleResolverAddressSet',
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
    name: 'RewardClaimed',
    inputs: [
      {
        name: 'user',
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
      {
        name: 'rewardAmount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'RewardDistributorAddressSet',
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
    name: 'StakeRecorded',
    inputs: [
      {
        name: 'marketId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'user',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'outcome',
        type: 'uint8',
        indexed: false,
        internalType: 'enum PredictionTypes.Outcome',
      },
      {
        name: 'amount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'tokenId',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'AlreadyPredicted',
    inputs: [
      {
        name: 'marketId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'user',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
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
    name: 'AmountCannotBeZero',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AmountCannotBeZeroL',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ClaimFailedNoStakeForOutcome',
    inputs: [
      {
        name: 'marketId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'outcomeIndex',
        type: 'uint8',
        internalType: 'uint8',
      },
    ],
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
    name: 'EmptyMarketName',
    inputs: [],
  },
  {
    type: 'error',
    name: 'FeeTransferFailed',
    inputs: [
      {
        name: 'to',
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
    name: 'InvalidAssetSymbol',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidExpirationTime',
    inputs: [
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
    name: 'InvalidFeeBasisPoints',
    inputs: [
      {
        name: 'feeBasisPoints',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'InvalidMarketId',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidMinStakeAmount',
    inputs: [
      {
        name: 'minStakeAmount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'InvalidPoolKey',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidPriceAggregator',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidPriceData',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidPriceThreshold',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidUpkeepData',
    inputs: [
      {
        name: 'reason',
        type: 'string',
        internalType: 'string',
      },
    ],
  },
  {
    type: 'error',
    name: 'MarketAlreadyExists',
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
    name: 'MarketAlreadyResolved',
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
    name: 'MarketDoesNotExist',
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
    name: 'MarketNotResolved',
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
    name: 'NotOracleResolver',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NotRewardDistributor',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NotWinningNFT',
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
    name: 'OnlyChainlinkAutomation',
    inputs: [],
  },
  {
    type: 'error',
    name: 'OnlyGelatoAutomation',
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
    name: 'PriceAtThreshold',
    inputs: [],
  },
  {
    type: 'error',
    name: 'PriceOracleStale',
    inputs: [
      {
        name: 'lastUpdatedAt',
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
    name: 'ResolutionFailedOracleError',
    inputs: [],
  },
  {
    type: 'error',
    name: 'RewardTransferFailed',
    inputs: [
      {
        name: 'to',
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
    name: 'StakeBelowMinimum',
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
    name: 'StakeMismatch',
    inputs: [
      {
        name: 'actual',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'declared',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'ZeroAddressInput',
    inputs: [],
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
export function getPredictionManager({
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
    abi: PredictionManagerAbi,
    client,
  });
}

// Type for the contract instance
export type PredictionManagerInstance = ReturnType<typeof getPredictionManager>;

// Types for all read functions - using optional chaining for safety
export type PredictionManagerReadFunctions = PredictionManagerInstance extends { read: infer R }
  ? R
  : never;

// Types for all write functions - using optional chaining for safety
export type PredictionManagerWriteFunctions = PredictionManagerInstance extends { write: infer W }
  ? W
  : never;
