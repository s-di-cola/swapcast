# SwapCast: A Market Intelligence & Prediction Layer for Uniswap v4

SwapCast transforms Uniswap v4 pools into dual-purpose infrastructure: maintaining efficient swap execution while simultaneously generating valuable market intelligence through incentivized predictions.

This protocol enables traders to include market predictions alongside their swaps, with transaction value serving as conviction weight. By aggregating these signals, SwapCast creates an on-chain "wisdom-of-crowds" mechanism backed by genuine financial commitment.

Unlike standalone prediction markets that struggle with liquidity fragmentation, SwapCast leverages Uniswap's substantial trading volume to generate high-quality market sentiment data while rewarding accurate predictors.

---

## 🚀 Getting Started

### Prerequisites
- Docker installed and running
- Node.js (v18+) and npm

### Quick Setup
To get the complete SwapCast system running locally with contracts and dApp:

```bash
git clone [repository-url]
cd swapcast
cd dApp
npm install
npm run dev:with-contracts
```

This single command will:
1. Start local blockchain infrastructure with Docker
2. Deploy all SwapCast contracts
3. Set up the development environment
4. Launch the SvelteKit dApp interface at `http://localhost:5173`

The `dev:with-contracts` script handles the complete setup including contract deployment, market creation, and dApp configuration.

---

## 🔍 Key Features

- **Seamless Swap Integration**: Captures prediction data during standard swap execution.
- **Conviction Weighting**: Uses actual transaction values to weight market signals.
- **Automated Resolution**: Leverages Chainlink Automation for trustless prediction resolution.
- **Dual-sided Markets**: Creates balanced markets with configurable odds ratios.
- **Position NFTs**: Issues unique SwapCast NFTs as proof of prediction positions.
- **Reward Distribution**: Pull-based mechanism for winners to claim rewards.

---

## 📊 Conviction Weight & Reward Mathematics

### Conviction Weight Calculation

The conviction weight of a prediction is derived from the swap amount, aligning financial commitment and market signal strength:

1. **Base Weight Calculation:**
   ```
   convictionWeight = swapAmount * convictionFactor
   ```
   Where `convictionFactor` is typically 0.01 (1%).

2. **Effective Market Influence:**
   ```
   marketInfluence = convictionWeight / totalSideWeight
   ```

3. **Market Odds Adjustment:**
   ```
   bullProbability = totalBullWeight / (totalBullWeight + totalBearWeight)
   bearProbability = totalBearWeight / (totalBullWeight + totalBearWeight)
   ```

4. **Logarithmic Scaling (Optional):**
   ```
   adjustedWeight = baseWeight * (1 + log10(swapAmount / minimumSwap))
   ```

### Reward Distribution Mathematics

Rewards are calculated using a pari-mutuel betting model, adjusted for protocol fees:

1. **Total Pool Calculation:**
   ```
   totalPool = totalBullWeight + totalBearWeight
   ```

2. **Fee Application:**
   ```
   protocolFee = totalPool * (protocolFeeBasisPoints / 10000)
   distributablePool = totalPool - protocolFee
   ```
   Where `protocolFeeBasisPoints` is configurable (typically 500 = 5%).

3. **Winner's Reward:**
   ```
   reward = (convictionWeight / totalWinningWeight) * (distributablePool)
   ```

4. **Net Payout:**
   ```
   netPayout = reward
   ```

5. **Example Calculation:**
   - Total Bull Predictions: 1000 USDC
   - Total Bear Predictions: 3000 USDC
   - Protocol Fee: 5%
   - Trader's Bull Position: 100 USDC

   If the Bull outcome is correct:
   - Distributable Pool: (1000 + 3000) * 0.95 = 3800 USDC
   - Trader's Share: (100 / 1000) * 3800 = 380 USDC (plus original 100 USDC stake)

---

## 💡 Core Prediction & Staking Model

