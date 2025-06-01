# SwapCast: A Market Intelligence & Prediction Layer for Uniswap v4

SwapCast transforms Uniswap v4 pools into dual-purpose infrastructure: maintaining efficient swap execution while simultaneously generating valuable market intelligence through incentivized predictions.

This protocol enables traders to include market predictions alongside their swaps, with transaction value serving as conviction weight. By aggregating these signals, SwapCast creates an on-chain "wisdom-of-crowds" mechanism backed by genuine financial commitment.

Unlike standalone prediction markets that struggle with liquidity fragmentation, SwapCast leverages Uniswap's substantial trading volume to generate high-quality market sentiment data while rewarding accurate predictors.

---

## 🔍 Key Features

- **Seamless Swap Integration**: Captures prediction data during standard swap execution.
- **Conviction Weighting**: Uses actual transaction values to weight market signals.
- **Automated Resolution**: Leverages Chainlink Automation for trustless prediction resolution.
- **Dual-sided Markets**: Creates balanced markets with initial 60/40 odds ratios.
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

Rewards are calculated using a pari-mutuel betting model where winners share the losing side's stake:

1. **Base Reward (Original Stake):**
   ```
   rewardAmount = yourStake
   ```
   You always get your original stake back as part of your reward.

2. **Additional Reward (Share of Losing Side):**
   ```
   // If BEAR side wins
   rewardAmount += (yourStake * totalBullWeight) / totalBearWeight
   
   // If BULL side wins
   rewardAmount += (yourStake * totalBearWeight) / totalBullWeight
   ```
   Your share of the losing side's pool is proportional to your stake relative to the total stake on your (winning) side.

3. **Net Profit:**
   ```
   netProfit = rewardAmount - yourStake
   ```

4. **ROI:**
   ```
   ROI = (netProfit / yourStake) * 100%
   ```

5. **Example Calculation:**
    - Total Bull Predictions: 1.0 ETH
    - Total Bear Predictions: 3.0 ETH
    - Trader's Bull Position: 0.1 ETH

   If the Bull outcome is correct:
    - Original Stake: 0.1 ETH
    - Share of Bear Pool: (0.1 ETH / 1.0 ETH) * 3.0 ETH = 0.3 ETH
    - Total Reward: 0.1 ETH + 0.3 ETH = 0.4 ETH
    - Net Profit: 0.4 ETH - 0.1 ETH = 0.3 ETH
    - ROI: (0.3 ETH / 0.1 ETH) * 100% = 300%

---

## 💡 Core Prediction & Staking Model (Hackathon Focus)

SwapCast's core innovation lies in seamlessly integrating a prediction mechanism directly into the Uniswap v4 swap event. This allows traders to act on their market conviction at the precise moment of a trade.

**Staking Mechanism (Current Implementation for Hackathon):**

For the current implementation, particularly within the scope of this hackathon, predictions are staked using **ETH**.

*   **Why ETH Staking?**
    *   **Simplicity & Speed of Development:** Managing a single, common asset like ETH for prize pools and stake accounting is significantly simpler and allows for more rapid development and a polished core feature delivery within the hackathon timeframe. This avoids the complexities of handling diverse ERC20 tokens for staking, which would involve more intricate prize pool management, valueOracle integrations for differing staked assets, and potentially fragmented liquidity.
    *   **Universal Medium of Conviction:** ETH serves as a universal and liquid asset for users to express their financial conviction across various prediction markets offered by SwapCast.
    *   **Focus on Core Innovation:** The primary novelty is the *swap-triggered prediction*. Using ETH for staking allows us to highlight this core mechanism effectively.

*   **How it Works:**
    1.  A user performs a swap (e.g., USDC for WETH).
    2.  Alongside the swap, they specify their prediction (e.g., WETH will go up against USD) and the amount of **ETH** they wish to stake on this prediction.
    3.  This ETH stake is transferred to the `PredictionManager` contract, which holds it until the market resolves.
    4.  The `SwapCastHook` facilitates this, ensuring the correct ETH amount (stake + protocol fee) is forwarded.

**Bearish Predictions & Use Cases with ETH Staking:**

Even when acquiring an asset (e.g., Token B), a user might make a bearish prediction on it (e.g., "Token B vs. USD will go down"). This isn't contradictory and serves several purposes:

*   **Hedging Utility:** If a user acquires Token B for its utility (e.g., to use in a game or dApp soon) but is concerned about short-term price drops before they can use it, a bearish ETH-staked prediction can help offset potential losses on their Token B holding.
*   **Relative Value Plays:** A user might swap from Token A (believed to perform very poorly) to Token B (believed to perform less poorly, but still expected to decline against a benchmark like USD). The swap is a flight to relative safety, and the bearish prediction on Token B reflects a broader market view.
*   The prediction market itself is typically defined against a stable benchmark (e.g., "Token X price vs. USD") rather than the other token in the swap pair, making bearish predictions on the acquired asset logical.

**Future Considerations (Beyond Hackathon Scope):**

