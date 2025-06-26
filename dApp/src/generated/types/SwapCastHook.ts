// Auto-generated file - DO NOT EDIT!
import { createPublicClient, http, getContract, type Address } from 'viem';

// ABI with type inference when used with 'as const'
export const SwapCastHookAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: '_poolManager',
        type: 'address',
        internalType: 'contract IPoolManager',
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
    type: 'receive',
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'afterAddLiquidity',
    inputs: [
      {
        name: 'sender',
        type: 'address',
        internalType: 'address',
      },
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
        name: 'params',
        type: 'tuple',
        internalType: 'struct ModifyLiquidityParams',
        components: [
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
            name: 'liquidityDelta',
            type: 'int256',
            internalType: 'int256',
          },
          {
            name: 'salt',
            type: 'bytes32',
            internalType: 'bytes32',
          },
        ],
      },
      {
        name: 'delta',
        type: 'int256',
        internalType: 'BalanceDelta',
      },
      {
        name: 'feesAccrued',
        type: 'int256',
        internalType: 'BalanceDelta',
      },
      {
        name: 'hookData',
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
      {
        name: '',
        type: 'int256',
        internalType: 'BalanceDelta',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'afterDonate',
    inputs: [
      {
        name: 'sender',
        type: 'address',
        internalType: 'address',
      },
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
        name: 'amount0',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'amount1',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'hookData',
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
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'afterInitialize',
    inputs: [
      {
        name: 'sender',
        type: 'address',
        internalType: 'address',
      },
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
      {
        name: 'tick',
        type: 'int24',
        internalType: 'int24',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bytes4',
        internalType: 'bytes4',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'afterRemoveLiquidity',
    inputs: [
      {
        name: 'sender',
        type: 'address',
        internalType: 'address',
      },
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
        name: 'params',
        type: 'tuple',
        internalType: 'struct ModifyLiquidityParams',
        components: [
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
            name: 'liquidityDelta',
            type: 'int256',
            internalType: 'int256',
          },
          {
            name: 'salt',
            type: 'bytes32',
            internalType: 'bytes32',
          },
        ],
      },
      {
        name: 'delta',
        type: 'int256',
        internalType: 'BalanceDelta',
      },
      {
        name: 'feesAccrued',
        type: 'int256',
        internalType: 'BalanceDelta',
      },
      {
        name: 'hookData',
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
      {
        name: '',
        type: 'int256',
        internalType: 'BalanceDelta',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'afterSwap',
    inputs: [
      {
        name: 'sender',
        type: 'address',
        internalType: 'address',
      },
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
        name: 'params',
        type: 'tuple',
        internalType: 'struct SwapParams',
        components: [
          {
            name: 'zeroForOne',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'amountSpecified',
            type: 'int256',
            internalType: 'int256',
          },
          {
            name: 'sqrtPriceLimitX96',
            type: 'uint160',
            internalType: 'uint160',
          },
        ],
      },
      {
        name: 'delta',
        type: 'int256',
        internalType: 'BalanceDelta',
      },
      {
        name: 'hookData',
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
      {
        name: '',
        type: 'int128',
        internalType: 'int128',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'beforeAddLiquidity',
    inputs: [
      {
        name: 'sender',
        type: 'address',
        internalType: 'address',
      },
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
        name: 'params',
        type: 'tuple',
        internalType: 'struct ModifyLiquidityParams',
        components: [
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
            name: 'liquidityDelta',
            type: 'int256',
            internalType: 'int256',
          },
          {
            name: 'salt',
            type: 'bytes32',
            internalType: 'bytes32',
          },
        ],
      },
      {
        name: 'hookData',
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
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'beforeDonate',
    inputs: [
      {
        name: 'sender',
        type: 'address',
        internalType: 'address',
      },
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
        name: 'amount0',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'amount1',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'hookData',
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
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'beforeInitialize',
    inputs: [
      {
        name: 'sender',
        type: 'address',
        internalType: 'address',
      },
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
        type: 'bytes4',
        internalType: 'bytes4',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'beforeRemoveLiquidity',
    inputs: [
      {
        name: 'sender',
        type: 'address',
        internalType: 'address',
      },
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
        name: 'params',
        type: 'tuple',
        internalType: 'struct ModifyLiquidityParams',
        components: [
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
            name: 'liquidityDelta',
            type: 'int256',
            internalType: 'int256',
          },
          {
            name: 'salt',
            type: 'bytes32',
            internalType: 'bytes32',
          },
        ],
      },
      {
        name: 'hookData',
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
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'beforeSwap',
    inputs: [
      {
        name: 'sender',
        type: 'address',
        internalType: 'address',
      },
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
        name: 'params',
        type: 'tuple',
        internalType: 'struct SwapParams',
        components: [
          {
            name: 'zeroForOne',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'amountSpecified',
            type: 'int256',
            internalType: 'int256',
          },
          {
            name: 'sqrtPriceLimitX96',
            type: 'uint160',
            internalType: 'uint160',
          },
        ],
      },
      {
        name: 'hookData',
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
      {
        name: '',
        type: 'int256',
        internalType: 'BeforeSwapDelta',
      },
      {
        name: '',
        type: 'uint24',
        internalType: 'uint24',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getHookPermissions',
    inputs: [],
    outputs: [
      {
        name: 'permissions',
        type: 'tuple',
        internalType: 'struct Hooks.Permissions',
        components: [
          {
            name: 'beforeInitialize',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'afterInitialize',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'beforeAddLiquidity',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'afterAddLiquidity',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'beforeRemoveLiquidity',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'afterRemoveLiquidity',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'beforeSwap',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'afterSwap',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'beforeDonate',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'afterDonate',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'beforeSwapReturnDelta',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'afterSwapReturnDelta',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'afterAddLiquidityReturnDelta',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'afterRemoveLiquidityReturnDelta',
            type: 'bool',
            internalType: 'bool',
          },
        ],
      },
    ],
    stateMutability: 'pure',
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
    name: 'predictionManager',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IPredictionManager',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'recoverETH',
    inputs: [
      {
        name: '_to',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_amount',
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
    name: 'HookDataDebug',
    inputs: [
      {
        name: 'receivedLength',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'expectedLength',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'isUniversalRouter',
        type: 'bool',
        indexed: false,
        internalType: 'bool',
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
    name: 'PredictionAttempted',
    inputs: [
      {
        name: 'user',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'poolId',
        type: 'bytes32',
        indexed: true,
        internalType: 'PoolId',
      },
      {
        name: 'marketId',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'outcome',
        type: 'uint8',
        indexed: false,
        internalType: 'enum PredictionTypes.Outcome',
      },
      {
        name: 'convictionStake',
        type: 'uint128',
        indexed: false,
        internalType: 'uint128',
      },
      {
        name: 'swapAmount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'PredictionFailed',
    inputs: [
      {
        name: 'user',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'poolId',
        type: 'bytes32',
        indexed: true,
        internalType: 'PoolId',
      },
      {
        name: 'marketId',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'outcome',
        type: 'uint8',
        indexed: false,
        internalType: 'enum PredictionTypes.Outcome',
      },
      {
        name: 'convictionStake',
        type: 'uint128',
        indexed: false,
        internalType: 'uint128',
      },
      {
        name: 'swapAmount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'errorSelector',
        type: 'bytes4',
        indexed: false,
        internalType: 'bytes4',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'PredictionRecorded',
    inputs: [
      {
        name: 'user',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'poolId',
        type: 'bytes32',
        indexed: true,
        internalType: 'PoolId',
      },
      {
        name: 'marketId',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'outcome',
        type: 'uint8',
        indexed: false,
        internalType: 'enum PredictionTypes.Outcome',
      },
      {
        name: 'convictionStake',
        type: 'uint128',
        indexed: false,
        internalType: 'uint128',
      },
      {
        name: 'swapAmount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'ETHTransferFailed',
    inputs: [],
  },
  {
    type: 'error',
    name: 'HookNotImplemented',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InsufficientBalance',
    inputs: [
      {
        name: 'requested',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'available',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'InsufficientSwapAmountForStake',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidHookDataLength',
    inputs: [
      {
        name: 'actualLength',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'expectedLength',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'NotPoolManager',
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
    name: 'PredictionPoolZeroAddress',
    inputs: [],
  },
  {
    type: 'error',
    name: 'PredictionRecordingFailed',
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
    name: 'SafeCastOverflowedUintDowncast',
    inputs: [
      {
        name: 'bits',
        type: 'uint8',
        internalType: 'uint8',
      },
      {
        name: 'value',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
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
export function getSwapCastHook({
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
    abi: SwapCastHookAbi,
    client,
  });
}

// Type for the contract instance
export type SwapCastHookInstance = ReturnType<typeof getSwapCastHook>;

// Types for all read functions - using optional chaining for safety
export type SwapCastHookReadFunctions = SwapCastHookInstance extends { read: infer R } ? R : never;

// Types for all write functions - using optional chaining for safety
export type SwapCastHookWriteFunctions = SwapCastHookInstance extends { write: infer W }
  ? W
  : never;