SwapCast's core innovation lies in seamlessly integrating a prediction mechanism directly into the Uniswap v4 swap event. This allows traders to act on their market conviction at the precise moment of a trade.

### Staking Mechanism

Predictions are staked using **ETH** with a dual-component payment structure:

**Payment Structure:**
Users send ETH that covers both their conviction stake AND protocol fees:
```
totalPayment = convictionStake + (convictionStake * protocolFeeBasisPoints / 10000)
```

**Why ETH Staking?**
- **Simplicity & Speed of Development:** Managing a single, common asset like ETH for prize pools and stake accounting is significantly simpler and allows for more rapid development and a polished core feature delivery.
- **Universal Medium of Conviction:** ETH serves as a universal and liquid asset for users to express their financial conviction across various prediction markets offered by SwapCast.
- **Focus on Core Innovation:** The primary novelty is the *swap-triggered prediction*. Using ETH for staking allows us to highlight this core mechanism effectively.

**How it Works:**
1. A user performs a swap (e.g., USDC for WETH).
2. Alongside the swap, they specify their prediction (e.g., WETH will go up against USD) and the amount of **ETH** they wish to stake on this prediction.
3. The total ETH amount (stake + protocol fee) is transferred to the `PredictionManager` contract.
4. The protocol fee is immediately sent to the Treasury contract.
5. The net stake is held until the market resolves.
6. The `SwapCastHook` facilitates this, ensuring the correct ETH amount is forwarded.

### Bearish Predictions & Use Cases

Even when acquiring an asset (e.g., Token B), a user might make a bearish prediction on it. This serves several purposes:

- **Hedging Utility:** If a user acquires Token B for its utility but is concerned about short-term price drops, a bearish ETH-staked prediction can help offset potential losses.
- **Relative Value Plays:** A user might swap from Token A (believed to perform very poorly) to Token B (believed to perform less poorly, but still expected to decline against a benchmark like USD).
- The prediction market itself is typically defined against a stable benchmark (e.g., "Token X price vs. USD") rather than the other token in the swap pair, making bearish predictions on the acquired asset logical.

### Future Considerations

**Staking with the Swapped Asset:** A potential future enhancement could involve allowing users to stake a portion of the asset they receive from the swap. This would tie the "skin in the game" even more directly to the specific asset being predicted upon. However, this introduces significant architectural complexity (multi-asset prize pools, oracle dependencies for value comparison, etc.).

---

## Protocol Architecture

SwapCast is composed of several modular contracts that together provide a secure, upgradable, and transparent prediction market layer on top of Uniswap v4.

### Key Components

- **SwapCastHook:** Intercepts Uniswap v4 swap transactions, extracts prediction data, and forwards them to the PredictionManager.
- **PredictionManager:** Manages prediction markets, positions, stakes, and NFT issuance, and pays rewards. Coordinates with other system components.
- **MarketLogic Library:** Contains the core business logic for prediction markets, including prediction recording, market resolution, and reward calculations. This modular approach improves code organization and gas efficiency.
- **SwapCastNFT:** ERC721 NFT representing prediction positions, with full on-chain metadata generation.
- **OracleResolver:** Registers price feeds for markets and resolves prediction markets using price data. Supports multiple oracle providers:
   - **Chainlink Integration:** Primary oracle solution with Feed Registry support
   - **Pyth Network Integration:** Alternative oracle for chains with limited Chainlink support
- **RewardDistributor:** Handles reward claim logic and validates claims, interacting with the PredictionManager for reward payouts.
- **Treasury:** Collects and holds all protocol fees from predictions made in the PredictionManager.
- **Automated Resolution:** Multi-provider automation system:
   - **Chainlink Automation:** Time-based and log-based automation for supported chains
   - **Gelato Network:** Alternative automation solution for chains like Ink that don't yet support Chainlink

---

### Market Creation Process

Markets are created through a comprehensive setup process:

1. **Contract Owner Deployment:**
   - Owner calls `createMarket()` with market parameters
   - Sets up Chainlink price aggregator for the asset pair
   - Configures price threshold for outcome determination
   - Associates market with Uniswap V4 PoolKey
   - Sets market-specific minimum stake requirements

2. **Oracle Registration:**
   - OracleResolver registers price feeds from multiple providers:
      - **Chainlink:** Primary oracle with Feed Registry integration
      - **Pyth Network:** Alternative oracle for broader chain support
   - Configures base/quote token pair (e.g., ETH/USD)
   - Sets price staleness limits for data freshness

3. **Automation Setup:**
   - **Chainlink Automation:** For supported chains (Ethereum, Polygon, etc.)
   - **Gelato Network:** For emerging chains like Ink that lack Chainlink support
   - Configures monitoring for market expiration

4. **Market Activation:**
   - Market becomes available for predictions until expiration
   - Users can make predictions during swaps
   - Automated systems monitor for expiration across all supported chains

### Fee Structure

- **Configurable Protocol Fees:** Fee rates are set via `protocolFeeBasisPoints` (not fixed)
- **Fee Calculation:** `fee = convictionStake * protocolFeeBasisPoints / 10000`
- **Default Rate:** Set at contract deployment (typically 500 basis points = 5%)
- **Fee Updates:** Can be modified by contract owner
- **Immediate Transfer:** Protocol fees are sent directly to Treasury upon prediction

---

### Funds Flow

1. **Prediction Creation:**
   - User pays total amount (stake + protocol fee) during swap
   - **SwapCastHook** calculates the total amount and forwards it to the **PredictionManager**
   - **PredictionManager** immediately transfers the protocol fee to the **Treasury** contract
   - **PredictionManager** holds the net conviction stake for potential reward payouts
   - **SwapCastNFT** is minted with prediction metadata

2. **Market Resolution:**
   - **Multi-Chain Automation:**
      - **Chainlink Networks:** Time-based checking detects expired markets, emits `MarketExpired` events, log-based automation triggers resolution
      - **Gelato Networks:** Alternative automation for chains like Ink without Chainlink support
   - **Multi-Oracle Price Fetching:**
      - **OracleResolver** fetches price data from available providers (Chainlink Feed Registry or Pyth Network)
      - **OracleResolver** determines winning outcome and calls **PredictionManager**
      - **MarketLogic** library handles the resolution logic

3. **Reward Claim:**
   - Winner calls `claimReward(tokenId)` via the **RewardDistributor**
   - **RewardDistributor** forwards the claim to the **PredictionManager**
   - **PredictionManager** uses **MarketLogic** to verify the claim and calculate rewards
   - **MarketLogic** burns the associated NFT and transfers rewards directly to the winner
   - Rewards come from the pool of conviction stakes held by **PredictionManager**

---

## 📐 Architecture Documentation

SwapCast uses the C4 model for visualizing and documenting software architecture. The C4 model provides a way to create maps of your code at various levels of detail:

- **Context Diagrams:** High-level view showing how the system fits into the world.
- **Container Diagrams:** Show the high-level technical building blocks.
- **Component Diagrams:** Decompose each container into components.
- **Sequence Diagrams:** Illustrate how components interact to implement key scenarios.

Complete architecture documentation can be found in the [c4_architecture](docs/c4_architecture) folder.

---

## 🔄 How It Works

### Prediction Creation Flow

1. A trader makes a swap on Uniswap v4 (e.g., USDC to ETH).
2. The trader includes prediction parameters in hookData (market ID, outcome, conviction stake).
3. The trader sends ETH covering both stake and protocol fee.
4. The SwapCast Hook captures this data and forwards it to the PredictionManager.
5. PredictionManager transfers protocol fee to Treasury and holds the conviction stake.
6. The trader receives a SwapCast NFT as proof of their prediction, with all details stored in on-chain metadata.