*   **Staking with the Swapped Asset:** A potential future enhancement could involve allowing users to stake a portion of the asset they receive from the swap (e.g., staking some of the Token B acquired). This would tie the "skin in the game" even more directly to the specific asset being predicted upon. However, this introduces significant architectural complexity (multi-asset prize pools, oracle dependencies for value comparison, etc.) and is considered out of scope for the initial hackathon version to ensure a focused and polished delivery of the core concept.

This section aims to clarify the current ETH-staking model as a deliberate and pragmatic choice for the hackathon, while also outlining the strategic thinking behind it and acknowledging future possibilities.

---

## Protocol Architecture

SwapCast is composed of several modular contracts that together provide a secure, upgradable, and transparent prediction market layer on top of Uniswap v4.

### Key Components

- **SwapCastHook:** Intercepts Uniswap v4 swap transactions, extracts prediction data, and forwards them to the PredictionManager.
- **PredictionManager:** Manages prediction markets, positions, stakes, and NFT issuance, and pays rewards.
- **SwapCastNFT:** ERC721 NFT representing prediction positions, with full on-chain metadata.
- **OracleResolver:** Registers and resolves prediction markets using Chainlink Automation and price feeds.
- **RewardDistributor:** Handles reward claim logic and validates claims, interacting with the PredictionManager for reward payouts.
- **Treasury:** Collects and holds all protocol fees from predictions made in the PredictionManager.
- **Chainlink Automation:** Triggers market resolution at the due date.

---

### Funds Flow

1. **Prediction Creation:**
    - User pays a prediction fee (e.g., 1% of swap) during swap.
    - **SwapCastHook** calculates the total amount (stake + protocol fee) and forwards it to the **PredictionManager**.
    - **PredictionManager** receives the user's total stake, transfers the calculated protocol fee to the **Treasury** contract, and holds the remaining net stake for potential reward payouts.

2. **Market Resolution:**
    - **OracleResolver** (triggered by Chainlink Automation or Admin) determines the winning outcome.
    - **OracleResolver** calls **PredictionManager** to update the market status (e.g., "Bullish Wins").

3. **Reward Claim:**
    - Winner calls `claimReward` via the **RewardDistributor** (or dApp).
    - **RewardDistributor** forwards the claim to the **PredictionManager**.
    - **PredictionManager** verifies the claim, executes the reward transfer directly to the winner, and burns the associated NFT.

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
2. The trader includes prediction parameters (e.g., "ETH will reach $5000 by June 30").
3. The trader's conviction weight is calculated based on swap amount.
4. The SwapCast Hook captures this data and creates a position in the Prediction Pool.
5. The trader receives a SwapCast NFT as proof of their prediction, with all details stored in metadata.

### Why NFTs (ERC721) Instead of ERC20 Tokens

- **Rich Metadata:** Each NFT stores complete prediction details (asset, price target, direction, expiration).
- **Unique Positions:** Each prediction is a unique position.
- **Simplified UX:** No need for complex token naming conventions.
- **Visual Representation:** NFTs can be visually represented in wallets and marketplaces.
- **Ownership Verification:** Simplifies the reward claiming process.

### Prediction Resolution Flow

1. Chainlink Automation regularly checks for expired predictions.
2. When a prediction expires, Chainlink Automation triggers the resolution process.
3. The Oracle Resolver fetches the current price from Chainlink Price Feeds.
4. The Oracle Resolver determines if the prediction was correct.
5. The Reward Distributor calculates rewards based on conviction weights.

### Pull-Based Reward Mechanism

1. Winners must actively claim their rewards by calling the `claimReward` function.
2. They must own the SwapCast NFT representing their prediction.
3. The contract verifies:
    - Market has been resolved.
    - Trader owns the position NFT.
    - Position matches the winning outcome.
4. Position NFT is burned upon successful claim.
5. Rewards are transferred to the winner's address.

---

## 📊 Example User Flow

1. **Alice swaps 1000 USDC for ETH**
    - She predicts ETH will exceed $5000 by June 30.
    - Her conviction weight is calculated as 10 USDC (1% of swap).
    - The SwapCastHook forwards her prediction data and ETH stake to the PredictionManager.
    - The PredictionManager mints a SwapCastNFT with her prediction details.
    - She receives ETH (from swap) and the SwapCastNFT representing her prediction position.

2. **Bob swaps 2000 USDC for ETH**
    - He predicts ETH will NOT exceed $5000 by June 30.
    - His conviction weight is calculated as 20 USDC (1% of swap).
    - The SwapCastHook forwards his prediction data and ETH stake to the PredictionManager.
    - The PredictionManager mints a SwapCastNFT with his prediction details.
    - He receives ETH (from swap) and the SwapCastNFT representing his prediction position.

3. **June 30 arrives**
    - Chainlink Automation triggers the OracleResolver.
    - OracleResolver checks current ETH price via Chainlink Feed Registry.
    - OracleResolver determines the outcome: If ETH > $5000, Bullish outcome wins; if ETH < $5000, Bearish outcome wins.
    - OracleResolver calls the PredictionManager to update the market status.