### Why NFTs (ERC721) Instead of ERC20 Tokens

- **Rich Metadata:** Each NFT stores complete prediction details (market ID, outcome, conviction stake, timestamp) with full on-chain JSON generation.
- **Unique Positions:** Each prediction is a unique position with specific parameters.
- **Simplified UX:** No need for complex token naming conventions or fragmented balances.
- **Visual Representation:** NFTs can be visually represented in wallets and marketplaces with custom attributes.
- **Ownership Verification:** Simplifies the reward claiming process and eliminates double-spending.

### Market Resolution Flow

1. **Multi-Chain Monitoring:**
   - **Chainlink Automation** regularly checks for expired markets via `checkUpkeep()` on supported chains
   - **Gelato Network** provides automation for chains like Ink that don't yet support Chainlink
2. **Event Emission:** When markets expire, `MarketExpired` events are emitted.
3. **Automated Triggering:**
   - **Chainlink:** Log-based automation listens for `MarketExpired` events via `checkLog()`
   - **Gelato:** Task-based automation triggers resolution workflows
4. **Automatic Resolution:** `performUpkeep()` or Gelato tasks trigger `_triggerMarketResolution()`.
5. **Multi-Oracle Price Fetching:**
   - **Primary:** Chainlink Feed Registry for established chains
   - **Fallback:** Pyth Network for broader chain coverage
6. **Outcome Determination:** Price is compared to market threshold to determine winning outcome.
7. **Market Finalization:** MarketLogic handles the resolution and enables reward claims.

### Pull-Based Reward Mechanism

1. Winners must actively claim their rewards by calling `RewardDistributor.claimReward(tokenId)`.
2. They must own the SwapCast NFT representing their prediction.
3. The system verifies:
   - Market has been resolved
   - User owns the position NFT
   - Position matches the winning outcome
   - NFT data matches market records
4. MarketLogic calculates proportional rewards based on conviction stake and total winning pool.
5. Position NFT is burned upon successful claim.
6. Rewards are transferred directly to the winner's address.

---

## 📊 Example User Flow

1. **Alice swaps 1000 USDC for ETH**
   - She predicts ETH will exceed $5000 by June 30
   - Her conviction stake: 10 ETH
   - Protocol fee (5%): 0.5 ETH
   - Total payment: 10.5 ETH
   - The SwapCastHook forwards her prediction data and 10.5 ETH to PredictionManager
   - PredictionManager sends 0.5 ETH to Treasury, holds 10 ETH for rewards
   - She receives ETH (from swap) and SwapCastNFT with prediction metadata

2. **Bob swaps 2000 USDC for ETH**
   - He predicts ETH will NOT exceed $5000 by June 30
   - His conviction stake: 20 ETH
   - Protocol fee (5%): 1 ETH
   - Total payment: 21 ETH
   - Similar process: 1 ETH to Treasury, 20 ETH held for rewards
   - He receives ETH (from swap) and SwapCastNFT with prediction metadata

3. **June 30 arrives**
   - **Multi-Chain Automation Detection:**
      - **Chainlink Networks:** Automation detects market expiration via `checkUpkeep()`, emits `MarketExpired` event, triggers `performUpkeep()` via `checkLog()`
      - **Gelato Networks:** Task automation detects expiration and triggers resolution on chains like Ink
   - **Multi-Oracle Price Resolution:**
      - **OracleResolver** fetches current ETH price from available oracle (Chainlink Feed Registry or Pyth Network)
      - Price comparison determines outcome: ETH > $5000 = Bullish wins, ETH < $5000 = Bearish wins
      - **MarketLogic** updates market status to resolved

4. **Rewards are claimed**
   - Winners call `RewardDistributor.claimReward(tokenId)`
   - RewardDistributor forwards to `PredictionManager.claimReward(tokenId)`
   - MarketLogic verifies NFT ownership and calculates proportional rewards
   - Winner receives their original stake + proportional share of losing pool
   - NFT is burned after successful claim