4. **Rewards are claimed**
    - Winners call the RewardDistributor's claimReward function.
    - RewardDistributor forwards the claim to the PredictionManager.
    - PredictionManager verifies the user owns the SwapCastNFT representing their prediction.
    - PredictionManager burns the NFT upon successful claim.
    - PredictionManager transfers the reward ETH to the winner's address.

---

## 🔒 Security Features

SwapCast implements several security features across its contracts to ensure the safety of user funds and the integrity of the prediction markets:

### Contract-Level Security

- **Immutable References**: Critical contract addresses like the PredictionManager in SwapCastHook and RewardDistributor are set as immutable, preventing changes after deployment.
- **Reentrancy Protection**: Treasury and RewardDistributor use OpenZeppelin's ReentrancyGuard to prevent reentrancy attacks during fund transfers.
- **Emergency Controls**: RewardDistributor includes pausable functionality that can be activated by the owner in case of emergencies.
- **ETH Recovery**: SwapCastHook includes an ETH recovery function to allow the owner to recover stuck ETH in case of emergency.

### Access Control

- **Role-Based Access**: Contracts use OpenZeppelin's Ownable for administrative functions.
- **Function-Level Permissions**: Functions are restricted to appropriate callers (e.g., only the PredictionManager can mint/burn NFTs).

### Data Validation

- **Comprehensive Input Validation**: All user inputs and external data are validated before processing.
- **Oracle Data Verification**: OracleResolver performs extensive validation of Chainlink price feed data, including freshness checks.

### Error Handling

- **Detailed Error Messages**: All contracts use custom errors with descriptive messages for better debugging.
- **Graceful Failure**: Contracts handle errors gracefully, providing clear information about what went wrong.

## 🤔 Current Considerations & Challenges

As with any innovative DeFi project, we've identified several areas that deserve careful consideration:

### Gas Efficiency

The `_afterSwap` hook in SwapCastHook performs several operations that add to the base gas cost of swaps. We've optimized where possible (using assembly for data extraction, minimizing storage operations), but there's an inherent trade-off between functionality and gas costs. Our preliminary benchmarks show the additional gas cost is reasonable given the added utility, but we're continuing to optimize.

### Hook Data Format

We've implemented a fixed-length hookData format (69 bytes) for efficiency, but this creates limitations for future extensions. We're exploring versioning mechanisms that would allow for backward compatibility while enabling more complex prediction parameters in the future.

### Oracle Dependency

The system relies on Chainlink for price data and market resolution. While Chainlink is the gold standard for on-chain oracles, this does introduce a dependency. We've implemented extensive validation of oracle data (freshness checks, round verification) and are considering a governance mechanism that could resolve markets in edge cases where oracle data is unavailable or disputed.

### Market Creation

Currently, markets are created by the contract owner, which introduces some centralization. A more decentralized approach would allow users to propose markets (potentially with a deposit requirement) that could be automatically created based on predefined criteria.

### Incentive Alignment

The current fee structure (5% protocol fee) balances revenue generation with user incentives, but we're exploring dynamic fee models that could adjust based on market liquidity, prediction volume, or other factors to optimize participation.

## 🚀 Future Extensions

While the current implementation provides a solid foundation, we're excited about several potential extensions that could further enhance SwapCast:

### Multi-Asset Staking

As mentioned in our hackathon scope limitations, a natural evolution would be to allow users to stake with the asset they're receiving from the swap, rather than just ETH. This would create an even tighter connection between the swap and the prediction, as users would be putting their newly acquired tokens behind their market conviction.

### Automated Market Making Integration

An exciting possibility is using aggregated prediction data to influence the AMM parameters of the pool itself. This could create a powerful feedback loop where market sentiment directly impacts trading conditions, potentially reducing impermanent loss and improving capital efficiency.

### Cross-Protocol Integration

The market sentiment data generated by SwapCast could be valuable input for other DeFi protocols. For example, lending platforms could adjust interest rates based on market predictions, or options protocols could use prediction data to inform pricing models. We're exploring partnerships that would allow for such integrations.

### Reputation System

Implementing a reputation system for predictors based on their historical accuracy could create additional incentives for thoughtful predictions. High-reputation predictors might receive benefits like reduced fees, earlier access to new markets, or weighted voting rights in a future DAO governance structure.

### Conditional Markets

Expanding beyond simple price predictions, we could implement conditional markets that allow for more complex predictions (e.g., "Token A will outperform Token B if Event C occurs"). This would enable more sophisticated market intelligence gathering and potentially attract more advanced traders.

---

## 📂 Further Reading

- [docs/c4_architecture](docs/c4_architecture) — full C4 diagrams and architecture docs

---

For a detailed technical overview, see the [C4 Architecture Diagrams](docs/c4_architecture/). These include context, container, component, and sequence diagrams that illustrate the full protocol and funds flow.

## Foundry

**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**

Foundry consists of:

-   **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
-   **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
-   **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
-   **Chisel**: Fast, utilitarian, and verbose solidity REPL.

## Documentation

https://book.getfoundry.sh/

## Usage

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