---

## 🔒 Security Features

SwapCast implements several security features across its contracts to ensure the safety of user funds and the integrity of the prediction markets:

### Contract-Level Security

- **Immutable References**: Critical contract addresses like the PredictionManager in SwapCastHook and RewardDistributor are set as immutable, preventing changes after deployment.
- **Reentrancy Protection**: Treasury and RewardDistributor use OpenZeppelin's ReentrancyGuard to prevent reentrancy attacks during fund transfers.
- **Emergency Controls**: RewardDistributor includes pausable functionality that can be activated by the owner in case of emergencies.
- **ETH Recovery**: SwapCastHook includes an ETH recovery function to allow the owner to recover stuck ETH in case of emergency.
- **Modular Logic**: MarketLogic library separates core business logic for better testing and security auditing.

### Access Control

- **Role-Based Access**: Contracts use OpenZeppelin's Ownable for administrative functions.
- **Function-Level Permissions**: Functions are restricted to appropriate callers (e.g., only the PredictionManager can mint/burn NFTs).
- **Oracle Authorization**: Only registered OracleResolver can resolve markets.

### Data Validation

- **Comprehensive Input Validation**: All user inputs and external data are validated before processing.
- **Oracle Data Verification**: OracleResolver performs extensive validation of Chainlink price feed data, including:
   - Price freshness checks against `maxPriceStalenessSeconds`
   - Round validation (`answeredInRound >= roundId`)
   - Price positivity verification
   - Feed registry validation

### Error Handling

- **Detailed Error Messages**: All contracts use custom errors with descriptive messages for better debugging.
- **Graceful Failure**: Contracts handle errors gracefully, providing clear information about what went wrong.
- **Try-Catch Pattern**: SwapCastHook uses try-catch for PredictionManager interactions to handle failures gracefully.

---

## 🤔 Current Considerations & Challenges

As with any innovative DeFi project, we've identified several areas that deserve careful consideration:

### Gas Efficiency

The `_afterSwap` hook in SwapCastHook performs several operations that add to the base gas cost of swaps. We've optimized where possible (using assembly for data extraction, minimizing storage operations, caching storage variables), but there's an inherent trade-off between functionality and gas costs. Our preliminary benchmarks show the additional gas cost is reasonable given the added utility, but we're continuing to optimize.

### Hook Data Format

We've implemented a fixed-length hookData format (69 bytes) for efficiency, but this creates limitations for future extensions. The current format supports both direct PoolManager calls and Universal Router calls through offset detection, but we're exploring versioning mechanisms that would allow for backward compatibility while enabling more complex prediction parameters in the future.

### Multi-Chain & Multi-Oracle Dependency

The system supports multiple oracle providers and automation solutions to maximize chain compatibility:

**Oracle Providers:**
- **Chainlink:** Primary oracle solution for established chains with comprehensive price feed coverage
- **Pyth Network:** Alternative oracle provider offering broader chain support and high-frequency price updates

**Automation Solutions:**
- **Chainlink Automation:** Preferred automation for chains with native Chainlink support
- **Gelato Network:** Alternative automation infrastructure for emerging chains like Ink

While this multi-provider approach increases resilience and chain coverage, it does introduce complexity. We've implemented extensive validation for all oracle data sources and are exploring governance mechanisms for edge cases where oracle data conflicts or becomes unavailable.

### Market Creation Centralization

Currently, markets are created by the contract owner, which introduces some centralization. A more decentralized approach would allow users to propose markets (potentially with a deposit requirement) that could be automatically created based on predefined criteria or community governance.

### Fee Structure Optimization

The current configurable fee structure balances revenue generation with user incentives, but we're exploring dynamic fee models that could adjust based on market liquidity, prediction volume, or other factors to optimize participation and market efficiency.

---

## 🚀 Future Extensions

While the current implementation provides a solid foundation, we're excited about several potential extensions that could further enhance SwapCast:

### Multi-Asset Staking

As mentioned in our current scope, a natural evolution would be to allow users to stake with the asset they're receiving from the swap, rather than just ETH. This would create an even tighter connection between the swap and the prediction, as users would be putting their newly acquired tokens behind their market conviction.

### Automated Market Making Integration

An exciting possibility is using aggregated prediction data to influence the AMM parameters of the pool itself. This could create a powerful feedback loop where market sentiment directly impacts trading conditions, potentially reducing impermanent loss and improving capital efficiency.

### Cross-Chain Deployment Strategy

SwapCast is designed for multi-chain deployment with adaptive infrastructure:

**Tier 1 Chains (Full Chainlink Support):**
- Ethereum, Polygon, Arbitrum, Optimism
- Primary oracle: Chainlink Feed Registry
- Automation: Chainlink Automation (time & log-based)

**Tier 2 Chains (Emerging Networks):**
- Ink, Base, other new L2s
- Primary oracle: Pyth Network
- Automation: Gelato Network
- Fallback to Chainlink where available

This multi-tier approach ensures SwapCast can deploy on cutting-edge chains while maintaining reliability on established networks.

### Reputation System

Implementing a reputation system for predictors based on their historical accuracy could create additional incentives for thoughtful predictions. High-reputation predictors might receive benefits like reduced fees, earlier access to new markets, or weighted voting rights in a future DAO governance structure.

### Conditional Markets

Expanding beyond simple price predictions, we could implement conditional markets that allow for more complex predictions (e.g., "Token A will outperform Token B if Event C occurs"). This would enable more sophisticated market intelligence gathering and potentially attract more advanced traders.

### Decentralized Market Creation

Future versions could implement a governance mechanism allowing users to propose and vote on new prediction markets, potentially with economic incentives (deposits, rewards for successful market proposals) to ensure quality and prevent spam.

---

## 📂 Repository Structure

```
swapcast/
├── src/                        # Smart contracts
│   ├── PredictionManager.sol   # Core prediction market logic
│   ├── SwapCastHook.sol       # Uniswap V4 hook integration
│   ├── MarketLogic.sol        # Business logic library
│   ├── SwapCastNFT.sol        # Position NFTs
│   ├── OracleResolver.sol     # Chainlink integration
│   ├── RewardDistributor.sol  # Reward claiming
│   ├── Treasury.sol           # Fee collection
│   └── interfaces/            # Contract interfaces
├── docs/                      # Documentation
│   └── c4_architecture/       # C4 model diagrams
├── dApp/                      # SvelteKit frontend application
│   ├── src/                   # Svelte components and routes
│   ├── package.json
│   └── npm run dev:with-contracts  # Complete setup script
├── test/                      # Contract tests
├── script/                    # Deployment scripts
└── README.md
```

---

## 📂 Further Reading

- [docs/c4_architecture](docs/c4_architecture) — Full C4 diagrams and architecture documentation
- [src/interfaces](src/interfaces) — Contract interface definitions
- [dApp](dApp) — SvelteKit frontend application source code

---

For a detailed technical overview, see the [C4 Architecture Diagrams](docs/c4_architecture/). These include context, container, component, and sequence diagrams that illustrate the full protocol and funds flow.

## Development Tools

**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**

Foundry consists of:

-   **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
-   **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
-   **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
-   **Chisel**: Fast, utilitarian, and verbose solidity REPL.

### Build

```shell
$ forge build
```

### Test

```shell
$ forge test
```

### Format

```shell
$ forge fmt
```

### Gas Snapshots

```shell
$ forge snapshot
```

### Anvil

```shell
$ anvil
```

### Deploy

```shell
$ forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
```

### Cast

```shell
$ cast <subcommand>
```

### Help

```shell
$ forge --help
$ anvil --help
$ cast --help
```
